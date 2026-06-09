import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getGenerationById } from "../models/generation.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) return json({ status: "not_found" }, { status: 400 });

  const generation = await getGenerationById(id, session.shop);
  if (!generation) return json({ status: "not_found" }, { status: 404 });

  if (generation.status === "done") {
    return json({ status: "done", outputs: JSON.parse(generation.outputs || "[]") });
  }

  return json({ status: generation.status });
};
