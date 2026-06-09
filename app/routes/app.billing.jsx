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
  InlineGrid,
  Badge,
  List,
  Divider,
  Banner,
  Box,
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
      plans: [
        PLANS.SOLO.shopifyPlanName,
        PLANS.PRO.shopifyPlanName,
        PLANS.PREMIUM.shopifyPlanName,
      ],
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

  const planMap = {
    solo: PLANS.SOLO.shopifyPlanName,
    pro: PLANS.PRO.shopifyPlanName,
    premium: PLANS.PREMIUM.shopifyPlanName,
  };

  const planName = planMap[planKey];
  if (!planName) return json({ error: "Invalid plan" }, { status: 400 });

  await billing.request({
    plan: planName,
    isTest: true,
    returnUrl: `${process.env.SHOPIFY_APP_URL}/app/billing`,
  });

  return null;
};

const PLAN_ORDER = ["free", "solo", "pro", "premium"];

const popularPillStyle = {
  position: "absolute",
  top: 0,
  left: "50%",
  transform: "translate(-50%, -50%)",
  background: "var(--p-color-bg-fill-brand)",
  color: "white",
  padding: "3px 14px",
  borderRadius: "100px",
  fontSize: "12px",
  fontWeight: "650",
  whiteSpace: "nowrap",
  zIndex: 1,
};

const popularWrapperStyle = {
  borderRadius: "12px",
  outline: "2px solid var(--p-color-border-brand)",
};

export default function Billing() {
  const { subscription } = useLoaderData();
  const submit = useSubmit();
  const { t } = useTranslation();

  const currentPlan = subscription.plan;
  const currentIndex = PLAN_ORDER.indexOf(currentPlan);

  const handleUpgrade = (plan) => {
    const formData = new FormData();
    formData.append("plan", plan);
    submit(formData, { method: "post" });
  };

  const getPlanButton = (planKey, planIndex) => {
    if (currentPlan === planKey) {
      return (
        <Button disabled fullWidth>
          {t("billing.buttons.currentPlan")}
        </Button>
      );
    }
    if (planKey === "free") {
      return (
        <Button disabled fullWidth>
          {t("billing.buttons.downgrade")}
        </Button>
      );
    }
    const isUpgrade = planIndex > currentIndex;
    return (
      <Button
        variant={isUpgrade ? "primary" : "secondary"}
        onClick={() => handleUpgrade(planKey)}
        fullWidth
      >
        {isUpgrade
          ? t(`billing.buttons.upgradeTo.${planKey}`)
          : t("billing.buttons.downgrade")}
      </Button>
    );
  };

  const plans = [
    { key: "free",    price: "$0",      index: 0, highlight: false },
    { key: "solo",    price: "$29.99",  index: 1, highlight: false },
    { key: "pro",     price: "$129.99", index: 2, highlight: true  },
    { key: "premium", price: "$299.99", index: 3, highlight: false },
  ];

  const planNameDisplay = {
    free:    t("billing.plans.free.name"),
    solo:    t("billing.plans.solo.name"),
    pro:     t("billing.plans.pro.name"),
    premium: t("billing.plans.premium.name"),
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
                    plan: planNameDisplay[currentPlan] || currentPlan,
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
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            {plans.map(({ key, price, index, highlight }) => {
              const features = t(`billing.plans.${key}.features`, { returnObjects: true });
              const isActive = currentPlan === key;

              const cardInner = (
                <Card>
                  <BlockStack gap="400">
                    <BlockStack gap="100">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="h2" variant="headingLg">
                          {t(`billing.plans.${key}.name`)}
                        </Text>
                        {isActive && (
                          <Badge tone="success">{t("billing.badges.active")}</Badge>
                        )}
                        {!isActive && key === "free" && currentPlan === "free" && (
                          <Badge tone="info">{t("billing.badges.currentPlan")}</Badge>
                        )}
                      </InlineStack>
                      <Text as="p" variant="headingXl" fontWeight="bold">{price}</Text>
                      <Text as="p" tone="subdued">{t("billing.perMonth")}</Text>
                    </BlockStack>

                    <Divider />

                    <List type="bullet">
                      {Array.isArray(features) && features.map((f) => (
                        <List.Item key={f}>{f}</List.Item>
                      ))}
                    </List>

                    <Box paddingBlockStart="200">
                      {getPlanButton(key, index)}
                    </Box>
                  </BlockStack>
                </Card>
              );

              if (highlight) {
                return (
                  <div key={key} style={{ position: "relative" }}>
                    <div style={popularPillStyle}>
                      ⭐ {t("billing.badges.popular")}
                    </div>
                    <div style={popularWrapperStyle}>
                      {cardInner}
                    </div>
                  </div>
                );
              }

              return <div key={key}>{cardInner}</div>;
            })}
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingMd">{t("billing.costNote.heading")}</Text>
              <Text as="p" tone="subdued" variant="bodySm">
                {t("billing.costNote.body")}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
