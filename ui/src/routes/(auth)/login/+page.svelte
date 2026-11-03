<script lang="ts">
  import "#lib/v2/theme.css";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Eye from "@lucide/svelte/icons/eye";
  import EyeOff from "@lucide/svelte/icons/eye-off";
  import { onMount, tick } from "svelte";

  const FIREFLY_FORM = "/login?ffui=old";
  const WIDE = "(min-width: 761px)";

  let form = $state<HTMLFormElement>();
  let emailInput = $state<HTMLInputElement>();
  let passwordInput = $state<HTMLInputElement>();
  let ready = $state(false);
  let busy = $state(false);
  let token = $state("");
  let email = $state("");
  let password = $state("");
  let reveal = $state(false);
  let usesEmail = $state(true);
  let errors = $state<string[]>([]);
  let notices = $state<string[]>([]);
  let resetHref = $state("");
  let registerHref = $state("");

  const texts = (root: ParentNode, selector: string) =>
    [...root.querySelectorAll(selector)].map((node) => node.textContent?.trim() ?? "").filter(Boolean);

  async function load(): Promise<Document | null> {
    let res: Response;
    try {
      res = await fetch(FIREFLY_FORM, { credentials: "same-origin", headers: { Accept: "text/html" } });
    } catch {
      errors = ["Firefly III did not answer. Try again in a moment."];
      return null;
    }
    if (res.redirected) {
      location.replace(res.url);
      return null;
    }
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const field = doc.querySelector<HTMLInputElement>("input[name=_token]");
    if (!field) {
      location.replace(FIREFLY_FORM);
      return null;
    }
    token = field.value;
    return doc;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    errors = [];
    if (await load()) {
      await tick();
      form?.submit();
    } else {
      busy = false;
    }
  }

  onMount(async () => {
    const doc = await load();
    if (doc) {
      const login = doc.querySelector<HTMLInputElement>("input[name=email]");
      email = login?.value ?? "";
      usesEmail = login?.type === "email";
      errors = texts(doc, ".alert-danger li");
      notices = texts(doc, ".alert-success, .alert-primary");
      resetHref = doc.querySelector("a[href*='/password/reset']")?.getAttribute("href") ?? "";
      registerHref = doc.querySelector("a[href$='/register']")?.getAttribute("href") ?? "";
    }
    ready = true;
    await tick();
    if (matchMedia(WIDE).matches) {
      (email ? passwordInput : emailInput)?.focus();
    }
  });
</script>

<svelte:head><title>Log in · Dragonfly</title></svelte:head>

<div class="v2 login">
  <main class="side">
    <svg aria-hidden="true" class="fly" viewBox="0 3.5 64 64">
      <defs>
        <linearGradient id="fly-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#8ea1ff" />
          <stop offset="1" stop-color="#3b5bfd" />
        </linearGradient>
      </defs>
      <g fill="url(#fly-fill)">
        <g class="wing left">
          <path d="M30 24Q16 13.5 4.5 17.5Q2 21 6 22.5Q18 25.5 30 25Z" />
          <path d="M30 27.5Q18 25.5 8 31Q5.5 34 9 35Q20 33.5 30 28.5Z" opacity=".55" />
        </g>
        <g class="wing right">
          <path d="M34 24Q48 13.5 59.5 17.5Q62 21 58 22.5Q46 25.5 34 25Z" />
          <path d="M34 27.5Q46 25.5 56 31Q58.5 34 55 35Q44 33.5 34 28.5Z" opacity=".55" />
        </g>
        <circle cx="32" cy="17.5" r="3.4" />
        <ellipse cx="32" cy="25.5" rx="2.9" ry="5" />
        <path d="M30.5 29H33.5L32.8 57.5Q32 59.5 31.2 57.5Z" />
      </g>
    </svg>
    <form action="/login" bind:this={form} class:ready method="post" onsubmit={submit}>
      <input name="_token" type="hidden" value={token} />
      <div class="title">Dragonfly</div>
      <p class="sub">Log in with your Firefly III account.</p>

      {#each notices as notice (notice)}<p class="note">{notice}</p>{/each}
      {#each errors as error (error)}<p class="note bad" role="alert">{error}</p>{/each}

      <label class="entry">
        <span>{usesEmail ? "Email" : "Username"}</span>
        <input autocomplete="username" autocapitalize="none" bind:this={emailInput} bind:value={email} inputmode={usesEmail ? "email" : "text"} name="email" required spellcheck="false" type={usesEmail ? "email" : "text"} />
      </label>

      <label class="entry">
        <span>Password</span>
        <div class="pass">
          <input autocomplete="current-password" bind:this={passwordInput} bind:value={password} name="password" required type={reveal ? "text" : "password"} />
          <button aria-label={reveal ? "Hide password" : "Show password"} class="eye" onclick={() => (reveal = !reveal)} type="button">
            {#if reveal}<EyeOff size={18} />{:else}<Eye size={18} />{/if}
          </button>
        </div>
      </label>

      <div class="row">
        <label class="remember"><input name="remember" type="checkbox" value="1" />Remember me</label>
        {#if resetHref}<a class="link" data-sveltekit-reload href={resetHref}>Forgot password?</a>{/if}
      </div>

      <button class="go" disabled={busy} type="submit">
        {busy ? "Logging in…" : "Log in"}
        {#if !busy}<ArrowRight size={18} />{/if}
      </button>

      {#if registerHref}<a class="link register" data-sveltekit-reload href={registerHref}>Create an account</a>{/if}
    </form>
  </main>
</div>

<style>
  .side {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 26px;
    padding: max(24px, env(safe-area-inset-top)) 20px max(24px, env(safe-area-inset-bottom));
  }
  .fly {
    width: 84px;
    overflow: visible;
    animation: fly 11s ease-in-out infinite;
  }
  .wing {
    transform-box: view-box;
    animation: flap 0.9s ease-in-out infinite;
  }
  .left {
    transform-origin: 30px 25px;
    --flap: 7deg;
  }
  .right {
    transform-origin: 34px 25px;
    --flap: -7deg;
  }
  @keyframes fly {
    25% {
      transform: translate(22px, -10px) rotate(7deg);
    }
    50% {
      transform: translate(0, -18px) rotate(-2deg);
    }
    75% {
      transform: translate(-22px, -8px) rotate(-7deg);
    }
  }
  @keyframes flap {
    50% {
      transform: rotate(var(--flap));
    }
  }
  form {
    width: min(100%, 400px);
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 30px;
    border-radius: 20px;
    background: var(--panel);
    box-shadow: var(--shadow);
    opacity: 0;
    transition: opacity 0.25s;
  }
  form.ready {
    opacity: 1;
  }
  .title {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.1;
    text-align: center;
  }
  .sub {
    margin: -10px 0 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--mute);
    text-align: center;
  }
  .note {
    padding: 12px 14px;
    border-radius: 14px;
    background: var(--acc-soft);
    font-size: 13.5px;
    font-weight: 600;
  }
  .bad {
    background: var(--neg-soft);
    color: var(--neg);
  }
  .entry {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .entry > span {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--mute);
  }
  .entry input {
    width: 100%;
    height: 50px;
    padding: 0 16px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: var(--bg);
    color: var(--ink);
    font: inherit;
    font-size: 16px;
    font-weight: 600;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .entry input:focus {
    border-color: var(--acc);
    box-shadow: 0 0 0 4px var(--acc-soft);
  }
  .entry input:-webkit-autofill {
    -webkit-text-fill-color: var(--ink);
    -webkit-box-shadow: 0 0 0 100px var(--bg) inset;
    caret-color: var(--ink);
  }
  .pass {
    position: relative;
  }
  .pass input {
    padding-right: 52px;
  }
  .eye {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: transparent;
    color: var(--mute);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .eye:hover {
    background: var(--sunk);
    color: var(--ink);
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--mute);
  }
  .remember {
    display: flex;
    align-items: center;
    gap: 9px;
    cursor: pointer;
  }
  .remember input {
    width: 18px;
    height: 18px;
    accent-color: #3b5bfd;
  }
  .go {
    height: 50px;
    margin-top: 4px;
    border: 0;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #3b5bfd;
    color: #fff;
    font: inherit;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.15s, transform 0.15s;
  }
  .go:hover {
    background: #304de6;
  }
  .go:active {
    transform: scale(0.985);
  }
  .go:disabled {
    opacity: 0.7;
    cursor: default;
  }
  .register {
    align-self: center;
    font-size: 13.5px;
    font-weight: 600;
    color: var(--mute);
  }
  @media (max-width: 760px) {
    .side {
      justify-content: flex-start;
      padding-top: max(56px, calc(env(safe-area-inset-top) + 32px));
    }
    form {
      padding: 0;
      background: transparent;
      box-shadow: none;
    }
    .entry input {
      background: var(--panel);
    }
    .entry input:-webkit-autofill {
      -webkit-box-shadow: 0 0 0 100px var(--panel) inset;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .fly,
    .wing {
      animation: none;
    }
    form {
      transition: none;
    }
  }
</style>
