import type { Form } from "./model.js";

let pending: Form | null = null;

export function setDraft(form: Form) {
  pending = form;
}

export function takeDraft(): Form | null {
  const draft = pending;
  pending = null;
  return draft;
}
