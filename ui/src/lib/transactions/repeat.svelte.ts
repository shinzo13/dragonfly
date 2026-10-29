import type { MassAction } from "./mass.js";

export const lastAction = $state<{ current: MassAction | null }>({
  current: null,
});
