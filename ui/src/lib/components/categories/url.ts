import { goto } from "$app/navigation";
import { page } from "$app/state";

export function setParam(name: string, value: string) {
  const url = new URL(page.url.href);
  if (value) {
    url.searchParams.set(name, value);
  } else {
    url.searchParams.delete(name);
  }
  url.searchParams.delete("page");
  return goto(url, { replace: true, reset: false, state: page.state });
}
