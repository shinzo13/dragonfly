<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { tick } from "svelte";
  import { lists } from "#lib/api/lists.js";
  import { addDays, today } from "#lib/dates.js";
  import { period } from "#lib/period.svelte.js";
  import { session } from "#lib/session.svelte.js";
  import {
    kindOf,
    operatorSuggestions,
    operatorsQuery,
    replaceToken,
    type Suggestion,
    TYPES,
    tokenAt,
    type ValueKind,
    valueSuggestions,
  } from "#lib/transactions/query.js";
  import SuggestInput from "./SuggestInput.svelte";

  let {
    value = $bindable(""),
    input = $bindable(),
    onsubmit,
    id = "query",
    placeholder = "Search transactions, e.g. category_is:Groceries amount_more:20",
    class: className = "",
  }: {
    value?: string;
    input?: HTMLInputElement;
    onsubmit: (query: string) => void;
    id?: string;
    placeholder?: string;
    class?: string;
  } = $props();

  let caret = $state(0);
  let used = $state(false);

  const operators = createQuery(() => ({ ...operatorsQuery(), enabled: used }));
  const categories = createQuery(() => ({
    ...lists.categories(),
    enabled: used,
  }));
  const budgets = createQuery(() => ({ ...lists.budgets(), enabled: used }));
  const tags = createQuery(() => ({ ...lists.tags(), enabled: used }));
  const bills = createQuery(() => ({ ...lists.bills(), enabled: used }));
  const accounts = createQuery(() => ({
    ...lists.accounts("all"),
    enabled: used,
  }));

  function dateValues(): [string[], Record<string, string>] {
    const now = today();
    const hints: Record<string, string> = {
      [addDays(now, -1)]: "yesterday",
      [now]: "today",
      [period.end]: "period end",
      [period.start]: "period start",
    };
    return [
      [
        "today",
        "yesterday",
        "start of this month",
        "end of this month",
        "start of this year",
        period.start,
        period.end,
        now,
        "-7d",
        "-1m",
      ],
      hints,
    ];
  }

  function names<T>(
    items: { attributes: T }[] | undefined,
    pick: (attributes: T) => string | null | undefined
  ): string[] {
    return (items ?? [])
      .map((item) => pick(item.attributes))
      .filter((name): name is string => Boolean(name));
  }

  function values(kind: ValueKind): [string[], Record<string, string>] {
    switch (kind) {
      case "category":
        return [names(categories.data, (c) => c.name), {}];
      case "budget":
        return [names(budgets.data, (b) => b.name), {}];
      case "tag":
        return [names(tags.data, (t) => t.tag), {}];
      case "bill":
        return [names(bills.data, (b) => b.name), {}];
      case "account":
        return [names(accounts.data, (a) => a.name), {}];
      case "currency":
        return [names(session.currencies, (c) => c.code), {}];
      case "type":
        return [TYPES, {}];
      case "bool":
        return [["true", "false"], {}];
      case "date":
        return dateValues();
      default:
        return [[], {}];
    }
  }

  const token = $derived(tokenAt(value, caret));
  const suggestions = $derived.by<Suggestion[]>(() => {
    if (token.field === null) {
      return operatorSuggestions(operators.data ?? [], token);
    }
    const [list, hints] = values(kindOf(token.field));
    return valueSuggestions(token, list, hints);
  });

  async function accept(item: Suggestion): Promise<void> {
    const { caret: position, text } = replaceToken(value, token, item.insert);
    value = text;
    caret = position;
    await tick();
    input?.setSelectionRange(position, position);
  }

  function onaccept(item: Suggestion) {
    const current = value.slice(token.start, token.end);
    if (current === item.insert.trimEnd() && item.insert.endsWith(" ")) {
      return false;
    }
    accept(item);
    return true;
  }
</script>

<SuggestInput
  class={className}
  {id}
  {onaccept}
  onfocus={() => (used = true)}
  onsubmit={() => onsubmit(value.trim())}
  {placeholder}
  {suggestions}
  bind:caret
  bind:input
  bind:value
/>
