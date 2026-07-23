#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-.env.public}"

if [[ -f "$ENV_FILE" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
else
    echo "No $ENV_FILE file found. Using built-in public defaults."
fi

APP_DOMAIN="${APP_DOMAIN:-arkadii.world}"
APP_BASE_PATH="${APP_BASE_PATH:-/game}"
PUBLIC_BIND="${PUBLIC_BIND:-0.0.0.0}"
HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"

normalize_path() {
    local value="${1:-}"
    value="${value#/}"
    value="${value%/}"
    if [[ -z "$value" ]]; then
        printf ''
    else
        printf '/%s' "$value"
    fi
}

APP_BASE_PATH="$(normalize_path "$APP_BASE_PATH")"
APP_URL="https://$APP_DOMAIN${APP_BASE_PATH}/"

echo "Public deployment readiness"
echo "Domain:       $APP_DOMAIN"
echo "Game URL:     $APP_URL"
echo "Bind address: $PUBLIC_BIND"
echo "Ports:        $HTTP_PORT/tcp and $HTTPS_PORT/tcp"
echo

if command -v ss >/dev/null 2>&1; then
    for port in "$HTTP_PORT" "$HTTPS_PORT"; do
        listeners="$(ss -ltnp 2>/dev/null | awk -v suffix=":$port" '$4 ~ suffix "$" { print }')"
        if [[ -n "$listeners" ]]; then
            echo "WARN: port $port is already listening on this host:"
            echo "$listeners"
            echo
        fi
    done
fi

resolve_a() {
    local host="$1"

    if command -v dig >/dev/null 2>&1; then
        dig +short "$host" A || true
        return
    fi

    if command -v getent >/dev/null 2>&1; then
        getent ahostsv4 "$host" 2>/dev/null | awk '{ print $1 }' | sort -u || true
    fi
}

resolve_aaaa() {
    local host="$1"

    if command -v dig >/dev/null 2>&1; then
        dig +short "$host" AAAA || true
        return
    fi

    if command -v getent >/dev/null 2>&1; then
        getent ahostsv6 "$host" 2>/dev/null | awk '{ print $1 }' | sort -u || true
    fi
}

resolve_cname() {
    local host="$1"

    if command -v dig >/dev/null 2>&1; then
        dig +short "$host" CNAME || true
    fi
}

public_ip="$(curl -fsS https://api.ipify.org 2>/dev/null || true)"
root_a="$(resolve_a "$APP_DOMAIN")"
root_aaaa="$(resolve_aaaa "$APP_DOMAIN")"
www_a="$(resolve_a "www.$APP_DOMAIN")"
www_cname="$(resolve_cname "www.$APP_DOMAIN")"

echo "Detected host public IPv4: ${public_ip:-unknown}"
echo
echo "$APP_DOMAIN A records:"
echo "${root_a:-none}"
echo
echo "$APP_DOMAIN AAAA records:"
echo "${root_aaaa:-none}"
echo
echo "www.$APP_DOMAIN A/CNAME records:"
echo "${www_a:-none}"
echo "${www_cname:-none}"
echo

if [[ -z "$root_a" && -z "$root_aaaa" ]]; then
    echo "BLOCKED: $APP_DOMAIN does not resolve yet."
    echo "Create DNS A/AAAA records pointing to this host before starting the public stack."
    exit 1
fi

if [[ -n "$public_ip" && -n "$root_a" ]] && ! grep -qx "$public_ip" <<<"$root_a"; then
    echo "WARN: $APP_DOMAIN A record does not match this host public IPv4 ($public_ip)."
fi

if [[ -z "$www_a" && -z "$www_cname" ]]; then
    echo "WARN: www.$APP_DOMAIN does not resolve. The apex domain can still work, but www redirect will not."
fi

echo "DNS readiness check complete."
echo
echo "Next command:"
echo "docker compose --env-file .env.public -f docker-compose.public.yml up -d --build"
