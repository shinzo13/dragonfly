<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import Play from "@lucide/svelte/icons/play";
  import PlugZap from "@lucide/svelte/icons/plug-zap";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Settings from "@lucide/svelte/icons/settings-2";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import { createQuery, useQueryClient } from "@tanstack/svelte-query";
  import { lists } from "#lib/api/lists.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import Chip from "#lib/v2/components/Chip.svelte";
  import SyncSettings from "#lib/v2/forms/SyncSettings.svelte";
  import { look } from "#lib/v2/look.svelte.js";
  import { type SourceResult, type SyncPlugin, sync, syncKeys } from "#lib/v2/sync.js";
  import { dateTime } from "#lib/v2/when.js";

  const client = useQueryClient();
  const plugins = createQuery(() => ({ queryFn: sync.plugins, queryKey: syncKeys.plugins, refetchInterval: 30_000, retry: 0 }));
  const questions = createQuery(() => ({ queryFn: sync.questions, queryKey: syncKeys.questions, retry: 0 }));
  const runs = createQuery(() => ({ queryFn: () => sync.runs(10), queryKey: syncKeys.runs, retry: 0 }));
  const categories = createQuery(() => lists.categories());

  let running = $state<string | null>(null);
  let message = $state("");
  let editing = $state<SyncPlugin | null>(null);
  let editOpen = $state(false);
  let answers = $state<Record<number, string>>({});

  const KIND = { enricher: "Enricher", hook: "Hook", matcher: "Matcher", source: "Source" };
  const DAY = 86_400_000;

  async function refresh() {
    await client.invalidateQueries({ queryKey: ["sync"] });
    await client.invalidateQueries({ queryKey: ["v2"] });
  }

  async function run(id?: string) {
    running = id ?? "all";
    message = "";
    try {
      const result = await sync.run(id);
      const created = result.sources.reduce((s, r) => s + r.created, 0);
      const settled = result.sources.reduce((s, r) => s + r.settled, 0);
      const failed = result.sources.filter((r) => !r.ok);
      message = failed.length
        ? `${failed.map((f) => `${f.source}: ${outcome(f)}`).join(" · ")}`
        : `Done: ${created} new, ${settled} cleared`;
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    } finally {
      running = null;
      await refresh();
    }
  }

  async function reconnect(p: SyncPlugin) {
    const back = `${location.origin}/sync?auth=${encodeURIComponent(p.id)}`;
    try {
      const { url } = await sync.authStart(p.id, back);
      location.assign(url);
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
  }

  $effect(() => {
    const id = page.url.searchParams.get("auth");
    if (!id) {
      return;
    }
    const params = Object.fromEntries([...page.url.searchParams].filter(([k]) => !["auth", "start", "end"].includes(k)));
    sync
      .authFinish(id, params)
      .then((r) => (message = `${id} reconnected until ${dateTime(r.expires_at)}`))
      .catch((e) => (message = e.message))
      .finally(() => {
        goto("/sync", { replace: true });
        refresh();
      });
  });

  async function answer(id: number, body: Record<string, unknown>) {
    try {
      await sync.answer(id, body);
      await refresh();
    } catch (e) {
      message = e instanceof Error ? e.message : String(e);
    }
  }

  function outcome(r: SourceResult): string {
    if (r.rejected) {
      return r.retry_at ? `Refused by the bank, next try ${dateTime(r.retry_at)}` : "Refused by the bank, try again by hand";
    }
    return r.error ?? "failed";
  }

  function status(p: SyncPlugin): { tone: "ok" | "bad" | "idle" | "warn"; text: string } {
    if (p.last_result?.rejected) {
      return { text: outcome(p.last_result), tone: "warn" };
    }
    if (p.last_result && !p.last_result.ok) {
      return { text: p.last_result.error ?? "failed", tone: "bad" };
    }
    if (p.blocked) {
      return { text: p.blocked, tone: "warn" };
    }
    if (!p.last_run) {
      return { text: "never ran", tone: "idle" };
    }
    return { text: `ok · ${ago(p.last_ok ?? p.last_run)}`, tone: "ok" };
  }

  function ago(stamp: string): string {
    const minutes = Math.round((Date.now() - new Date(stamp).getTime()) / 60_000);
    if (minutes < 1) {
      return "just now";
    }
    if (minutes < 60) {
      return `${minutes} min ago`;
    }
    if (minutes < 60 * 24) {
      return `${Math.round(minutes / 60)} h ago`;
    }
    return `${Math.round(minutes / 1440)} d ago`;
  }

  const authDays = (p: SyncPlugin) => (p.auth.expires_at ? Math.floor((new Date(p.auth.expires_at).getTime() - Date.now()) / DAY) : null);
  const down = $derived(plugins.isError);
  const sources = $derived((plugins.data?.plugins ?? []).filter((p) => p.kind === "source"));
  const helpers = $derived((plugins.data?.plugins ?? []).filter((p) => p.kind !== "source"));
</script>

<svelte:head><title>Sync · Dragonfly</title></svelte:head>

<div class="head">
  <div>
    <h1 class="title">Sync</h1>
    <div class="small">Banks, wallets and receipts that feed Firefly</div>
  </div>
  <div class="actions">
    {#if message}<span class="small msg">{message}</span>{/if}
    <button class="btn" onclick={refresh} type="button"><RefreshCw size={15} />Refresh</button>
    <button class="btn primary" disabled={down || running !== null} onclick={() => run()} type="button">
      <Play size={15} />{running === "all" ? "Running…" : "Run everything"}
    </button>
  </div>
</div>

{#if down}
  <section class="panel empty">
    <PlugZap size={28} />
    <p>The sync service does not answer.</p>
    <span class="small">It runs next to Firefly; start it and this page comes alive.</span>
  </section>
{:else}
  {#if questions.data?.length}
    <section class="panel questions">
      <h1>Waiting for you · {questions.data.length}</h1>
      {#each questions.data as q (q.id)}
        <div class="q">
          <span class="q-icon" class:gap={q.type === "unexplained_gap"}><TriangleAlert size={16} /></span>
          <div class="q-body">
            <div class="q-text">{q.text}</div>
            <div class="small">{q.source} · {dateTime(q.created)}</div>
          </div>
          <div class="q-actions">
            {#if q.type === "category"}
              <input bind:value={answers[q.id]} class="field" list="sync-cats" placeholder="Category" />
              <button class="btn primary" disabled={!answers[q.id]} onclick={() => answer(q.id, { category: answers[q.id] })} type="button">Save as rule</button>
            {:else if q.type === "stale_provisional"}
              <button class="btn" onclick={() => answer(q.id, { action: "keep" })} type="button">Keep</button>
              <button class="btn danger" onclick={() => answer(q.id, { action: "delete" })} type="button">Delete</button>
            {:else}
              {#if q.payload.firefly_id && q.type === "unexplained_gap"}
                <a class="btn" href="/acc/{q.payload.firefly_id}">Open account</a>
              {:else if q.payload.firefly_id}
                <a class="btn" href="/tx/{q.payload.firefly_id}">Open transaction</a>
              {/if}
              <button class="btn" onclick={() => answer(q.id, { action: "ignore" })} type="button"><Check size={15} />Done</button>
            {/if}
          </div>
        </div>
      {/each}
      <datalist id="sync-cats">{#each categories.data ?? [] as c (c.id)}<option value={c.attributes.name}></option>{/each}</datalist>
    </section>
  {/if}

  {#if plugins.data?.errors.length}
    <section class="panel errors">
      {#each plugins.data.errors as e (e)}<div class="small neg">{e}</div>{/each}
    </section>
  {/if}

  <div class="grid">
    {#each sources as p (p.id)}
      {@const st = status(p)}
      {@const l = look.of("account", `sync:${p.id}`, p.name)}
      {@const days = authDays(p)}
      <section class="panel plugin">
        <div class="p-head">
          <Chip color={l.color} icon={p.icon} size={42} />
          <div class="p-name">
            <div class="name">{p.name}</div>
            <div class="small">{KIND[p.kind]}{p.cron ? ` · ${p.cron} UTC` : " · manual"}</div>
          </div>
          <button aria-label="Settings" class="ib" onclick={() => ((editing = p), (editOpen = true))} title="Settings" type="button"><Settings size={16} /></button>
        </div>
        <div class="status {st.tone}"><i></i>{st.text}</div>
        {#if p.last_result?.ok}
          <div class="small counts">last run: {p.last_result.created} new · {p.last_result.settled} cleared · {p.last_result.skipped} known</div>
        {/if}
        <div class="p-foot">
          {#if p.auth.type !== "none"}
            <button class="btn" class:warn={days !== null && days < 14} onclick={() => reconnect(p)} type="button">
              {days === null ? "Connect bank" : days < 0 ? "Login expired, reconnect" : `Reconnect · ${days} d left`}
            </button>
          {/if}
          <button class="btn primary" disabled={running !== null || Boolean(p.blocked)} onclick={() => run(p.id)} title={p.blocked ?? ""} type="button">
            <Play size={15} />{running === p.id ? "Running…" : "Run now"}
          </button>
        </div>
      </section>
    {:else}
      {#if plugins.isSuccess}
        <section class="panel empty"><p>No sources yet.</p><span class="small">Drop a plugin folder into the plugins directory and reload the service.</span></section>
      {/if}
    {/each}
  </div>

  {#if helpers.length}
    <section class="panel helpers">
      <h1>Helpers</h1>
      {#each helpers as p (p.id)}
        <div class="helper"><Chip color="#64748B" icon={p.icon} size={28} /><b>{p.name}</b><span class="small">{KIND[p.kind]}</span></div>
      {/each}
    </section>
  {/if}

  <section class="panel log">
    <h1>Recent runs</h1>
    {#each runs.data ?? [] as r (r.id)}
      <div class="run">
        <span class="dot" style:background={r.ok ? "var(--pos)" : r.ok === 0 ? "var(--neg)" : "var(--faint)"}></span>
        <span class="when">{dateTime(r.started)}</span>
        <span class="small what">
          {#each r.report?.sources ?? [] as s (s.source)}
            <span class:neg={!(s.ok || s.rejected)}>{s.source}: {s.ok ? `${s.created} new, ${s.settled} cleared` : outcome(s)}</span>
          {:else}
            nothing to run
          {/each}
        </span>
      </div>
    {:else}
      <p class="small">No runs yet.</p>
    {/each}
  </section>
{/if}

{#if editing}<SyncSettings bind:open={editOpen} plugin={editing} />{/if}

<style>
  .head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    margin-bottom: 22px;
    gap: 20px;
  }
  .title {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .msg {
    max-width: 520px;
    text-align: right;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 50px;
    color: var(--mute);
    font-weight: 600;
    text-align: center;
  }
  .questions {
    margin-bottom: 20px;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--warn) 40%, transparent);
  }
  .questions h1,
  .log h1,
  .helpers h1 {
    margin-bottom: 12px;
  }
  .q {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
  }
  .q-icon {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--warn) 18%, transparent);
    color: var(--warn);
    flex: none;
  }
  .q-icon.gap {
    background: var(--neg-soft);
    color: var(--neg);
  }
  .q-body {
    flex: 1;
    min-width: 0;
  }
  .q-text {
    font-size: 14px;
    font-weight: 700;
  }
  .q-actions {
    display: flex;
    gap: 8px;
  }
  .q-actions .field {
    width: 200px;
  }
  .errors {
    margin-bottom: 20px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 20px;
  }
  .plugin {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .p-head {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .p-name {
    flex: 1;
  }
  .name {
    font-size: 17px;
    font-weight: 800;
  }
  .p-head .ib {
    border: 0;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    font-weight: 700;
  }
  .status i {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--faint);
  }
  .status.ok i {
    background: var(--pos);
  }
  .status.bad {
    color: var(--neg);
  }
  .status.bad i {
    background: var(--neg);
  }
  .status.warn {
    color: var(--warn);
  }
  .status.warn i {
    background: var(--warn);
  }
  .p-foot {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    margin-top: auto;
  }
  .btn.warn {
    color: var(--warn);
    border-color: color-mix(in srgb, var(--warn) 50%, transparent);
  }
  .helpers,
  .log {
    margin-top: 20px;
  }
  .helper {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 0;
    font-size: 14px;
  }
  .run {
    display: grid;
    grid-template-columns: 10px 140px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid var(--line);
    font-size: 13.5px;
    font-weight: 600;
  }
  .what {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
  }
  @media (max-width: 760px) {
    .head {
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
      margin-bottom: 14px;
    }
    .title {
      display: none;
    }
    .actions {
      flex-wrap: wrap;
    }
    .msg {
      text-align: left;
    }
    .q {
      flex-wrap: wrap;
    }
    .q-actions {
      flex-basis: 100%;
      padding-left: 48px;
    }
    .q-actions .field {
      flex: 1;
      width: auto;
    }
    .grid {
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
    }
    .run {
      grid-template-columns: 10px minmax(0, 1fr);
    }
    .run > :nth-child(3) {
      grid-column: 2;
    }
  }
</style>
