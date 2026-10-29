import { ApiError } from "#lib/api/client.js";

export const SELECT_CLASS =
  "cladd-cut cladd-hoverable cladd-focusable-input h-cladd-md w-full rounded-cladd-md px-2 text-cladd-xs font-medium text-cladd-fg";

export function fieldErrors(failure: unknown): Record<string, string> {
  if (!(failure instanceof ApiError)) {
    return {
      form: failure instanceof Error ? failure.message : String(failure),
    };
  }
  const errors: Record<string, string> = {};
  for (const [key, value] of Object.entries(failure.errors)) {
    errors[key] = value[0] ?? "";
  }
  if (Object.keys(errors).length === 0) {
    errors.form = failure.message;
  }
  return errors;
}
