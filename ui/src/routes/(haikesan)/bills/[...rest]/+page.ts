import { redirect } from "@sveltejs/kit";

export function load({ params, url }) {
  const rest = params.rest ? `/${params.rest}` : "";
  redirect(307, `/subscriptions${rest}${url.search}`);
}
