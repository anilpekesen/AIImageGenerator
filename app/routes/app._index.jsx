import { useLoaderData, useNavigate } from "@remix-run/react";
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
  ProgressBar,
  Banner,
  Divider,
  Box,
  Icon,
} from "@shopify/polaris";
import { ImageIcon, ClockIcon, StarIcon } from "@shopify/polaris-icons";
import { Trans, useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";
import { getOrCreateSubscription } from "../models/subscription.server";
import { getRecentGenerations } from "../models/generation.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  const [subscription, recentGenerations] = await Promise.all([
    getOrCreateSubscription(shop),
    getRecentGenerations(shop, 3),
  ]);

  return json({ subscription, recentGenerations, shop });
};

export default function Index() {
  const { subscription, recentGenerations } = useLoaderData();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const usagePercent = Math.round(
    (subscription.usedCount / subscription.limitCount) * 100
  );
  const remaining = subscription.limitCount - subscription.usedCount;
  const planLabel = t(`dashboard.plan.${subscription.plan}`, {
    defaultValue: subscription.plan,
  });

  return (
    <Page title={t("dashboard.pageTitle")}>
      <Layout>
        <Layout.Section>
          <Banner
            title={t("dashboard.banner.title")}
            tone="info"
            action={{ content: t("dashboard.banner.action"), onAction: () => navigate("/app/generate") }}
          >
            <p>
              <Trans i18nKey="dashboard.banner.body" components={{ strong: <strong /> }} />
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  {t("dashboard.planStatus.heading")}
                </Text>
                <Badge tone={subscription.plan === "free" ? "attention" : "success"}>
                  {planLabel}
                </Badge>
              </InlineStack>

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued">
                    {t("dashboard.planStatus.usedThisMonth")}
                  </Text>
                  <Text as="p" fontWeight="semibold">
                    {t("dashboard.planStatus.usageCount", {
                      used: subscription.usedCount,
                      limit: subscription.limitCount,
                    })}
                  </Text>
                </InlineStack>
                <ProgressBar
                  progress={usagePercent}
                  tone={usagePercent >= 90 ? "critical" : usagePercent >= 70 ? "warning" : "success"}
                />
                <Text as="p" tone="subdued" variant="bodySm">
                  {t("dashboard.planStatus.remaining", { count: remaining })}
                </Text>
              </BlockStack>

              {subscription.plan === "free" && (
                <>
                  <Divider />
                  <Button
                    variant="primary"
                    onClick={() => navigate("/app/billing")}
                  >
                    {t("dashboard.planStatus.upgrade")}
                  </Button>
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">
                  {t("dashboard.why.heading")}
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  <Trans i18nKey="dashboard.why.description" components={{ strong: <strong /> }} />
                </Text>
              </BlockStack>

              <BlockStack gap="300">
                <InlineStack gap="300" blockAlign="center">
                  <Box
                    background="bg-fill-info"
                    padding="200"
                    borderRadius="200"
                  >
                    <Icon source={ImageIcon} tone="info" />
                  </Box>
                  <BlockStack gap="050">
                    <Text as="p" fontWeight="semibold">
                      {t("dashboard.why.feature1.title")}
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      {t("dashboard.why.feature1.description")}
                    </Text>
                  </BlockStack>
                </InlineStack>

                <InlineStack gap="300" blockAlign="center">
                  <Box
                    background="bg-fill-success"
                    padding="200"
                    borderRadius="200"
                  >
                    <Icon source={StarIcon} tone="success" />
                  </Box>
                  <BlockStack gap="050">
                    <Text as="p" fontWeight="semibold">
                      {t("dashboard.why.feature2.title")}
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      {t("dashboard.why.feature2.description")}
                    </Text>
                  </BlockStack>
                </InlineStack>

                <InlineStack gap="300" blockAlign="center">
                  <Box
                    background="bg-fill-warning"
                    padding="200"
                    borderRadius="200"
                  >
                    <Icon source={ClockIcon} tone="warning" />
                  </Box>
                  <BlockStack gap="050">
                    <Text as="p" fontWeight="semibold">
                      {t("dashboard.why.feature3.title")}
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      {t("dashboard.why.feature3.description")}
                    </Text>
                  </BlockStack>
                </InlineStack>
              </BlockStack>

              <Button
                variant="primary"
                size="large"
                onClick={() => navigate("/app/generate")}
                disabled={remaining <= 0}
              >
                {remaining <= 0 ? t("dashboard.why.ctaLimitReached") : t("dashboard.why.cta")}
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {recentGenerations.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    {t("dashboard.recent.heading")}
                  </Text>
                  <Button variant="plain" onClick={() => navigate("/app/history")}>
                    {t("dashboard.recent.viewAll")}
                  </Button>
                </InlineStack>

                <InlineStack gap="300" wrap={false}>
                  {recentGenerations.map((gen) => {
                    const outputs = JSON.parse(gen.outputs || "[]");
                    const firstImage = outputs[0]?.url;
                    return (
                      <Box
                        key={gen.id}
                        background="bg-fill-secondary"
                        borderRadius="200"
                        padding="200"
                        minWidth="120px"
                      >
                        {firstImage ? (
                          <img
                            src={firstImage}
                            alt={gen.productTitle}
                            width="120"
                            height="80"
                            loading="lazy"
                            decoding="async"
                            style={{
                              width: "100%",
                              height: "80px",
                              objectFit: "cover",
                              borderRadius: "8px",
                            }}
                          />
                        ) : (
                          <Box
                            minHeight="80px"
                            background="bg-fill-tertiary"
                            borderRadius="150"
                          />
                        )}
                        <Text as="p" variant="bodySm" truncate>
                          {gen.productTitle}
                        </Text>
                      </Box>
                    );
                  })}
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
