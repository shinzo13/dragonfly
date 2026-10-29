COMPOSE := docker compose
STAND := $(COMPOSE) -f stand/docker-compose.yml
FFUI_V1_URL ?= http://127.0.0.1:30072
FFUI_V3_URL ?= http://127.0.0.1:40869
FFUI_TOKENS ?= $(HOME)/.config/ffui
SEED := bun scripts/seed/index.ts

.PHONY: env recreate rebuild restart logs down fmt check build dev stand stand-down seed seed-v1 seed-v3 unseed smoke prodlike

fmt:
	bun --bun run fix

check:
	bun run check
	bun --bun run lint

build:
	$(COMPOSE) build frontend

dev:
	bun run dev

env:
	@fresh=; test -f .env || { cp .env.example .env; fresh=1; }; \
	if ! test -f docker-compose.override.yml; then \
		cp docker-compose.override.yml.example docker-compose.override.yml; \
		for port in $$(sed -n 's/.*127\.0\.0\.1:\([0-9]*\):.*/\1/p' docker-compose.override.yml | sort -u); do \
			random=$$((20000 + $$(od -An -N2 -tu2 /dev/urandom) % 40000)); \
			sed "s/127\.0\.0\.1:$$port:/127.0.0.1:$$random:/" docker-compose.override.yml > docker-compose.override.yml.tmp && mv docker-compose.override.yml.tmp docker-compose.override.yml; \
			test -z "$$fresh" || { sed "s|localhost:$$port/|localhost:$$random/|" .env > .env.tmp && mv .env.tmp .env; }; \
		done; \
	fi

recreate:
	$(COMPOSE) up -d --force-recreate

rebuild: build
	$(COMPOSE) up -d

restart:
	$(COMPOSE) restart

logs:
	$(COMPOSE) logs -f --tail=100

down:
	$(COMPOSE) down

stand:
	$(STAND) up -d

stand-down:
	$(STAND) stop

seed:
	$(MAKE) -j2 --output-sync=target seed-v1 seed-v3

seed-v1:
	$(SEED) --base $(FFUI_V1_URL) --token-file $(FFUI_TOKENS)/stand-v1.token $(SEED_FLAGS)

seed-v3:
	$(SEED) --base $(FFUI_V3_URL) --token-file $(FFUI_TOKENS)/stand-v3.token $(SEED_FLAGS)

unseed:
	$(MAKE) -j2 --output-sync=target seed-v1 seed-v3 SEED_FLAGS=--wipe

smoke:
	FFUI_URL=$(FFUI_V3_URL) FFUI_TOKEN_FILE=$(FFUI_TOKENS)/stand-v3.token bun scripts/smoke.ts

prodlike:
	$(STAND) --profile prodlike up -d --build frontend caddy
