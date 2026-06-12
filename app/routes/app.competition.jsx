import { useState, useCallback, useEffect } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
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
import {
  CREDIT_COSTS,
  consumeCredits,
  refundCredits,
} from "../models/subscription.server";
import { searchCompetitorPrices } from "../services/serp-search.server";
import { summarizeCompetitors } from "../services/ai-text.server";
import {
  createCompetitorAnalysis,
  getAnalysisHistoryForProduct,
  getAnalysisById,
} from "../models/competitor-analysis.server";
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
  const intent = formData.get("intent") || "analyze";

  if (intent === "history") {
    const productId = formData.get("productId");
    const items = await getAnalysisHistoryForProduct(session.shop, productId);
    return json({ type: "history", items });
  }

  if (intent === "loadHistory") {
    const analysisId = formData.get("analysisId");
    const analysis = await getAnalysisById(analysisId, session.shop);
    if (!analysis) {
      return json({ error: t("competition.errors.historyNotFound") }, { status: 404 });
    }

    return json({
      type: "loadHistory",
      success: true,
      fromHistory: true,
      analysisId: analysis.id,
      results: JSON.parse(analysis.results || "[]"),
      aiSummary: analysis.aiSummary,
      productTitle: analysis.productTitle,
    });
  }

  const productId = formData.get("productId");
  const productTitle = formData.get("productTitle");

  if (!productTitle) {
    return json({ error: t("competition.errors.titleMissing") }, { status: 400 });
  }

  const creditsReserved = await consumeCredits(session.shop, CREDIT_COSTS.COMPETITOR_ANALYSIS);
  if (!creditsReserved) {
    return json({ error: t("generate.errors.monthlyLimitReached") }, { status: 400 });
  }

  const query = productTitle;

  try {
    const results = await searchCompetitorPrices(query, { country: locale === "tr" ? "tr" : "us" });

    if (results.length === 0) {
      return json({ error: t("competition.errors.noResults") }, { status: 200 });
    }

    const aiSummary = await summarizeCompetitors(productTitle, results);

    const saved = await createCompetitorAnalysis({
      shop: session.shop,
      productId,
      productTitle,
      query,
      results,
      aiSummary,
    });

    return json({ success: true, analysisId: saved.id, results, aiSummary, productTitle });
  } catch (error) {
    await refundCredits(session.shop, CREDIT_COSTS.COMPETITOR_ANALYSIS);
    return json({ error: t("competition.errors.analysisFailed", { message: error.message }) }, { status: 500 });
  }
};

const dateLocales = { tr: "tr-TR", en: "en-US" };

export default function Competition() {
  const { preselectedProduct } = useLoaderData();
  const fetcher = useFetcher();
  const historyFetcher = useFetcher();
  const shopify = useAppBridge();
  const { t, i18n } = useTranslation();
  const dateLocale = dateLocales[i18n.language] || "en-US";

  const [selectedProduct, setSelectedProduct] = useState(preselectedProduct);
  const [displayResult, setDisplayResult] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);

  const isAnalyzing = fetcher.state !== "idle" && fetcher.formData?.get("intent") !== "history";

  useEffect(() => {
    if (fetcher.data?.success) {
      setDisplayResult(fetcher.data);
      if (selectedProduct?.id) {
        historyFetcher.submit({ intent: "history", productId: selectedProduct.id }, { method: "post" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.data]);

  useEffect(() => {
    if (historyFetcher.data?.type === "history") {
      setHistoryItems(historyFetcher.data.items || []);
    } else if (historyFetcher.data?.type === "loadHistory" && historyFetcher.data.success) {
      setDisplayResult(historyFetcher.data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFetcher.data]);

  useEffect(() => {
    if (selectedProduct?.id) {
      historyFetcher.submit({ intent: "history", productId: selectedProduct.id }, { method: "post" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProduct?.id]);

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
      setDisplayResult(null);
    }
  }, [shopify, selectedProduct]);

  const handleAnalyze = useCallback(() => {
    if (!selectedProduct) return;
    setDisplayResult(null);

    const formData = new FormData();
    formData.append("intent", "analyze");
    formData.append("productId", selectedProduct.id);
    formData.append("productTitle", selectedProduct.title);
    fetcher.submit(formData, { method: "post" });
  }, [selectedProduct, fetcher]);

  const handleHistoryClick = useCallback((analysisId) => {
    historyFetcher.submit({ intent: "loadHistory", analysisId }, { method: "post" });
  }, [historyFetcher]);

  const error = fetcher.data?.error || historyFetcher.data?.error;
  const isLoadingHistoryItem = historyFetcher.state !== "idle" && historyFetcher.formData?.get("intent") === "loadHistory";
  const loadingAnalysisId = historyFetcher.formData?.get("analysisId");

  return (
    <Page
      title={t("competition.pageTitle")}
      subtitle={t("competition.pageSubtitle")}
      backAction={{ url: "/app" }}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner title={t("competition.resultBanner.title")} tone="warning">
              <p>{error}</p>
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

        {selectedProduct && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">{t("competition.history.heading")}</Text>
                {historyItems.length === 0 ? (
                  <Text as="p" tone="subdued">{t("competition.history.empty")}</Text>
                ) : (
                  <BlockStack gap="200">
                    {historyItems.map((item) => (
                      <Box
                        key={item.id}
                        as="button"
                        type="button"
                        onClick={() => handleHistoryClick(item.id)}
                        padding="200"
                        borderRadius="200"
                        borderWidth="025"
                        borderColor="border"
                        background={displayResult?.analysisId === item.id ? "bg-surface-active" : "bg-surface"}
                        width="100%"
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="025">
                            <Text as="span" variant="bodySm" tone="subdued">
                              {new Date(item.createdAt).toLocaleDateString(dateLocale, {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </Text>
                            {item.aiSummary && (
                              <Text as="span" variant="bodySm" truncate>
                                {item.aiSummary.slice(0, 100)}
                              </Text>
                            )}
                          </BlockStack>
                          <InlineStack gap="200" blockAlign="center">
                            <Badge tone="info">
                              {t("competition.results.heading", {
                                count: JSON.parse(item.results || "[]").length,
                              })}
                            </Badge>
                            {isLoadingHistoryItem && loadingAnalysisId === item.id && <Spinner size="small" />}
                          </InlineStack>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

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

        {displayResult?.success && (
          <>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <Box background="bg-fill-info" padding="200" borderRadius="200">
                        <Text as="span">🤖</Text>
                      </Box>
                      <Text as="h2" variant="headingMd">{t("competition.summary.heading")}</Text>
                    </InlineStack>
                    {displayResult.fromHistory && (
                      <Badge tone="info">{t("competition.history.fromHistoryBadge")}</Badge>
                    )}
                  </InlineStack>
                  <Text as="p" tone="subdued">
                    {t("competition.summary.subheading", { title: displayResult.productTitle })}
                  </Text>
                  <Box
                    background="bg-fill-secondary"
                    padding="400"
                    borderRadius="200"
                  >
                    <Text as="p" style={{ whiteSpace: "pre-wrap" }}>
                      {displayResult.aiSummary}
                    </Text>
                  </Box>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    {t("competition.results.heading", { count: displayResult.results.length })}
                  </Text>
                  <BlockStack gap="300">
                    {displayResult.results.map((r, i) => (
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
                        {i < displayResult.results.length - 1 && <Box paddingBlockStart="300"><Divider /></Box>}
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
