<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { invalidate } from "#lib/api/lists.js";
  import { Action } from "#lib/components/misc/action.svelte.js";
  import { misc } from "#lib/components/misc/queries.js";
  import { muted, select } from "#lib/components/misc/styles.js";
  import Input from "#lib/components/ui/input/input.svelte";
  import { today } from "#lib/dates.js";
  import { session } from "#lib/session.svelte.js";
  import Section from "./Section.svelte";

  type Languages = Record<
    string,
    { name_english: string; name_locale: string }
  >;

  const FIELD_GROUPS = [
    {
      fields: [
        ["interest_date", "Interest date"],
        ["book_date", "Book date"],
        ["process_date", "Processing date"],
        ["due_date", "Due date"],
        ["payment_date", "Payment date"],
        ["invoice_date", "Invoice date"],
      ],
      label: "Date fields",
    },
    {
      fields: [
        ["internal_reference", "Internal reference"],
        ["external_url", "External URL"],
        ["notes", "Notes"],
        ["location", "Location"],
        ["links", "Transaction links"],
      ],
      label: "Other fields",
    },
    { fields: [["attachments", "Attachments"]], label: "Attachment fields" },
  ];
  const SAMPLE_AMOUNT = 1_234_567.89;

  const languages = createQuery(() => misc.config("firefly.languages"));
  const exchange = createQuery(() =>
    misc.config("configuration.enable_exchange_rates")
  );
  const options = $derived(Object.entries((languages.data ?? {}) as Languages));

  const on = (value: unknown) => value === true || value === 1 || value === "1";
  const { prefs } = session;
  const year = today().slice(0, 4);

  let language = $state(String(prefs.language ?? "en_US"));
  let locale = $state(String(prefs.locale ?? "equal"));
  let fiscal = $state(on(prefs.customFiscalYear));
  let fiscalStart = $state(
    `${year}-${String(prefs.fiscalYearStart ?? "01-01")}`
  );
  let primary = $state(on(prefs.convert_to_primary));
  let anonymous = $state(on(prefs.anonymous));
  const optional = $state<Record<string, boolean>>({
    ...((prefs.transaction_journal_optional_fields ?? {}) as Record<
      string,
      boolean
    >),
  });

  const names = new Intl.DisplayNames(["en"], { type: "language" });
  const nameOf = (key: string) => {
    try {
      return names.of(key.replace("_", "-")) ?? key;
    } catch {
      return key;
    }
  };

  const sample = $derived.by(() => {
    const tag = (locale === "equal" ? language : locale).replace("_", "-");
    try {
      const number = new Intl.NumberFormat(tag, {
        minimumFractionDigits: 2,
      }).format(SAMPLE_AMOUNT);
      const date = new Intl.DateTimeFormat(tag, { dateStyle: "medium" }).format(
        new Date()
      );
      return `${number} · ${date}`;
    } catch {
      return "";
    }
  });

  const languageAction = new Action();
  const localeAction = new Action();
  const fiscalAction = new Action();
  const primaryAction = new Action();
  const anonymousAction = new Action();
  const fieldsAction = new Action();

  const saveFiscal = () =>
    fiscalAction.run(async () => {
      await session.setPreference("customFiscalYear", fiscal);
      await session.setPreference("fiscalYearStart", fiscalStart.slice(5));
    });

  const savePrimary = () =>
    primaryAction.run(async () => {
      await session.setPreference("convert_to_primary", primary);
      await invalidate();
    });

  const saveAnonymous = () =>
    anonymousAction.run(async () => {
      await session.setPreference("anonymous", anonymous);
      await invalidate();
    });
</script>

<div class="grid items-start gap-4 lg:grid-cols-2">
  <div class="flex flex-col gap-4">
    <Section
      action={languageAction}
      help="Firefly III supports several languages. Which one do you prefer?"
      onsave={() =>
        languageAction.run(() => session.setPreference("language", language))}
      title="Languages"
    >
      <select aria-label="Language" class={select} bind:value={language}>
        {#if !options.some(([key]) => key === language)}
          <option value={language}>{language}</option>
        {/if}
        {#each options as [key, lang] (key)}
          <option value={key}>{lang.name_locale} ({lang.name_english})</option>
        {/each}
      </select>
    </Section>

    <Section
      action={localeAction}
      help="How numbers and dates are formatted."
      onsave={() =>
        localeAction.run(() => session.setPreference("locale", locale))}
      title="Locale settings"
    >
      <select aria-label="Locale" class={select} bind:value={locale}>
        <option value="equal">(equal to language)</option>
        {#if locale !== "equal" && !options.some(([key]) => key === locale)}
          <option value={locale}>{nameOf(locale)}</option>
        {/if}
        {#each options as [key] (key)}
          <option value={key}>{nameOf(key)}</option>
        {/each}
      </select>
      {#if sample}
        <p class="mt-2 {muted}">Looks like <span class="num">{sample}</span></p>
      {/if}
    </Section>

    <Section
      action={fiscalAction}
      help="In countries that use a financial year other than January 1 to December 31, you can switch this on and specify start / end days of the fiscal year."
      onsave={saveFiscal}
      title="Fiscal year settings"
    >
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
        <label class="flex items-center gap-2">
          <input
            class="size-3.5 accent-brand"
            type="checkbox"
            bind:checked={fiscal}
          >
          Enabled
        </label>
        <span class="flex items-center gap-2">
          <label for="fiscal-start">Fiscal year start date</label>
          <Input
            class="num w-40"
            disabled={!fiscal}
            id="fiscal-start"
            type="date"
            bind:value={fiscalStart}
          />
        </span>
      </div>
    </Section>

    <Section
      action={primaryAction}
      help="Show amounts converted to your primary currency in as many places as possible. Conversion is not always exact."
      onsave={savePrimary}
      title="Display amounts in your primary currency"
    >
      <label class="flex items-center gap-2">
        <input
          class="size-3.5 accent-brand"
          type="checkbox"
          bind:checked={primary}
        >
        Display primary amounts
      </label>
      {#if exchange.data === false}
        <p class="mt-2 {muted}">
          Exchange rates are switched off in the Firefly III configuration, so
          this has no effect yet.
        </p>
      {/if}
    </Section>

    <Section
      action={anonymousAction}
      help="Hide all amounts, except in edit boxes. The eye icon in the top bar does the same."
      onsave={saveAnonymous}
      title="Hidden amounts"
    >
      <label class="flex items-center gap-2">
        <input
          class="size-3.5 accent-brand"
          type="checkbox"
          bind:checked={anonymous}
        >
        Hide amounts
      </label>
    </Section>
  </div>

  <Section
    action={fieldsAction}
    help="Not all fields are shown when you create a transaction. Turn on the ones you use. A field that already has a value is always shown."
    onsave={() =>
      fieldsAction.run(() =>
        session.setPreference("transaction_journal_optional_fields", {
          ...Object.fromEntries(
            FIELD_GROUPS.flatMap((g) => g.fields).map(([key]) => [key, false])
          ),
          ...optional,
        })
      )}
    title="Optional fields for transactions"
  >
    <div class="flex flex-col gap-4">
      {#each FIELD_GROUPS as group (group.label)}
        <fieldset class="flex flex-col gap-1.5">
          <legend class="mb-1.5 font-semibold text-[13px]">
            {group.label}
          </legend>
          {#each group.fields as [key, label] (key)}
            <label class="flex items-center gap-2">
              <input
                class="size-3.5 accent-brand"
                type="checkbox"
                bind:checked={optional[key]}
              >
              {label}
            </label>
          {/each}
        </fieldset>
      {/each}
    </div>
  </Section>
</div>
