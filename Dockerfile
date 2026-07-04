FROM caddy:2-alpine

COPY railway-placeholder/Caddyfile /etc/caddy/Caddyfile
COPY railway-placeholder/public /srv

EXPOSE 8080
