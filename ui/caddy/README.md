# caddy

`fireflyiii.site.caddy` is the routing that runs in production: a copy of `fleet/personal/personal-main/fireflyiii/site.caddy` in `infra/komodo`. Firefly UI has no domain of its own; it lives on Firefly's domain and takes only its page paths on GET/HEAD. The path list comes from `src/lib/spa-paths.ts`: `bun scripts/caddy-matcher.ts` prints the `@ffui_pages` block. When the list changes, paste it into both copies.

`site.caddy` is the template's routing for a separate domain and is not used.

`stand/` runs the same file locally (`docker compose -f stand/docker-compose.yml --profile prodlike up -d`), in front of the v3 stand and a production build of the client.
