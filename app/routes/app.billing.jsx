import { useLoaderData, useSubmit } from "@remix-run/react";
import { json } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  List,
  Divider,
  Banner,
} from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate, PLANS } from "../shopify.server";
import { getOrCreateSubscription } from "../models/subscription.server";

export const loader = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);
  const subscription = await getOrCreateSubscription(session.shop);

  let activeSubscription = null;
  try {
    const { hasActivePayment, appSubscriptions } = await billing.check({
      plans: [PLANS.BASIC.shopifyPlanName, PLANS.PRO.shopifyPlanName],
      isTest: true,
    });
    if (hasActivePayment && appSubscriptions.length > 0) {
      activeSubscription = appSubscriptions[0];
    }
  } catch {}

  return json({ subscription, activeSubscription });
};

export const action = async ({ request }) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const planKey = formData.get("plan");

  const planName =
    planKey === "basic"
      ? PLANS.BASIC.shopifyPlanName
      : PLANS.PRO.shopifyPlanName;

  await billing.request({
    plan: planName,
    isTest: true,
    returnUrl: `${process.env.SHOPIFY_APP_URL}/app/billing`,
  });

  return null;
};

const planFeatures = {
  free: [
    "10 üretim/ay",
    "6 otomatik sahne",
    "Temel destek",
  ],
  basic: [
    "100 üretim/ay",
    "6 otomatik sahne",
    "Öncelikli destek",
    "Toplu indirme",
  ],
  pro: [
    "500 üretim/ay",
    "6 otomatik sahne",
    "7/24 öncelikli destek",
    "Toplu indirme",
    "Özel prompt desteği",
    "API erişimi",
  ],
};

export default function Billing() {
  const { subscription, activeSubscription } = useLoaderData();
  const submit = useSubmit();

  const currentPlan = subscription.plan;

  const handleUpgrade = (plan) => {
    const formData = new FormData();
    formData.append("plan", plan);
    submit(formData, { method: "post" });
  };

  return (
    <Page title="Abonelik Planları" backAction={{ url: "/app" }}>
      <Layout>
        {currentPlan !== "free" && (
          <Layout.Section>
            <Banner title="Aktif Abonelik" tone="success">
              <p>
                Şu an <strong>{currentPlan === "basic" ? "Basic" : "Pro"}</strong> planındasınız.
                Bu ay {subscription.usedCount}/{subscription.limitCount} üretim kullandınız.
              </p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineStack gap="400" align="start" wrap={false}>
            {/* Free Plan */}
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingLg">Ücretsiz</Text>
                    {currentPlan === "free" && <Badge tone="info">Mevcut Plan</Badge>}
                  </InlineStack>
                  <Text as="p" variant="headingXl" fontWeight="bold">$0</Text>
                  <Text as="p" tone="subdued">aylık</Text>
                </BlockStack>

                <Divider />

                <List type="bullet">
                  {planFeatures.free.map((f) => (
                    <List.Item key={f}>{f}</List.Item>
                  ))}
                </List>

                <Button disabled={currentPlan === "free"} fullWidth>
                  {currentPlan === "free" ? "Mevcut Planınız" : "Düşür"}
                </Button>
              </BlockStack>
            </Card>

            {/* Basic Plan */}
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingLg">Basic</Text>
                    {currentPlan === "basic" && <Badge tone="success">Aktif</Badge>}
                  </InlineStack>
                  <Text as="p" variant="headingXl" fontWeight="bold">$9.99</Text>
                  <Text as="p" tone="subdued">aylık</Text>
                </BlockStack>

                <Divider />

                <List type="bullet">
                  {planFeatures.basic.map((f) => (
                    <List.Item key={f}>{f}</List.Item>
                  ))}
                </List>

                <Button
                  variant={currentPlan === "basic" ? "secondary" : "primary"}
                  onClick={() => handleUpgrade("basic")}
                  disabled={currentPlan === "basic"}
                  fullWidth
                >
                  {currentPlan === "basic" ? "Mevcut Planınız" : "Basic'e Geç"}
                </Button>
              </BlockStack>
            </Card>

            {/* Pro Plan */}
            <Card background="bg-fill-brand">
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingLg">Pro</Text>
                    <InlineStack gap="100">
                      <Badge tone="attention">Popüler</Badge>
                      {currentPlan === "pro" && <Badge tone="success">Aktif</Badge>}
                    </InlineStack>
                  </InlineStack>
                  <Text as="p" variant="headingXl" fontWeight="bold">$29.99</Text>
                  <Text as="p" tone="subdued">aylık</Text>
                </BlockStack>

                <Divider />

                <List type="bullet">
                  {planFeatures.pro.map((f) => (
                    <List.Item key={f}>{f}</List.Item>
                  ))}
                </List>

                <Button
                  variant="primary"
                  onClick={() => handleUpgrade("pro")}
                  disabled={currentPlan === "pro"}
                  fullWidth
                >
                  {currentPlan === "pro" ? "Mevcut Planınız" : "Pro'ya Geç"}
                </Button>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
