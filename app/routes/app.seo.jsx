import { useState, useCallback, useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
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
  Divider,
  TextField,
  ProgressBar,
  Icon,
} from "@shopify/polaris";
import { AlertTriangleIcon, CheckCircleIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";
import {
  CREDIT_COSTS,
  consumeCredits,
  refundCredits,
} from "../models/subscription.server";
import {
  fetchProductSeoData,
  auditProduct,
  fetchLivePageHtml,
  auditLivePage,
} from "../services/seo-audit.server";
import { generateSeoSuggestions } from "../services/ai-text.server";
import {
  createSeoAudit,
  markAudited,
  getAuditHistory,
  getAuditById,
} from "../models/seo-audit.server";
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

const PRODUCT_UPDATE_MUTATION = `
  mutation updateProductSeo($input: ProductInput!) {
    productUpdate(input: $input) {
      product { id }
      userErrors { field message }
    }
  }
`;

const MEDIA_ALT_MUTATION = `
  mutation updateMediaAlt($productId: ID!, $media: [UpdateMediaInput!]!) {
    productUpdateMedia(productId: $productId, media: $media) {
      media { id }
      mediaUserErrors { field message }
    }
  }
`;

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const locale = await i18next.getLocale(request);
  const t = await i18next.getFixedT(locale);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "audit") {
    const productId = formData.get("productId");
    const productTitle = formData.get("productTitle");

    const creditsReserved = await consumeCredits(session.shop, CREDIT_COSTS.SEO_AUDIT);
    if (!creditsReserved) {
      return json({ error: t("generate.errors.monthlyLimitReached") }, { status: 400 });
    }

    try {
      const product = await fetchProductSeoData(admin, productId);
      const audit = auditProduct(product, t);

      let themeIssues = [];
      let liveAccessible = null;
      if (product.onlineStoreUrl) {
        const { accessible, html } = await fetchLivePageHtml(product.onlineStoreUrl);
        liveAccessible = accessible;
        if (accessible && html) {
          themeIssues = auditLivePage(html, t).issues;
        }
      }

      let suggestions = {};
      if (audit.issues.length > 0) {
        suggestions = await generateSeoSuggestions(
          productTitle,
          audit.productDescription,
          audit.currentSeo,
          audit.issues
        );
      }

      const saved = await createSeoAudit({
        shop: session.shop,
        productId,
        productTitle,
        score: audit.score,
        issues: [...audit.issues, ...themeIssues],
        suggestions,
      });

      return json({
        success: true,
        auditId: saved.id,
        score: audit.score,
        productIssues: audit.issues,
        themeIssues,
        liveAccessible,
        currentSeo: audit.currentSeo,
        suggestions,
        imagesWithoutAlt: audit.imagesWithoutAlt,
        productTitle,
        productId,
        appliedAt: null,
      });
    } catch (error) {
      await refundCredits(session.shop, CREDIT_COSTS.SEO_AUDIT);
      return json({ error: t("seo.errors.auditFailed", { message: error.message }) }, { status: 500 });
    }
  }

  if (intent === "apply") {
    const auditId = formData.get("auditId");
    const productId = formData.get("productId");
    const title = formData.get("title");
    const metaDescription = formData.get("metaDescription");
    const handle = formData.get("handle");
    const altText = formData.get("altText");
    const bodyDescription = formData.get("bodyDescription");
    const imageIds = JSON.parse(formData.get("imageIds") || "[]");

    try {
      const seoInput = {};
      if (title) seoInput.title = title;
      if (metaDescription) seoInput.description = metaDescription;

      const productInput = { id: `gid://shopify/Product/${productId}` };
      if (Object.keys(seoInput).length > 0) productInput.seo = seoInput;
      if (handle) productInput.handle = handle;
      if (bodyDescription) productInput.descriptionHtml = bodyDescription;

      if (Object.keys(productInput).length > 1) {
        await admin.graphql(PRODUCT_UPDATE_MUTATION, { variables: { input: productInput } });
      }

      if (altText && imageIds.length > 0) {
        await admin.graphql(MEDIA_ALT_MUTATION, {
          variables: {
            productId: `gid://shopify/Product/${productId}`,
            media: imageIds.map((id) => ({ id, alt: altText })),
          },
        });
      }

      await markAudited(auditId, { title, metaDescription, handle, altText, bodyDescription });

      return json({ applied: true, auditId });
    } catch (error) {
      return json({ error: t("seo.errors.applyFailed", { message: error.message }) }, { status: 500 });
    }
  }

  if (intent === "history") {
    const productId = formData.get("productId");
    const items = await getAuditHistory(session.shop, productId);
    return json({ type: "history", items });
  }

  if (intent === "loadHistory") {
    const auditId = formData.get("auditId");
    const audit = await getAuditById(auditId, session.shop);
    if (!audit) {
      return json({ error: t("seo.errors.historyNotFound") }, { status: 404 });
    }

    const allIssues = JSON.parse(audit.issues || "[]");
    const productIssues = allIssues.filter((i) => i.severity !== "theme");
    const themeIssues = allIssues.filter((i) => i.severity === "theme");
    const suggestions = JSON.parse(audit.suggestions || "{}");

    return json({
      type: "loadHistory",
      success: true,
      fromHistory: true,
      auditId: audit.id,
      score: audit.score,
      productIssues,
      themeIssues,
      liveAccessible: themeIssues.length > 0 ? true : null,
      suggestions,
      imagesWithoutAlt: [],
      productTitle: audit.productTitle,
      productId: audit.productId,
      appliedAt: audit.appliedAt,
    });
  }

  return json({ error: t("seo.errors.invalidAction") }, { status: 400 });
};

const severityTone = { warning: "critical", info: "warning", theme: "info" };
const dateLocales = { tr: "tr-TR", en: "en-US" };

export default function Seo() {
  const { preselectedProduct } = useLoaderData();
  const fetcher = useFetcher();
  const historyFetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const { t, i18n } = useTranslation();
  const dateLocale = dateLocales[i18n.language] || "en-US";

  const [selectedProduct, setSelectedProduct] = useState(preselectedProduct);
  const [editedSuggestions, setEditedSuggestions] = useState({});
  const [displayResult, setDisplayResult] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);

  const isWorking = fetcher.state !== "idle";
  const formIntent = fetcher.formData?.get("intent");

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.success) {
      setDisplayResult(fetcher.data);
      setEditedSuggestions({});
      if (selectedProduct?.id) {
        historyFetcher.submit({ intent: "history", productId: selectedProduct.id }, { method: "post" });
      }
    } else if (fetcher.data.applied) {
      setDisplayResult((prev) => (prev ? { ...prev, appliedAt: new Date().toISOString() } : prev));
      shopify.toast.show(t("seo.toast.applied"));
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
      setEditedSuggestions({});
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
      setEditedSuggestions({});
      setDisplayResult(null);
    }
  }, [shopify, selectedProduct]);

  const handleAudit = useCallback(() => {
    if (!selectedProduct) return;
    setDisplayResult(null);
    const formData = new FormData();
    formData.append("intent", "audit");
    formData.append("productId", selectedProduct.id);
    formData.append("productTitle", selectedProduct.title);
    fetcher.submit(formData, { method: "post" });
  }, [selectedProduct, fetcher]);

  const handleApply = useCallback(() => {
    if (!displayResult?.auditId) return;
    const s = { ...displayResult.suggestions, ...editedSuggestions };
    const formData = new FormData();
    formData.append("intent", "apply");
    formData.append("auditId", displayResult.auditId);
    formData.append("productId", displayResult.productId);
    if (s.title) formData.append("title", s.title);
    if (s.metaDescription) formData.append("metaDescription", s.metaDescription);
    if (s.handle) formData.append("handle", s.handle);
    if (s.altText) formData.append("altText", s.altText);
    if (s.bodyDescription) formData.append("bodyDescription", s.bodyDescription);
    formData.append(
      "imageIds",
      JSON.stringify((displayResult.imagesWithoutAlt || []).map((img) => img.id))
    );
    fetcher.submit(formData, { method: "post" });
  }, [displayResult, editedSuggestions, fetcher]);

  const handleHistoryClick = useCallback((auditId) => {
    historyFetcher.submit({ intent: "loadHistory", auditId }, { method: "post" });
  }, [historyFetcher]);

  const updateSuggestion = (field, value) => {
    setEditedSuggestions((prev) => ({ ...prev, [field]: value }));
  };

  const getValue = (field) => editedSuggestions[field] ?? displayResult?.suggestions?.[field] ?? "";

  const error = fetcher.data?.error || historyFetcher.data?.error;
  const alreadyApplied = !!displayResult?.appliedAt;
  const isLoadingHistoryItem = historyFetcher.state !== "idle" && historyFetcher.formData?.get("intent") === "loadHistory";
  const loadingAuditId = historyFetcher.formData?.get("auditId");

  const themeIssues = displayResult?.themeIssues || [];
  const showThemeSection =
    displayResult?.success &&
    (themeIssues.length > 0 || displayResult.liveAccessible === false || displayResult.liveAccessible === true);

  return (
    <Page
      title={t("seo.pageTitle")}
      subtitle={t("seo.pageSubtitle")}
      backAction={{ url: "/app" }}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner title={t("seo.errorBanner.title")} tone="critical"><p>{error}</p></Banner>
          </Layout.Section>
        )}

        {fetcher.data?.applied && (
          <Layout.Section>
            <Banner title={t("seo.appliedBanner.title")} tone="success">
              <p>{t("seo.appliedBanner.body")}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">{t("seo.step1.heading")}</Text>

              {selectedProduct ? (
                <InlineStack gap="300" blockAlign="center">
                  {selectedProduct.image && (
                    <Thumbnail source={selectedProduct.image} alt={selectedProduct.title} size="medium" />
                  )}
                  <BlockStack gap="100">
                    <Text as="p" fontWeight="semibold">{selectedProduct.title}</Text>
                    <Badge tone="success">{t("seo.step1.selected")}</Badge>
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
                    onClick={handleAudit}
                    loading={isWorking && formIntent === "audit"}
                  >
                    {isWorking && formIntent === "audit" ? t("seo.step1.auditing") : t("seo.step1.runAudit")}
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
                <Text as="h2" variant="headingMd">{t("seo.history.heading")}</Text>
                {historyItems.length === 0 ? (
                  <Text as="p" tone="subdued">{t("seo.history.empty")}</Text>
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
                        background={displayResult?.auditId === item.id ? "bg-surface-active" : "bg-surface"}
                        width="100%"
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="span" variant="bodySm" tone="subdued">
                            {new Date(item.createdAt).toLocaleDateString(dateLocale, {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                          <InlineStack gap="200" blockAlign="center">
                            {item.appliedAt && <Badge tone="success">{t("seo.history.appliedBadge")}</Badge>}
                            <Badge tone={item.score >= 80 ? "success" : item.score >= 50 ? "warning" : "critical"}>
                              {t("seo.score.value", { score: item.score })}
                            </Badge>
                            {isLoadingHistoryItem && loadingAuditId === item.id && <Spinner size="small" />}
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

        {isWorking && formIntent === "audit" && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300" inlineAlign="center">
                <Spinner size="large" />
                <Text as="p" tone="subdued">{t("seo.auditingMessage")}</Text>
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
                    <Text as="h2" variant="headingMd">{t("seo.score.heading")}</Text>
                    <InlineStack gap="200" blockAlign="center">
                      {displayResult.fromHistory && (
                        <Badge tone="info">{t("seo.history.fromHistoryBadge")}</Badge>
                      )}
                      <Badge tone={displayResult.score >= 80 ? "success" : displayResult.score >= 50 ? "warning" : "critical"}>
                        {t("seo.score.value", { score: displayResult.score })}
                      </Badge>
                    </InlineStack>
                  </InlineStack>
                  <ProgressBar
                    progress={displayResult.score}
                    tone={displayResult.score >= 80 ? "success" : displayResult.score >= 50 ? "warning" : "critical"}
                  />

                  {(displayResult.productIssues || []).length === 0 ? (
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={CheckCircleIcon} tone="success" />
                      <Text as="p">{t("seo.score.noIssues")}</Text>
                    </InlineStack>
                  ) : (
                    <BlockStack gap="200">
                      <Text as="p" fontWeight="semibold">
                        {t("seo.score.issuesHeading", { count: displayResult.productIssues.length })}
                      </Text>
                      {displayResult.productIssues.map((issue, i) => (
                        <InlineStack key={i} gap="200" blockAlign="start" wrap={false}>
                          <Icon source={AlertTriangleIcon} tone={severityTone[issue.severity] || "warning"} />
                          <BlockStack gap="025">
                            <Text as="p" fontWeight="semibold">{issue.label}</Text>
                            <Text as="p" tone="subdued" variant="bodySm">{issue.detail}</Text>
                            {issue.field === "images" && (
                              <Box paddingBlockStart="100">
                                <Button size="slim" onClick={() => navigate(`/app/generate?productId=${displayResult.productId}`)}>
                                  {t("seo.cta.goToGenerate")}
                                </Button>
                              </Box>
                            )}
                          </BlockStack>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>

            {showThemeSection && (
              <Layout.Section>
                <Card>
                  <BlockStack gap="300">
                    <Text as="h2" variant="headingMd">{t("seo.themeSection.heading")}</Text>

                    {themeIssues.length > 0 ? (
                      <BlockStack gap="300">
                        <Banner tone="info">
                          <p>{t("seo.themeSection.banner")}</p>
                        </Banner>
                        <BlockStack gap="200">
                          {themeIssues.map((issue, i) => (
                            <InlineStack key={i} gap="200" blockAlign="start" wrap={false}>
                              <Icon source={AlertTriangleIcon} tone="info" />
                              <BlockStack gap="025">
                                <Text as="p" fontWeight="semibold">{issue.label}</Text>
                                <Text as="p" tone="subdued" variant="bodySm">{issue.detail}</Text>
                              </BlockStack>
                            </InlineStack>
                          ))}
                        </BlockStack>
                      </BlockStack>
                    ) : displayResult.liveAccessible === false ? (
                      <Text as="p" tone="subdued">{t("seo.themeSection.notAccessible")}</Text>
                    ) : (
                      <InlineStack gap="200" blockAlign="center">
                        <Icon source={CheckCircleIcon} tone="success" />
                        <Text as="p">{t("seo.themeSection.noIssues")}</Text>
                      </InlineStack>
                    )}
                  </BlockStack>
                </Card>
              </Layout.Section>
            )}

            {Object.keys(displayResult.suggestions || {}).some((k) => displayResult.suggestions[k]) && (
              <Layout.Section>
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="050">
                        <Text as="h2" variant="headingMd">{t("seo.suggestions.heading")}</Text>
                        <Text as="p" tone="subdued" variant="bodySm">
                          {t("seo.suggestions.description")}
                        </Text>
                      </BlockStack>
                      {alreadyApplied ? (
                        <Badge tone="success">{t("seo.history.appliedBadge")}</Badge>
                      ) : (
                        <Button variant="primary" onClick={handleApply} loading={isWorking && formIntent === "apply"}>
                          {isWorking && formIntent === "apply" ? t("seo.suggestions.applying") : t("seo.suggestions.apply")}
                        </Button>
                      )}
                    </InlineStack>

                    <Divider />

                    {displayResult.suggestions.title && (
                      <TextField
                        label={t("seo.suggestions.seoTitle.label")}
                        value={getValue("title")}
                        onChange={(v) => updateSuggestion("title", v)}
                        helpText={t("seo.suggestions.seoTitle.helpText", { count: getValue("title").length })}
                        autoComplete="off"
                        disabled={alreadyApplied}
                      />
                    )}

                    {displayResult.suggestions.metaDescription && (
                      <TextField
                        label={t("seo.suggestions.metaDescription.label")}
                        value={getValue("metaDescription")}
                        onChange={(v) => updateSuggestion("metaDescription", v)}
                        multiline={3}
                        helpText={t("seo.suggestions.metaDescription.helpText", { count: getValue("metaDescription").length })}
                        autoComplete="off"
                        disabled={alreadyApplied}
                      />
                    )}

                    {displayResult.suggestions.handle && (
                      <TextField
                        label={t("seo.suggestions.handle.label")}
                        value={getValue("handle")}
                        onChange={(v) => updateSuggestion("handle", v)}
                        prefix="/products/"
                        autoComplete="off"
                        disabled={alreadyApplied}
                      />
                    )}

                    {displayResult.suggestions.altText && (
                      <TextField
                        label={t("seo.suggestions.altText.label", { count: displayResult.imagesWithoutAlt?.length || 0 })}
                        value={getValue("altText")}
                        onChange={(v) => updateSuggestion("altText", v)}
                        autoComplete="off"
                        disabled={alreadyApplied}
                      />
                    )}

                    {displayResult.suggestions.bodyDescription && (
                      <TextField
                        label={t("seo.suggestions.bodyDescription.label")}
                        value={getValue("bodyDescription")}
                        onChange={(v) => updateSuggestion("bodyDescription", v)}
                        multiline={6}
                        helpText={t("seo.suggestions.bodyDescription.helpText")}
                        autoComplete="off"
                        disabled={alreadyApplied}
                      />
                    )}
                  </BlockStack>
                </Card>
              </Layout.Section>
            )}
          </>
        )}
      </Layout>
    </Page>
  );
}
