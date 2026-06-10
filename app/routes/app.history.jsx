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
  Thumbnail,
  EmptyState,
  Box,
} from "@shopify/polaris";
import { useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";
import { getAllGenerations, maintainGenerations } from "../models/generation.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await maintainGenerations(session.shop);
  const generations = await getAllGenerations(session.shop);
  return json({ generations });
};

const statusTone = {
  done: "success",
  pending: "attention",
  processing: "info",
  failed: "critical",
};

const dateLocales = { tr: "tr-TR", en: "en-US" };

export default function History() {
  const { generations } = useLoaderData();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const dateLocale = dateLocales[i18n.language] || "en-US";

  if (generations.length === 0) {
    return (
      <Page title={t("history.pageTitle")} backAction={{ url: "/app" }}>
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading={t("history.empty.heading")}
                action={{ content: t("history.empty.action"), onAction: () => navigate("/app/generate") }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>{t("history.empty.body")}</p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title={t("history.pageTitle")} backAction={{ url: "/app" }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {generations.map((gen) => {
              const outputs = JSON.parse(gen.outputs || "[]");
              const tone = statusTone[gen.status] || statusTone.pending;
              const label = t(`history.status.${gen.status}`, { defaultValue: t("history.status.pending") });

              return (
                <Card key={gen.id}>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text as="p" fontWeight="semibold">
                          {gen.productTitle}
                        </Text>
                        <InlineStack gap="200" blockAlign="center">
                          {gen.photoSetLabel && (
                            <Badge tone="info">{gen.photoSetLabel}</Badge>
                          )}
                          <Text as="p" tone="subdued" variant="bodySm">
                            {new Date(gen.createdAt).toLocaleDateString(dateLocale, {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </InlineStack>
                      </BlockStack>
                      <Badge tone={tone}>{label}</Badge>
                    </InlineStack>

                    {outputs.length > 0 && (
                      <InlineStack gap="200" wrap>
                        {outputs.map((output, i) => (
                          <Box key={i} borderRadius="150" overflow="hidden">
                            <Thumbnail
                              source={output.url}
                              alt={output.scene}
                              size="medium"
                            />
                          </Box>
                        ))}
                      </InlineStack>
                    )}
                  </BlockStack>
                </Card>
              );
            })}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
