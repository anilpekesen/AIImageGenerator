import { authenticate } from "../shopify.server";
import { localeCookie } from "../i18n-cookie.server";
import i18n from "../i18n";

export const action = async ({ request }) => {
  await authenticate.admin(request);

  const formData = await request.formData();
  const locale = formData.get("locale");

  if (!i18n.supportedLngs.includes(locale)) {
    return new Response(null, { status: 400 });
  }

  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": await localeCookie.serialize(locale) },
  });
};
