# Dragonfly

[![Firefly III](https://img.shields.io/badge/Firefly_III-6.7.9-3B5BFD)](https://github.com/firefly-iii/firefly-iii) [![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte&logoColor=white)](https://svelte.dev) [![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](https://www.python.org) [![AI Slop Inside](https://sladge.net/badge.svg)](https://sladge.net)

A minimal shell over [Firefly III](https://github.com/firefly-iii/firefly-iii) with a plugin system for bank sync.

This is not a full Firefly client. It covers only the parts of Firefly I need: overview, transactions, accounts, debts, budgets, subscriptions, piggy banks and stats. Everything else stays in the stock Firefly UI, one click away.

Development was based on the [Firefly client by haikesan](https://git.kotikot.com/apps/firefly-ui).

## Install

You need a running Firefly III, Docker, [uv](https://docs.astral.sh/uv/) and a reverse proxy.

```sh
cd ui
make env
make rebuild
```

The UI has no domain of its own, it has to live on Firefly's. [`ui/caddy/fireflyiii.site.caddy`](ui/caddy/fireflyiii.site.caddy) is the Caddy config I run, adapt it to your setup: UI pages and assets go to the UI, the rest goes to Firefly.

```sh
cd sync
FIREFLY_URL=http://firefly:8080 FIREFLY_TOKEN_FILE=token FFSYNC_PLUGINS=plugins uv run ffsync
```

`token` is a file with a Firefly personal access token. The core listens on `127.0.0.1:38091`; add a proxy route for `/sync/*` to it. The core has no auth of its own, so put that route behind one: it holds your bank credentials.

## Plugins

A plugin is a folder with `manifest.toml` and `plugin.py`. There are four kinds:

- `source` fetches transactions from a bank
- `matcher` links stored transactions, such as two sides of a transfer
- `enricher` changes one stored transaction, such as its category
- `hook` runs before or after the sources, such as for exchange rates

Plugins never write to Firefly. They return data, and the core handles scheduling, deduplication and writing.

```python
from ffsync.api import Batch, Context


class Hello:
    def fetch(self, ctx: Context) -> Batch:
        return Batch()


plugin = Hello()
```

To connect one, put its folder into `FFSYNC_PLUGINS` and restart the core or call `POST /sync/reload`. It then shows up in the Sync tab, with its settings as a form. Start from [`sync/examples/hello`](sync/examples/hello); the full interface is in [`sync/PLUGINS.md`](sync/PLUGINS.md).
