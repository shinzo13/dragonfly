FROM oven/bun:1-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS deps

ENV TERM=xterm-256color
ENV COLORTERM=truecolor
ENV BUN_INSTALL_CACHE_DIR=/bun-cache

WORKDIR /app

COPY package.json bun.lock* ./

RUN --mount=type=cache,target=/bun-cache bun install --frozen-lockfile


FROM deps AS builder

COPY . .

RUN bun --bun svelte-kit sync
RUN bun run build


FROM oven/bun:1-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/serve.ts ./serve.ts

EXPOSE 3000

ENTRYPOINT ["bun"]
CMD ["run", "serve.ts"]
