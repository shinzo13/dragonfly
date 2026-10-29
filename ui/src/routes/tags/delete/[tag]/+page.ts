import { redirect } from "@sveltejs/kit";

export function load({ params }: { params: { tag: string } }) {
  redirect(307, `/tags/edit/${encodeURIComponent(params.tag)}`);
}
