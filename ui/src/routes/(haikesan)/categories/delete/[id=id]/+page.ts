import { redirect } from "@sveltejs/kit";

export function load({ params }: { params: { id: string } }) {
  redirect(307, `/categories/edit/${params.id}`);
}
