import { ApiError } from "#lib/api/client.js";

const UNAUTHORIZED = 401;
const ARM_MS = 3000;

export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === UNAUTHORIZED) {
      return "Only the owner can do this";
    }
    return Object.values(error.errors)[0]?.[0] ?? error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export class Action {
  busy = $state(false);
  message = $state("");
  failed = $state(false);
  errors = $state<Record<string, string[]>>({});

  async run(task: () => Promise<unknown>, done = "Saved"): Promise<boolean> {
    this.busy = true;
    this.message = "";
    this.failed = false;
    this.errors = {};
    try {
      await task();
      this.message = done;
      return true;
    } catch (error) {
      this.failed = true;
      this.message = errorText(error);
      this.errors = error instanceof ApiError ? error.errors : {};
      return false;
    } finally {
      this.busy = false;
    }
  }

  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }

  reset() {
    this.message = "";
    this.failed = false;
  }
}

export class Arm {
  key = $state<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  press(key: string, run: () => unknown) {
    clearTimeout(this.timer);
    if (this.key === key) {
      this.key = null;
      return run();
    }
    this.key = key;
    this.timer = setTimeout(() => {
      this.key = null;
    }, ARM_MS);
  }
}
