#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
    echo "Usage: $0 --root /srv/arkadii-quest --release /srv/arkadii-quest/releases/<release-id>" >&2
    exit 64
}

DEPLOY_ROOT=""
RELEASE_DIR=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --root)
            DEPLOY_ROOT="${2:-}"
            shift 2
            ;;
        --release)
            RELEASE_DIR="${2:-}"
            shift 2
            ;;
        *)
            usage
            ;;
    esac
done

[[ "$DEPLOY_ROOT" == /srv/arkadii-quest ]] || {
    echo "Deployment root must be /srv/arkadii-quest." >&2
    exit 64
}

[[ "$RELEASE_DIR" == "$DEPLOY_ROOT"/releases/* && -d "$RELEASE_DIR" ]] || {
    echo "Release directory must be an existing child of $DEPLOY_ROOT/releases." >&2
    exit 64
}

ENV_FILE="$DEPLOY_ROOT/shared/.env.public"
COMPOSE_FILE="$RELEASE_DIR/docker-compose.public.yml"
PUBLIC_URL="https://arkadii.world"

[[ -f "$ENV_FILE" ]] || {
    echo "Missing $ENV_FILE." >&2
    exit 1
}

[[ -f "$COMPOSE_FILE" ]] || {
    echo "Missing $COMPOSE_FILE." >&2
    exit 1
}

if grep -Eq '(^|=)CHANGE_ME' "$ENV_FILE"; then
    echo "Refusing to deploy with placeholder values in $ENV_FILE." >&2
    exit 1
fi

compose() {
    docker compose \
        --project-directory "$DEPLOY_ROOT/current" \
        --env-file "$ENV_FILE" \
        -f "$DEPLOY_ROOT/current/docker-compose.public.yml" \
        "$@"
}

validate_release() {
    docker compose \
        --project-directory "$RELEASE_DIR" \
        --env-file "$ENV_FILE" \
        -f "$COMPOSE_FILE" \
        config -q

    docker run --rm \
        -v "$RELEASE_DIR/docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
        caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
}

verify_release() {
    local attempts=30
    local attempt

    for ((attempt = 1; attempt <= attempts; attempt += 1)); do
        if curl --fail --silent --show-error --max-time 15 "$PUBLIC_URL/health" | grep -q '"status":"ok"' \
            && curl --fail --silent --show-error --max-time 15 "$PUBLIC_URL/metrics" | grep -q '^arkadii_quest_server_uptime_seconds ' \
            && compose exec -T server node /app/scripts/deploy/verify-observability.mjs; then
            return 0
        fi

        echo "Waiting for public health and Prometheus scrape ($attempt/$attempts)..." >&2
        sleep 10
    done

    return 1
}

rollback() {
    local previous_release="$1"

    [[ -n "$previous_release" && -d "$previous_release" ]] || return 0

    echo "Deployment failed; restoring $previous_release." >&2
    ln -s "$previous_release" "$DEPLOY_ROOT/current.next"
    mv -Tf "$DEPLOY_ROOT/current.next" "$DEPLOY_ROOT/current"
    compose up -d --build --remove-orphans
}

validate_release

previous_release=""
if [[ -L "$DEPLOY_ROOT/current" ]]; then
    previous_release="$(readlink -f "$DEPLOY_ROOT/current" || true)"
fi

ln -s "$RELEASE_DIR" "$DEPLOY_ROOT/current.next"
mv -Tf "$DEPLOY_ROOT/current.next" "$DEPLOY_ROOT/current"

if ! compose up -d --build --remove-orphans; then
    rollback "$previous_release"
    exit 1
fi

if ! verify_release; then
    rollback "$previous_release"
    exit 1
fi

echo "Deployment verified: $PUBLIC_URL/game/"
