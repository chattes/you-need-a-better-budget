#!/bin/sh
# Writes /usr/share/nginx/html/config.js from GOOGLE_CLIENT_ID, then starts the
# command given to the container (nginx by default).
set -eu

CONFIG=/usr/share/nginx/html/config.js
RAW="${GOOGLE_CLIENT_ID:-}"

# Trim only leading and trailing whitespace; inner spaces must stay if valid.
ID="$(printf '%s\n' "$RAW" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

# A Google client ID only has letters, digits, dot, dash and underscore.
# Anything else (including inner whitespace or injected quotes/scripts) is
# refused, so the value can never break out of the config script.
if [ -z "$ID" ] || [ "${#ID}" -gt 200 ] || [ -n "$(printf '%s' "$ID" | tr -d 'A-Za-z0-9._-')" ]; then
    echo "ynbb: GOOGLE_CLIENT_ID contains invalid characters or is too long; ignoring it." >&2
    JSON='{}'
else
    JSON="{\"googleClientId\":\"$ID\"}"
fi

cat > "$CONFIG" <<EOF
// Written at container start from GOOGLE_CLIENT_ID.
window.__YNBB_CONFIG__ = $JSON;
EOF

exec "$@"

