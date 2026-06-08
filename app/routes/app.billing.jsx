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
import { Trans, useTranslation } from "react-i18next";
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

export default function Billing() {
  const { subscription, activeSubscription } = useLoaderData();
  const submit = useSubmit();
  const { t } = useTranslation();

  const currentPlan = subscription.plan;
  const planFeatures = {
    free: t("billing.plans.free.features", { returnObjects: true }),
    basic: t("billing.plans.basic.features", { returnObjects: true }),
    pro: t("billing.plans.pro.features", { returnObjects: true }),
  };

  const handleUpgrade = (plan) => {
    const formData = new FormData();
    formData.append("plan", plan);
    submit(formData, { method: "post" });
  };

  return (
    <Page title={t("billing.pageTitle")} backAction={{ url: "/app" }}>
      <Layout>
        {currentPlan !== "free" && (
          <Layout.Section>
            <Banner title={t("billing.activeBanner.title")} tone="success">
              <p>
                <Trans
                  i18nKey="billing.activeBanner.body"
                  values={{
                    plan: currentPlan === "basic" ? t("billing.plans.basic.name") : t("billing.plans.pro.name"),
                    used: subscription.usedCount,
                    limit: subscription.limitCount,
                  }}
                  components={{ strong: <strong /> }}
                />
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
                    <Text as="h2" variant="headingLg">{t("billing.plans.free.name")}</Text>
                    {currentPlan === "free" && <Badge tone="info">{t("billing.badges.currentPlan")}</Badge>}
                  </InlineStack>
                  <Text as="p" variant="headingXl" fontWeight="bold">$0</Text>
                  <Text as="p" tone="subdued">{t("billing.perMonth")}</Text>
                </BlockStack>

                <Divider />

                <List type="bullet">
                  {planFeatures.free.map((f) => (
                    <List.Item key={f}>{f}</List.Item>
                  ))}
                </List>

                <Button disabled={currentPlan === "free"} fullWidth>
                  {currentPlan === "free" ? t("billing.buttons.currentPlan") : t("billing.buttons.downgrade")}
                </Button>
              </BlockStack>
            </Card>

            {/* Basic Plan */}
            <Card>
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingLg">{t("billing.plans.basic.name")}</Text>
                    {currentPlan === "basic" && <Badge tone="success">{t("billing.badges.active")}</Badge>}
                  </InlineStack>
                  <Text as="p" variant="headingXl" fontWeight="bold">$9.99</Text>
                  <Text as="p" tone="subdued">{t("billing.perMonth")}</Text>
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
                  {currentPlan === "basic" ? t("billing.buttons.currentPlan") : t("billing.buttons.switchToBasic")}
                </Button>
              </BlockStack>
            </Card>

            {/* Pro Plan */}
            <Card background="bg-fill-brand">
              <BlockStack gap="400">
                <BlockStack gap="100">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingLg">{t("billing.plans.pro.name")}</Text>
                    <InlineStack gap="100">
                      <Badge tone="attention">{t("billing.badges.popular")}</Badge>
                      {currentPlan === "pro" && <Badge tone="success">{t("billing.badges.active")}</Badge>}
                    </InlineStack>
                  </InlineStack>
                  <Text as="p" variant="headingXl" fontWeight="bold">$29.99</Text>
                  <Text as="p" tone="subdued">{t("billing.perMonth")}</Text>
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
                  {currentPlan === "pro" ? t("billing.buttons.currentPlan") : t("billing.buttons.switchToPro")}
                </Button>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
