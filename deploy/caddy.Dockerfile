# The Caddyfile travels inside the image rather than as a bind mount: with a remote Docker host a
# host path would be looked up on the server, where this tree does not exist.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
