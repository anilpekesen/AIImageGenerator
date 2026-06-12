import { useState, useCallback, useMemo, useEffect } from "react";
import { useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
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
  DataTable,
  TextField,
} from "@shopify/polaris";
import { ImageIcon, ExportIcon } from "@shopify/polaris-icons";
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
  getLatestAnalysesMap,
} from "../models/competitor-analysis.server";
import { fetchProductsForList } from "../services/product.server";
import i18next from "../i18next.server";
import { downloadCsv } from "../utils/csv";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  let productList;
  try {
    productList = await fetchProductsForList(admin, { first: 50 });
  } catch (error) {
    console.error("Competition page product fetch failed", {
      shop: session.shop,
      status: error?.status || error?.response?.status || error?.response?.code,
      name: error?.name,
      message: error?.message,
    });
    return json({ products: [], hasNextPage: false, productAccessError: true });
  }

  const { nodes, pageInfo } = productList;
  const analysisMap = await getLatestAnalysesMap(session.shop);

  const products = nodes.map((product) => {
    const id = product.id.replace("gid://shopify/Product/", "");
    const analysis = analysisMap[id];
    return {
      id,
      title: product.title,
      image: product.featuredImage?.url || null,
      isActive: product.status === "ACTIVE",
      lastAnalysis: analysis
        ? {
            id: analysis.id,
            createdAt: analysis.createdAt,
            results: analysis.results,
            resultCount: analysis.resultCount,
            aiSummary: analysis.aiSummary,
          }
        : null,
    };
  });

  return json({ products, hasNextPage: pageInfo.hasNextPage, productAccessError: false });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const locale = await i18next.getLocale(request);
  const t = await i18next.getFixedT(locale);
  const formData = await request.formData();

  const productId = formData.get("productId");
  const productTitle = formData.get("productTitle");

  if (!productTitle) {
    return json({ error: t("competition.errors.titleMissing"), productId }, { status: 400 });
  }

  const creditsReserved = await consumeCredits(session.shop, CREDIT_COSTS.COMPETITOR_ANALYSIS);
  if (!creditsReserved) {
    return json({ error: t("generate.errors.monthlyLimitReached"), productId }, { status: 400 });
  }

  const query = productTitle;

  try {
    const results = await searchCompetitorPrices(query, { country: locale === "tr" ? "tr" : "us" });

    if (results.length === 0) {
      return json({ error: t("competition.errors.noResults"), productId }, { status: 200 });
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

    return json({ success: true, analysisId: saved.id, productId, productTitle, results, aiSummary });
  } catch (error) {
    await refundCredits(session.shop, CREDIT_COSTS.COMPETITOR_ANALYSIS);
    return json({ error: t("competition.errors.analysisFailed", { message: error.message }), productId }, { status: 500 });
  }
};

const dateLocales = { tr: "tr-TR", en: "en-US" };

export default function Competition() {
  const { products, hasNextPage, productAccessError } = useLoaderData();
  const fetcher = useFetcher();
  const { t, i18n } = useTranslation();
  const dateLocale = dateLocales[i18n.language] || "en-US";

  const [search, setSearch] = useState("");
  const [sortState, setSortState] = useState({ index: 2, direction: "ascending" });
  const [expandedProductId, setExpandedProductId] = useState(null);
  const [displayResult, setDisplayResult] = useState(null);
  const [rowError, setRowError] = useState(null);

  const isAnalyzingId = fetcher.state !== "idle" ? fetcher.formData?.get("productId") : null;

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.success) {
      setDisplayResult(fetcher.data);
      setRowError(null);
    } else if (fetcher.data.error) {
      setRowError({ productId: fetcher.data.productId, message: fetcher.data.error });
      setDisplayResult(null);
    }
  }, [fetcher.data]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.title.toLowerCase().includes(term));
  }, [products, search]);

  const sortedProducts = useMemo(() => {
    const { index, direction } = sortState;
    if (index !== 2) return filteredProducts;
    const dir = direction === "ascending" ? 1 : -1;
    return [...filteredProducts].sort((a, b) => {
      const aTime = a.lastAnalysis ? new Date(a.lastAnalysis.createdAt).getTime() : 0;
      const bTime = b.lastAnalysis ? new Date(b.lastAnalysis.createdAt).getTime() : 0;
      return (aTime - bTime) * dir;
    });
  }, [filteredProducts, sortState]);

  const handleSort = useCallback((index, direction) => {
    setSortState({ index, direction });
  }, []);

  const expandedProduct = useMemo(
    () => products.find((p) => p.id === expandedProductId) || null,
    [products, expandedProductId]
  );

  const handleAnalyze = useCallback((product) => {
    setExpandedProductId(product.id);
    setDisplayResult(null);
    setRowError(null);

    const formData = new FormData();
    formData.append("intent", "analyze");
    formData.append("productId", product.id);
    formData.append("productTitle", product.title);
    fetcher.submit(formData, { method: "post" });
  }, [fetcher]);

  const handleViewLast = useCallback((product) => {
    if (!product.lastAnalysis) return;
    setExpandedProductId(product.id);
    setRowError(null);
    setDisplayResult({
      success: true,
      productId: product.id,
      productTitle: product.title,
      results: product.lastAnalysis.results,
      aiSummary: product.lastAnalysis.aiSummary,
      fromHistory: true,
    });
  }, []);

  const handleCloseResults = useCallback(() => {
    setExpandedProductId(null);
    setDisplayResult(null);
    setRowError(null);
  }, []);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const productId = searchParams.get("productId");
    if (!productId) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    if (product.lastAnalysis) {
      handleViewLast(product);
    } else {
      handleAnalyze(product);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportCsv = useCallback(() => {
    const headers = [
      t("competition.table.product"),
      t("competition.table.status"),
      t("competition.table.lastChecked"),
      t("competition.table.resultCountHeader"),
      t("competition.summary.heading"),
    ];
    const rows = sortedProducts.map((product) => [
      product.title,
      product.isActive ? t("products.status.active") : t("products.status.draft"),
      product.lastAnalysis ? new Date(product.lastAnalysis.createdAt).toISOString().slice(0, 10) : "",
      product.lastAnalysis ? String(product.lastAnalysis.resultCount) : "",
      product.lastAnalysis?.aiSummary || "",
    ]);
    downloadCsv("rakip-fiyat-analizi.csv", headers, rows);
  }, [sortedProducts, t]);

  const tableRows = useMemo(
    () =>
      sortedProducts.map((product) => [
        <InlineStack key={`product-${product.id}`} gap="200" blockAlign="center" wrap={false}>
          <Thumbnail source={product.image || ImageIcon} alt={product.title} size="small" />
          <Text as="span" fontWeight="semibold">
            {product.title}
          </Text>
        </InlineStack>,
        <Badge key={`status-${product.id}`} tone={product.isActive ? "success" : undefined}>
          {product.isActive ? t("products.status.active") : t("products.status.draft")}
        </Badge>,
        product.lastAnalysis ? (
          <Box key={`last-${product.id}`} as="button" type="button" onClick={() => handleViewLast(product)} padding="0" width="100%">
            <BlockStack gap="050" inlineAlign="start">
              <Text as="span" variant="bodySm" tone="subdued">
                {new Date(product.lastAnalysis.createdAt).toLocaleDateString(dateLocale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <Badge tone="info">
                {t("competition.table.resultCount", { count: product.lastAnalysis.resultCount })}
              </Badge>
            </BlockStack>
          </Box>
        ) : (
          <Text key={`last-${product.id}`} as="span" tone="subdued">
            {t("competition.table.neverChecked")}
          </Text>
        ),
        <Button
          key={`action-${product.id}`}
          size="slim"
          onClick={() => handleAnalyze(product)}
          loading={isAnalyzingId === product.id}
          disabled={fetcher.state !== "idle" && isAnalyzingId !== product.id}
        >
          {product.lastAnalysis ? t("competition.table.refresh") : t("competition.table.findPrices")}
        </Button>,
      ]),
    [sortedProducts, t, dateLocale, isAnalyzingId, fetcher.state, handleAnalyze, handleViewLast]
  );

  return (
    <Page
      title={t("competition.pageTitle")}
      subtitle={t("competition.pageSubtitle")}
      backAction={{ url: "/app" }}
      secondaryActions={[
        {
          content: t("competition.exportCsv"),
          icon: ExportIcon,
          onAction: handleExportCsv,
          disabled: sortedProducts.length === 0,
        },
      ]}
    >
      <Layout>
        {productAccessError && (
          <Layout.Section>
            <Banner title={t("competition.productAccessError.title")} tone="warning">
              <p>{t("competition.productAccessError.body")}</p>
            </Banner>
          </Layout.Section>
        )}

        {products.length === 0 ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text as="h2" variant="headingMd">
                  {t("competition.empty.heading")}
                </Text>
                <Text as="p" tone="subdued">
                  {t("competition.empty.body")}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : (
          <>
            <Layout.Section>
              <Card>
                <TextField
                  label={t("competition.search.label")}
                  labelHidden
                  placeholder={t("competition.search.placeholder")}
                  value={search}
                  onChange={setSearch}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setSearch("")}
                />
              </Card>
            </Layout.Section>

            <Layout.Section>
              {sortedProducts.length === 0 ? (
                <Card>
                  <Box padding="400">
                    <Text as="p" tone="subdued" alignment="center">
                      {t("competition.emptyFiltered")}
                    </Text>
                  </Box>
                </Card>
              ) : (
                <Card padding="0">
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={[
                      t("competition.table.product"),
                      t("competition.table.status"),
                      t("competition.table.lastChecked"),
                      t("competition.table.actions"),
                    ]}
                    rows={tableRows}
                    totals={["", "", "", ""]}
                    totalsName={{
                      singular: t("competition.table.totalsLabel", { count: sortedProducts.length }),
                      plural: t("competition.table.totalsLabel", { count: sortedProducts.length }),
                    }}
                    sortable={[false, false, true, false]}
                    defaultSortDirection="ascending"
                    initialSortColumnIndex={2}
                    onSort={handleSort}
                    fixedFirstColumns={1}
                    increasedTableDensity
                  />
                </Card>
              )}

              {hasNextPage && (
                <Box paddingBlockStart="400">
                  <Text as="p" tone="subdued" variant="bodySm" alignment="center">
                    {t("competition.firstFiftyNotice")}
                  </Text>
                </Box>
              )}
            </Layout.Section>
          </>
        )}

        {expandedProduct && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    {expandedProduct.title}
                  </Text>
                  <Button variant="plain" onClick={handleCloseResults}>
                    {t("common.close")}
                  </Button>
                </InlineStack>

                {isAnalyzingId === expandedProduct.id && (
                  <BlockStack gap="300" inlineAlign="center">
                    <Spinner size="large" />
                    <Text as="p" tone="subdued">
                      {t("competition.analyzingMessage", { title: expandedProduct.title })}
                    </Text>
                  </BlockStack>
                )}

                {rowError?.productId === expandedProduct.id && (
                  <Banner title={t("competition.resultBanner.title")} tone="warning">
                    <p>{rowError.message}</p>
                  </Banner>
                )}

                {displayResult?.success && displayResult.productId === expandedProduct.id && (
                  <>
                    <InlineStack align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <Box background="bg-fill-info" padding="200" borderRadius="200">
                          <Text as="span">🤖</Text>
                        </Box>
                        <Text as="h3" variant="headingSm">{t("competition.summary.heading")}</Text>
                      </InlineStack>
                      {displayResult.fromHistory && (
                        <Badge tone="info">{t("competition.history.fromHistoryBadge")}</Badge>
                      )}
                    </InlineStack>
                    <Box background="bg-fill-secondary" padding="400" borderRadius="200">
                      <Text as="p" style={{ whiteSpace: "pre-wrap" }}>
                        {displayResult.aiSummary}
                      </Text>
                    </Box>

                    <Text as="h3" variant="headingSm">
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
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
