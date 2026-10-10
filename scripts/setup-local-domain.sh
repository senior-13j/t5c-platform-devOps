#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$ROOT_DIR/.env"
    set +a
fi

CERT_DIR="$ROOT_DIR/docker/nginx/certs"
APP_DOMAIN="${APP_DOMAIN:-arkadii.game.local}"
GRAFANA_DOMAIN="${GRAFANA_DOMAIN:-grafana.${APP_DOMAIN}}"
PROMETHEUS_DOMAIN="${PROMETHEUS_DOMAIN:-prometheus.${APP_DOMAIN}}"

CA_KEY="$CERT_DIR/arkadii-quest-local-ca.key"
CA_CERT="$CERT_DIR/arkadii-quest-local-ca.crt"
SERVER_KEY="$CERT_DIR/arkadii-quest-local.key"
SERVER_CSR="$CERT_DIR/arkadii-quest-local.csr"
SERVER_CERT="$CERT_DIR/arkadii-quest-local.crt"

run_root() {
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
    else
        sudo "$@"
    fi
}

add_host() {
    local host="$1"
    if ! getent hosts "$host" >/dev/null 2>&1; then
        run_root sh -c "printf '127.0.0.1\t%s\n' '$host' >> /etc/hosts"
    fi
}

mkdir -p "$CERT_DIR"

if [ ! -f "$CA_KEY" ] || [ ! -f "$CA_CERT" ]; then
    openssl genrsa -out "$CA_KEY" 4096
    openssl req -x509 -new -nodes -key "$CA_KEY" -sha256 -days 3650 -out "$CA_CERT" \
        -subj "/CN=Arkadii Quest Local Development CA"
fi

SAN_FILE="$(mktemp)"
trap 'rm -f "$SAN_FILE"' EXIT
{
    printf 'basicConstraints=CA:FALSE\n'
    printf 'keyUsage=digitalSignature,keyEncipherment\n'
    printf 'extendedKeyUsage=serverAuth\n'
    printf 'subjectAltName=DNS:%s,DNS:%s,DNS:%s\n' "$APP_DOMAIN" "$GRAFANA_DOMAIN" "$PROMETHEUS_DOMAIN"
} > "$SAN_FILE"

openssl genrsa -out "$SERVER_KEY" 2048
openssl req -new -key "$SERVER_KEY" -out "$SERVER_CSR" -subj "/CN=$APP_DOMAIN"
openssl x509 -req -in "$SERVER_CSR" -CA "$CA_CERT" -CAkey "$CA_KEY" -CAcreateserial \
    -out "$SERVER_CERT" -days 825 -sha256 -extfile "$SAN_FILE"
rm -f "$SERVER_CSR"

chmod 600 "$CA_KEY" "$SERVER_KEY"
chmod 644 "$CA_CERT" "$SERVER_CERT"

add_host "$APP_DOMAIN"
add_host "$GRAFANA_DOMAIN"
add_host "$PROMETHEUS_DOMAIN"

if command -v update-ca-trust >/dev/null 2>&1; then
    run_root install -Dm644 "$CA_CERT" /etc/ca-certificates/trust-source/anchors/arkadii-quest-local-ca.crt
    run_root update-ca-trust
elif command -v update-ca-certificates >/dev/null 2>&1; then
    run_root install -Dm644 "$CA_CERT" /usr/local/share/ca-certificates/arkadii-quest-local-ca.crt
    run_root update-ca-certificates
else
    echo "CA trust store was not updated: update-ca-trust/update-ca-certificates not found." >&2
fi

echo "Local HTTPS domains are ready:"
echo "  https://$APP_DOMAIN"
echo "  https://$GRAFANA_DOMAIN"
echo "  https://$PROMETHEUS_DOMAIN"
