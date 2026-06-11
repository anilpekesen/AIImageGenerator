import { redirect } from "@remix-run/node";

export const loader = async ({ params }) => {
  const filename = params.filename || "";

  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    throw new Response("Not found", { status: 404 });
  }

  return redirect(`/images/logo/${filename}`, 301);
};
