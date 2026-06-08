import { useState, useCallback } from "react";
import { useSubmit, useNavigation, useActionData, useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Banner,
  Spinner,
  Thumbnail,
  Badge,
  Box,
  Link,
  Divider,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";
import { searchCompetitorPrices } from "../services/serp-search.server";
import { summarizeCompetitors } from "../services/ai-text.server";
import { createCompetitorAnalysis } from "../models/competitor-analysis.server";
import { fetchProductBasicInfo } from "../services/product.server";
import i18next from "../i18next.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");

  const preselectedProduct = productId
    ? await fetchProductBasicInfo(admin, productId)
    : null;

  return json({ preselectedProduct });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const locale = await i18next.getLocale(request);
  const t = await i18next.getFixedT(locale);
  const formData = await request.formData();

  const productId = formData.get("productId");
  const productTitle = formData.get("productTitle");

  if (!productTitle) {
    return json({ error: t("competition.errors.titleMissing") }, { status: 400 });
  }

  const query = productTitle;

  try {
    const results = await searchCompetitorPrices(query, { country: locale === "tr" ? "tr" : "us" });

    if (results.length === 0) {
      return json({ error: t("competition.errors.noResults") }, { status: 200 });
    }

    const aiSummary = await summarizeCompetitors(productTitle, results);

    await createCompetitorAnalysis({
      shop: session.shop,
      productId,
      productTitle,
      query,
      results,
      aiSummary,
    });

    return json({ success: true, results, aiSummary, productTitle });
  } catch (error) {
    return json({ error: t("competition.errors.analysisFailed", { message: error.message }) }, { status: 500 });
  }
};

export default function Competition() {
  const { preselectedProduct } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const actionData = useActionData();
  const shopify = useAppBridge();
  const { t } = useTranslation();

  const [selectedProduct, setSelectedProduct] = useState(preselectedProduct);
  const isAnalyzing = navigation.state === "submitting";

  const handleProductPick = useCallback(async () => {
    const selected = await shopify.resourcePicker({
      type: "product",
      action: "select",
      multiple: false,
      selectionIds: selectedProduct ? [{ id: selectedProduct.id }] : [],
    });

    if (selected?.selection?.length > 0) {
      const product = selected.selection[0];
      setSelectedProduct({
        id: product.id.replace("gid://shopify/Product/", ""),
        title: product.title,
        image: product.images[0]?.originalSrc,
      });
    }
  }, [shopify, selectedProduct]);

  const handleAnalyze = useCallback(() => {
    if (!selectedProduct) return;

    const formData = new FormData();
    formData.append("productId", selectedProduct.id);
    formData.append("productTitle", selectedProduct.title);
    submit(formData, { method: "post" });
  }, [selectedProduct, submit]);

  return (
    <Page
      title={t("competition.pageTitle")}
      subtitle={t("competition.pageSubtitle")}
      backAction={{ url: "/app" }}
    >
      <Layout>
        {actionData?.error && (
          <Layout.Section>
            <Banner title={t("competition.resultBanner.title")} tone="warning">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">{t("competition.step1.heading")}</Text>

              {selectedProduct ? (
                <InlineStack gap="300" blockAlign="center">
                  {selectedProduct.image && (
                    <Thumbnail source={selectedProduct.image} alt={selectedProduct.title} size="medium" />
                  )}
                  <BlockStack gap="100">
                    <Text as="p" fontWeight="semibold">{selectedProduct.title}</Text>
                    <Badge tone="success">{t("competition.step1.selected")}</Badge>
                  </BlockStack>
                </InlineStack>
              ) : (
                <Text as="p" tone="subdued">{t("common.noProductSelected")}</Text>
              )}

              <InlineStack gap="200">
                <Button onClick={handleProductPick}>
                  {selectedProduct ? t("common.changeProduct") : t("common.selectProduct")}
                </Button>
                {selectedProduct && (
                  <Button
                    variant="primary"
                    onClick={handleAnalyze}
                    loading={isAnalyzing}
                  >
                    {isAnalyzing ? t("competition.step1.analyzing") : t("competition.step1.runAnalysis")}
                  </Button>
                )}
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {isAnalyzing && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300" inlineAlign="center">
                <Spinner size="large" />
                <Text as="p" tone="subdued">
                  {t("competition.analyzingMessage", { title: selectedProduct?.title })}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {actionData?.success && (
          <>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Box background="bg-fill-info" padding="200" borderRadius="200">
                      <Text as="span">🤖</Text>
                    </Box>
                    <Text as="h2" variant="headingMd">{t("competition.summary.heading")}</Text>
                  </InlineStack>
                  <Text as="p" tone="subdued">
                    {t("competition.summary.subheading", { title: actionData.productTitle })}
                  </Text>
                  <Box
                    background="bg-fill-secondary"
                    padding="400"
                    borderRadius="200"
                  >
                    <Text as="p" style={{ whiteSpace: "pre-wrap" }}>
                      {actionData.aiSummary}
                    </Text>
                  </Box>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    {t("competition.results.heading", { count: actionData.results.length })}
                  </Text>
                  <BlockStack gap="300">
                    {actionData.results.map((r, i) => (
                      <Box key={i}>
                        <BlockStack gap="150">
                          <Link url={r.link} external monochrome={false}>
                            <Text as="p" fontWeight="semibold">{r.title}</Text>
                          </Link>
                          <InlineStack gap="200" blockAlign="center">
                            <Badge tone="info">{r.site}</Badge>
                            {r.priceFrom && r.priceTo ? (
                              <Badge tone="success">
                                {t("competition.results.priceRange", {
                                  from: r.priceFrom,
                                  to: r.priceTo,
                                  currency: r.currency,
                                })}
                              </Badge>
                            ) : (
                              <Badge tone="success">
                                {t("competition.results.price", { price: r.price, currency: r.currency })}
                              </Badge>
                            )}
                            {r.rating ? (
                              <Badge>
                                {t("competition.results.rating", { rating: r.rating, count: r.reviews ?? 0 })}
                              </Badge>
                            ) : null}
                          </InlineStack>
                        </BlockStack>
                        {i < actionData.results.length - 1 && <Box paddingBlockStart="300"><Divider /></Box>}
                      </Box>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}
