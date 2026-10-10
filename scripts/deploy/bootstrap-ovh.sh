#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_USER="${DEPLOY_USER:-arkadii}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/srv/arkadii-quest}"

[[ "$(id -u)" -eq 0 ]] || {
    echo "Run this bootstrap once as root (for example: sudo bash scripts/deploy/bootstrap-ovh.sh)." >&2
    exit 1
}

[[ "$DEPLOY_ROOT" == /srv/arkadii-quest ]] || {
    echo "DEPLOY_ROOT must remain /srv/arkadii-quest." >&2
    exit 64
}

source /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || {
    echo "This bootstrap supports Ubuntu on OVH. Install Docker Engine and Docker Compose manually on ${PRETTY_NAME:-this OS}." >&2
    exit 1
}

apt-get update
apt-get install -y ca-certificates curl gnupg ufw

install -m 0755 -d /etc/apt/keyrings
if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
fi

docker_source="/etc/apt/sources.list.d/docker.sources"
if [[ ! -f "$docker_source" ]]; then
    cat >"$docker_source" <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${VERSION_CODENAME}
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF
fi

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
usermod -aG docker "$DEPLOY_USER"

install -d -m 0750 -o "$DEPLOY_USER" -g "$DEPLOY_USER" \
    "$DEPLOY_ROOT" "$DEPLOY_ROOT/releases" "$DEPLOY_ROOT/shared"

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

docker compose version
echo "OVH bootstrap complete. Add the CI deploy SSH public key to /home/$DEPLOY_USER/.ssh/authorized_keys, then configure the GitHub production environment secrets."
