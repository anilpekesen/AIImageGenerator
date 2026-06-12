import { useState, useCallback, useMemo, useEffect } from "react";
import { useFetcher, useLoaderData, useSearchParams } from "@remix-run/react";
import { json } from "@remix-run/node";
import {
  Page,
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

  const products = nodes.filter((product) => product.status === "ACTIVE").map((product) => {
    const id = product.id.replace("gid://shopify/Product/", "");
    const analysis = analysisMap[id];
    return {
      id,
      title: product.title,
      handle: product.handle,
      image: product.featuredImage?.url || null,
      updatedAt: product.updatedAt,
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

  const analyzedCount = products.filter((product) => product.lastAnalysis).length;
  const activeCount = products.filter((product) => product.isActive).length;
  const totalResults = products.reduce((sum, product) => sum + (product.lastAnalysis?.resultCount || 0), 0);
  const latestAnalysisDate = products
    .filter((product) => product.lastAnalysis)
    .map((product) => new Date(product.lastAnalysis.createdAt).getTime())
    .sort((a, b) => b - a)[0];

  const formatDate = useCallback((value) => {
    if (!value) return t("competition.table.neverChecked");
    return new Date(value).toLocaleDateString(dateLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [dateLocale, t]);

  const formatUpdatedAt = useCallback((value) => {
    if (!value) return "—";
    const diffDays = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 86400000));
    if (diffDays === 0) return i18n.language?.startsWith("tr") ? "Bugün" : "Today";
    return i18n.language?.startsWith("tr") ? `${diffDays} gün önce` : `${diffDays}d ago`;
  }, [i18n.language]);

  return (
    <Page
      title={t("competition.pageTitle")}
      subtitle={t("competition.pageSubtitle")}
      backAction={{ url: "/app" }}
    >
      <style>{`
        .competition-shell{background:linear-gradient(180deg,#f6f8ff 0%,#fff 58%);border:1px solid #dbe3f1;border-radius:18px;padding:20px;box-shadow:0 18px 50px rgba(15,23,42,.08);max-width:1480px;margin:0 auto}
        .competition-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px}
        .competition-title{display:flex;align-items:center;gap:12px}
        .competition-mark{width:40px;height:40px;border-radius:12px;background:#eef2ff;border:1px solid #c7d2fe;color:#4f46e5;display:flex;align-items:center;justify-content:center;font-weight:800}
        .competition-title h2{font-size:18px;line-height:1.2;font-weight:800;color:#111827;margin:0}
        .competition-title p{font-size:13px;color:#64748b;margin:4px 0 0;line-height:1.45}
        .competition-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
        .competition-metric{background:#fff;border:1px solid #dbe3f1;border-radius:12px;padding:14px 16px;box-shadow:0 8px 20px rgba(15,23,42,.04);min-height:78px}
        .competition-metric span{display:block;font-size:11px;color:#64748b;font-weight:700}
        .competition-metric strong{display:block;margin-top:8px;font-size:24px;line-height:1;color:#111827}
        .competition-table-card{background:#fff;border:1px solid #dbe3f1;border-radius:14px;overflow:hidden;box-shadow:0 8px 22px rgba(15,23,42,.05)}
        .competition-toolbar{display:flex;align-items:center;gap:12px;padding:14px;border-bottom:1px solid #e2e8f0;background:#fbfcff}
        .competition-search{min-width:280px;max-width:420px;flex:1}
        .competition-count{margin-left:auto;font-size:12px;color:#64748b}
        .competition-table-wrap{overflow-x:auto}
        .competition-table{width:100%;border-collapse:collapse;font-size:13px;min-width:920px}
        .competition-table th{background:#f8fafc;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px;font-weight:700;text-align:left;padding:12px 14px;white-space:nowrap}
        .competition-table th button,.competition-table td>button{background:transparent;border:0;padding:0;color:inherit;font:inherit;cursor:pointer}
        .competition-table th button:hover,.competition-table td>button:hover{color:#4f46e5}
        .competition-table td{border-bottom:1px solid #eef2f7;padding:12px 14px;vertical-align:middle;color:#111827}
        .competition-table tbody tr:hover:not(.competition-result-row){background:#fbfcff}
        .competition-product{display:flex;align-items:center;gap:10px;min-width:270px}
        .competition-thumb{width:44px;height:44px;border-radius:10px;border:1px solid #e2e8f0;background:#f8fafc;object-fit:cover;flex:none}
        .competition-product-title{font-weight:750;color:#111827;line-height:1.25;margin:0}
        .competition-muted{font-size:12px;color:#64748b;line-height:1.45;margin:0}
        .competition-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .competition-result-row{background:#f8fafc}
        .competition-result-cell{padding:0!important}
        .competition-result-panel{padding:16px 18px;border-top:1px solid #e2e8f0;background:#fbfcff}
        .competition-result-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
        .competition-summary{background:#fff;border:1px solid #dbe3f1;border-radius:12px;padding:14px;white-space:pre-wrap;color:#334155;line-height:1.5}
        .competition-results{margin-top:14px;background:#fff;border:1px solid #dbe3f1;border-radius:12px;overflow:hidden}
        .competition-results table{width:100%;border-collapse:collapse;font-size:13px}
        .competition-results th{background:#f8fafc;color:#64748b;font-size:12px;font-weight:700;text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0}
        .competition-results td{padding:11px 12px;border-bottom:1px solid #eef2f7;color:#111827;vertical-align:top}
        .competition-price{font-weight:800;color:#059669;white-space:nowrap}
        @media (max-width:760px){.competition-shell{padding:14px;border-radius:14px}.competition-head{align-items:flex-start;flex-direction:column}.competition-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.competition-toolbar{align-items:stretch;flex-direction:column}.competition-count{margin-left:0}}
      `}</style>
      <div className="competition-shell">
        <div className="competition-head">
          <div className="competition-title">
            <div className="competition-mark">#</div>
            <div>
              <h2>{i18n.language?.startsWith("tr") ? "Ürün Analizi" : "Product Analysis"}</h2>
              <p>{t("competition.pageSubtitle")}</p>
            </div>
          </div>
          <Button icon={ExportIcon} onClick={handleExportCsv} disabled={sortedProducts.length === 0}>
            {t("competition.exportCsv")}
          </Button>
        </div>

        <div className="competition-metrics">
          <div className="competition-metric">
            <span>{i18n.language?.startsWith("tr") ? "Toplam ürün" : "Total products"}</span>
            <strong>{products.length}</strong>
          </div>
          <div className="competition-metric">
            <span>{i18n.language?.startsWith("tr") ? "Aktif ürün" : "Active products"}</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="competition-metric">
            <span>{i18n.language?.startsWith("tr") ? "Analizli ürün" : "Analyzed products"}</span>
            <strong>{analyzedCount}</strong>
          </div>
          <div className="competition-metric">
            <span>{i18n.language?.startsWith("tr") ? "Rakip sonucu" : "Competitor results"}</span>
            <strong>{totalResults}</strong>
          </div>
        </div>

        {latestAnalysisDate && (
          <Box paddingBlockEnd="300">
            <Text as="p" tone="subdued" variant="bodySm">
              {i18n.language?.startsWith("tr") ? "Son analiz: " : "Latest analysis: "}
              {formatDate(latestAnalysisDate)}
            </Text>
          </Box>
        )}

        {productAccessError && (
          <Box paddingBlockEnd="300">
            <Banner title={t("competition.productAccessError.title")} tone="warning">
              <p>{t("competition.productAccessError.body")}</p>
            </Banner>
          </Box>
        )}

        {products.length === 0 ? (
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
        ) : (
          <div className="competition-table-card">
            <div className="competition-toolbar">
              <div className="competition-search">
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
              </div>
              <span className="competition-count">
                {t("competition.table.totalsLabel", { count: sortedProducts.length })}
              </span>
            </div>

            {sortedProducts.length === 0 ? (
              <Box padding="500">
                <Text as="p" tone="subdued" alignment="center">
                  {t("competition.emptyFiltered")}
                </Text>
              </Box>
            ) : (
              <div className="competition-table-wrap">
                <table className="competition-table">
                  <thead>
                    <tr>
                      <th>{t("competition.table.product")}</th>
                      <th>{t("competition.table.status")}</th>
                      <th>
                        <button type="button" onClick={() => handleSort(2, sortState.direction === "ascending" ? "descending" : "ascending")}>
                          {t("competition.table.lastChecked")} {sortState.direction === "ascending" ? "↑" : "↓"}
                        </button>
                      </th>
                      <th>{i18n.language?.startsWith("tr") ? "Sonuç" : "Results"}</th>
                      <th>{i18n.language?.startsWith("tr") ? "Güncelleme" : "Updated"}</th>
                      <th>{t("competition.table.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedProducts.flatMap((product) => [
                        <tr key={product.id}>
                          <td>
                            <div className="competition-product">
                              {product.image ? (
                                <img className="competition-thumb" src={product.image} alt={product.title} loading="lazy" decoding="async" />
                              ) : (
                                <Thumbnail source={ImageIcon} alt={product.title} size="small" />
                              )}
                              <div>
                                <p className="competition-product-title">{product.title}</p>
                                {product.handle && <p className="competition-muted">/{product.handle}</p>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge tone={product.isActive ? "success" : undefined}>
                              {product.isActive ? t("products.status.active") : t("products.status.draft")}
                            </Badge>
                          </td>
                          <td>
                            {product.lastAnalysis ? (
                              <button type="button" onClick={() => handleViewLast(product)} style={{ textAlign: "left" }}>
                                <Text as="span" variant="bodySm" tone="subdued">{formatDate(product.lastAnalysis.createdAt)}</Text>
                              </button>
                            ) : (
                              <Text as="span" tone="subdued">{t("competition.table.neverChecked")}</Text>
                            )}
                          </td>
                          <td>
                            {product.lastAnalysis ? (
                              <Badge tone="info">
                                {t("competition.table.resultCount", { count: product.lastAnalysis.resultCount })}
                              </Badge>
                            ) : (
                              <span className="competition-muted">—</span>
                            )}
                          </td>
                          <td><span className="competition-muted">{formatUpdatedAt(product.updatedAt)}</span></td>
                          <td>
                            <div className="competition-actions">
                              <Button
                                size="slim"
                                onClick={() => handleAnalyze(product)}
                                loading={isAnalyzingId === product.id}
                                disabled={fetcher.state !== "idle" && isAnalyzingId !== product.id}
                              >
                                {product.lastAnalysis ? t("competition.table.refresh") : t("competition.table.findPrices")}
                              </Button>
                              {product.lastAnalysis && (
                                <Button size="slim" variant="plain" onClick={() => handleViewLast(product)}>
                                  {i18n.language?.startsWith("tr") ? "Geçmiş" : "History"}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>,
                        expandedProductId === product.id && (
                          <tr key={`${product.id}-result`} className="competition-result-row">
                            <td colSpan="6" className="competition-result-cell">
                              <div className="competition-result-panel">
                                <div className="competition-result-head">
                                  <InlineStack gap="200" blockAlign="center">
                                    <Text as="h2" variant="headingMd">{product.title}</Text>
                                    {displayResult?.fromHistory && displayResult.productId === product.id && (
                                      <Badge tone="info">{t("competition.history.fromHistoryBadge")}</Badge>
                                    )}
                                  </InlineStack>
                                  <Button variant="plain" onClick={handleCloseResults}>{t("common.close")}</Button>
                                </div>

                                {isAnalyzingId === product.id && (
                                  <InlineStack gap="200" blockAlign="center">
                                    <Spinner size="small" />
                                    <Text as="p" tone="subdued">{t("competition.analyzingMessage", { title: product.title })}</Text>
                                  </InlineStack>
                                )}

                                {rowError?.productId === product.id && (
                                  <Banner title={t("competition.resultBanner.title")} tone="warning">
                                    <p>{rowError.message}</p>
                                  </Banner>
                                )}

                                {displayResult?.success && displayResult.productId === product.id && (
                                  <>
                                    <div className="competition-summary">{displayResult.aiSummary}</div>
                                    <div className="competition-results">
                                      <table>
                                        <thead>
                                          <tr>
                                            <th>{i18n.language?.startsWith("tr") ? "Rakip" : "Competitor"}</th>
                                            <th>{i18n.language?.startsWith("tr") ? "Fiyat" : "Price"}</th>
                                            <th>{i18n.language?.startsWith("tr") ? "Kaynak" : "Source"}</th>
                                            <th>{i18n.language?.startsWith("tr") ? "Puan" : "Rating"}</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {displayResult.results.map((r, i) => (
                                            <tr key={i}>
                                              <td>
                                                <Link url={r.link} external monochrome={false}>
                                                  <Text as="span" fontWeight="semibold">{r.title}</Text>
                                                </Link>
                                                <p className="competition-muted">{r.site}</p>
                                              </td>
                                              <td className="competition-price">
                                                {r.priceFrom && r.priceTo
                                                  ? t("competition.results.priceRange", { from: r.priceFrom, to: r.priceTo, currency: r.currency })
                                                  : t("competition.results.price", { price: r.price, currency: r.currency })}
                                              </td>
                                              <td><Badge tone="info">{r.source || r.site}</Badge></td>
                                              <td>{r.rating ? t("competition.results.rating", { rating: r.rating, count: r.reviews ?? 0 }) : "—"}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      ].filter(Boolean))}
                  </tbody>
                </table>
              </div>
            )}

            {hasNextPage && (
              <Box padding="300">
                <Text as="p" tone="subdued" variant="bodySm" alignment="center">
                  {t("competition.firstFiftyNotice")}
                </Text>
              </Box>
            )}
          </div>
        )}
      </div>
    </Page>
  );
}
