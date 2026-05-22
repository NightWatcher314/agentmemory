#!/bin/sh
# agentmemory first-boot entrypoint.
#
# Runs as root so it can:
#   1. Overwrite the npm-bundled iii-config.yaml (which binds 127.0.0.1
#      and uses relative ./data paths) with a deploy-tuned version that
#      binds 0.0.0.0 and uses absolute /data paths.
#   2. chown the platform-mounted /data volume to the runtime user
#      (managed platforms mount volumes root-owned 755 by default).
#   3. Generate the HMAC secret on first boot and persist it to
#      /data/.hmac (chmod 600) so the secret survives restarts.
#
# Then it execs the agentmemory CLI under gosu as the unprivileged
# `node` user.

set -eu

DATA_DIR="${AGENTMEMORY_DATA_DIR:-/data}"
HMAC_FILE="${AGENTMEMORY_HMAC_FILE:-/data/.hmac}"
RUN_AS="node:node"
PACKAGE_DIR="${AGENTMEMORY_PACKAGE_DIR:-/opt/agentmemory/node_modules/@nightwatcher314/agentmemory}"
if [ -z "$PACKAGE_DIR" ] || [ ! -d "$PACKAGE_DIR/dist" ]; then
  echo "agentmemory: cannot find @nightwatcher314/agentmemory dist directory at $PACKAGE_DIR/dist" >&2
  exit 1
fi
III_CONFIG="$PACKAGE_DIR/dist/iii-config.yaml"
DIST_DIR="$PACKAGE_DIR/dist"
NODE_HOME="$(getent passwd node | cut -d: -f6)"
AGENTMEMORY_HOME="$DATA_DIR/agentmemory-home"

mkdir -p "$DATA_DIR"
chown -R "$RUN_AS" "$DATA_DIR"

mkdir -p "$AGENTMEMORY_HOME" "$NODE_HOME"
if [ -e "$NODE_HOME/.agentmemory" ] && [ ! -L "$NODE_HOME/.agentmemory" ]; then
  rm -rf "$NODE_HOME/.agentmemory"
fi
ln -sfn "$AGENTMEMORY_HOME" "$NODE_HOME/.agentmemory"
chown -R "$RUN_AS" "$AGENTMEMORY_HOME"

PREFS_FILE="$AGENTMEMORY_HOME/preferences.json"
if [ ! -s "$PREFS_FILE" ]; then
  cat > "$PREFS_FILE" <<'EOF'
{
  "schemaVersion": 1,
  "lastAgent": null,
  "lastAgents": [],
  "lastProvider": null,
  "skipSplash": true,
  "skipNpxHint": true,
  "skipGlobalInstall": true,
  "skipConsoleInstall": true,
  "firstRunAt": "1970-01-01T00:00:00.000Z"
}
EOF
  chmod 600 "$PREFS_FILE"
  chown "$RUN_AS" "$PREFS_FILE"
fi

cat > "$III_CONFIG" <<'EOF'
workers:
  - name: iii-http
    config:
      port: 3111
      host: 0.0.0.0
      default_timeout: 180000
      cors:
        allowed_origins:
          - "http://localhost:3111"
          - "http://localhost:3113"
          - "http://127.0.0.1:3111"
          - "http://127.0.0.1:3113"
        allowed_methods: [GET, POST, PUT, DELETE, OPTIONS]
  - name: iii-state
    config:
      adapter:
        name: kv
        config:
          store_method: file_based
          file_path: /data/state_store.db
  - name: iii-queue
    config:
      adapter:
        name: builtin
  - name: iii-pubsub
    config:
      adapter:
        name: local
  - name: iii-cron
    config:
      adapter:
        name: kv
  - name: iii-stream
    config:
      port: 3112
      host: 0.0.0.0
      adapter:
        name: kv
        config:
          store_method: file_based
          file_path: /data/stream_store
  - name: iii-observability
    config:
      enabled: true
      service_name: agentmemory
      exporter: memory
      sampling_ratio: 1.0
      metrics_enabled: true
      logs_enabled: true
      logs_console_output: true
EOF
chown "$RUN_AS" "$III_CONFIG"

if [ -d "$DIST_DIR" ]; then
  find "$DIST_DIR" -maxdepth 1 -type f -name '*.mjs' -exec \
    sed -i 's/server\.listen(currentPort, "127\.0\.0\.1")/server.listen(currentPort, "0.0.0.0")/g' {} +
  chown -R "$RUN_AS" "$DIST_DIR"
fi

if [ ! -s "$HMAC_FILE" ]; then
  SECRET="$(openssl rand -hex 32)"
  umask 077
  printf '%s\n' "$SECRET" > "$HMAC_FILE"
  chmod 600 "$HMAC_FILE"
  chown "$RUN_AS" "$HMAC_FILE"
  echo "================================================================"
  echo "agentmemory: generated HMAC secret on first boot"
  echo "AGENTMEMORY_SECRET=$SECRET"
  echo "Copy this value now. It will not be printed again."
  echo "Stored at: $HMAC_FILE (chmod 600)"
  echo "To rotate: delete $HMAC_FILE on the persistent volume and restart."
  echo "================================================================"
fi

AGENTMEMORY_SECRET="$(cat "$HMAC_FILE")"
export AGENTMEMORY_SECRET

exec gosu "$RUN_AS" agentmemory "$@"
