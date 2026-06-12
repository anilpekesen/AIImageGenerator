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
  Tag,
  Modal,
} from "@shopify/polaris";
import { AlertTriangleIcon, CheckCircleIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";
import {
  CREDIT_COSTS,
  consumeCredits,
  refundCredits,
  getOrCreateSubscription,
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
import { fetchProductBasicInfo, fetchProductsForList } from "../services/product.server";
import i18next from "../i18next.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const locale = await i18next.getLocale(request);
  const t = await i18next.getFixedT(locale);

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");

  const [preselectedProduct, products, subscription] = await Promise.all([
    productId ? fetchProductBasicInfo(admin, productId) : Promise.resolve(null),
    fetchProductsForList(admin, { first: 50 }).catch(() => ({ nodes: [] })),
    getOrCreateSubscription(session.shop),
  ]);

  const activeProducts = (products?.nodes || []).filter((product) => product.status === "ACTIVE");

  const productSummaries = activeProducts.map((product) => {
    const audit = auditProduct(product, t);
    const mediaImages = (product.media?.nodes || []).filter((item) => item?.image);
    const missingAltCount = mediaImages.filter((item) => !item.alt?.trim()).length;

    return {
      id: product.id.replace("gid://shopify/Product/", ""),
      title: product.title,
      handle: product.handle,
      status: product.status,
      image: product.featuredImage?.url || mediaImages[0]?.image?.url || null,
      imageCount: mediaImages.length,
      missingAltCount,
      updatedAt: product.updatedAt,
      score: audit.score,
      issueCount: audit.issues.length,
    };
  });

  return json({ preselectedProduct, productSummaries, subscription });
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
        appliedFields: [],
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
    const tagsRaw = formData.get("tags");
    const tags = tagsRaw ? JSON.parse(tagsRaw) : null;
    const imageIds = JSON.parse(formData.get("imageIds") || "[]");

    try {
      const seoInput = {};
      if (title) seoInput.title = title;
      if (metaDescription) seoInput.description = metaDescription;

      const productInput = { id: `gid://shopify/Product/${productId}` };
      if (Object.keys(seoInput).length > 0) productInput.seo = seoInput;
      if (handle) productInput.handle = handle;
      if (bodyDescription) productInput.descriptionHtml = bodyDescription;
      if (tags && tags.length > 0) productInput.tags = tags;

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

      const appliedFieldNames = [];
      if (title) appliedFieldNames.push("title");
      if (metaDescription) appliedFieldNames.push("metaDescription");
      if (handle) appliedFieldNames.push("handle");
      if (altText) appliedFieldNames.push("altText");
      if (bodyDescription) appliedFieldNames.push("bodyDescription");
      if (tags && tags.length > 0) appliedFieldNames.push("tags");

      const updated = await markAudited(auditId, appliedFieldNames);

      return json({
        applied: true,
        auditId,
        appliedFields: JSON.parse(updated.appliedFields || "[]"),
      });
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
      appliedFields: JSON.parse(audit.appliedFields || "[]"),
    });
  }

  return json({ error: t("seo.errors.invalidAction") }, { status: 400 });
};

const severityTone = { warning: "critical", info: "warning", theme: "info" };
const dateLocales = { tr: "tr-TR", en: "en-US" };

function scoreColor(score) {
  if (score >= 80) return "var(--p-color-icon-success)";
  if (score >= 50) return "var(--p-color-icon-warning)";
  return "var(--p-color-icon-critical)";
}

function ScoreRing({ score }) {
  const size = 72;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.max(0, Math.min(100, score));
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke="var(--p-color-border-secondary)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke={scoreColor(progress)}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.4s ease" }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="20"
        fontWeight="700"
        fill="var(--p-color-text)"
      >
        {progress}
      </text>
    </svg>
  );
}

export default function Seo() {
  const { preselectedProduct, productSummaries = [], subscription } = useLoaderData();
  const fetcher = useFetcher();
  const historyFetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const { t, i18n } = useTranslation();
  const dateLocale = dateLocales[i18n.language] || "en-US";

  const [selectedProduct, setSelectedProduct] = useState(preselectedProduct || productSummaries[0] || null);
  const [editedSuggestions, setEditedSuggestions] = useState({});
  const [displayResult, setDisplayResult] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [pendingField, setPendingField] = useState(null);
  const [auditConfirmOpen, setAuditConfirmOpen] = useState(false);

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
      setDisplayResult((prev) =>
        prev
          ? {
              ...prev,
              appliedAt: new Date().toISOString(),
              appliedFields: fetcher.data.appliedFields || prev.appliedFields,
            }
          : prev
      );
      setPendingField(null);
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

  const submitAudit = useCallback(() => {
    if (!selectedProduct) return;
    setDisplayResult(null);
    setAuditConfirmOpen(false);
    const formData = new FormData();
    formData.append("intent", "audit");
    formData.append("productId", selectedProduct.id);
    formData.append("productTitle", selectedProduct.title);
    fetcher.submit(formData, { method: "post" });
  }, [selectedProduct, fetcher]);

  const handleAudit = useCallback(() => {
    if (!selectedProduct) return;
    setAuditConfirmOpen(true);
  }, [selectedProduct]);

  const handleProductSelect = useCallback((product) => {
    setSelectedProduct(product);
    setEditedSuggestions({});
    setDisplayResult(null);
    setAuditConfirmOpen(true);
  }, []);

  const handleApplySection = useCallback((fieldKey) => {
    if (!displayResult?.auditId) return;
    const s = { ...displayResult.suggestions, ...editedSuggestions };
    const formData = new FormData();
    formData.append("intent", "apply");
    formData.append("auditId", displayResult.auditId);
    formData.append("productId", displayResult.productId);

    if (fieldKey === "title" && s.title) formData.append("title", s.title);
    if (fieldKey === "metaDescription" && s.metaDescription) formData.append("metaDescription", s.metaDescription);
    if (fieldKey === "handle" && s.handle) formData.append("handle", s.handle);
    if (fieldKey === "altText" && s.altText) {
      formData.append("altText", s.altText);
      formData.append(
        "imageIds",
        JSON.stringify((displayResult.imagesWithoutAlt || []).map((img) => img.id))
      );
    }
    if (fieldKey === "bodyDescription" && s.bodyDescription) formData.append("bodyDescription", s.bodyDescription);
    if (fieldKey === "tags" && s.tags?.length > 0) formData.append("tags", JSON.stringify(s.tags));

    setPendingField(fieldKey);
    fetcher.submit(formData, { method: "post" });
  }, [displayResult, editedSuggestions, fetcher]);

  const handleApplyAll = useCallback(() => {
    if (!displayResult?.auditId) return;
    const s = { ...displayResult.suggestions, ...editedSuggestions };
    const appliedFields = displayResult.appliedFields || [];
    const formData = new FormData();
    formData.append("intent", "apply");
    formData.append("auditId", displayResult.auditId);
    formData.append("productId", displayResult.productId);
    if (s.title && !appliedFields.includes("title")) formData.append("title", s.title);
    if (s.metaDescription && !appliedFields.includes("metaDescription")) formData.append("metaDescription", s.metaDescription);
    if (s.handle && !appliedFields.includes("handle")) formData.append("handle", s.handle);
    if (s.altText && !appliedFields.includes("altText")) {
      formData.append("altText", s.altText);
      formData.append(
        "imageIds",
        JSON.stringify((displayResult.imagesWithoutAlt || []).map((img) => img.id))
      );
    }
    if (s.bodyDescription && !appliedFields.includes("bodyDescription")) formData.append("bodyDescription", s.bodyDescription);
    if (s.tags?.length > 0 && !appliedFields.includes("tags")) formData.append("tags", JSON.stringify(s.tags));

    setPendingField("all");
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
  const appliedFields = displayResult?.appliedFields || [];
  const isApplying = isWorking && formIntent === "apply";
  const isLoadingHistoryItem = historyFetcher.state !== "idle" && historyFetcher.formData?.get("intent") === "loadHistory";
  const loadingAuditId = historyFetcher.formData?.get("auditId");

  const themeIssues = displayResult?.themeIssues || [];
  const showThemeSection =
    displayResult?.success &&
    (themeIssues.length > 0 || displayResult.liveAccessible === false || displayResult.liveAccessible === true);

  const suggestionFieldKeys = ["title", "metaDescription", "handle", "altText", "bodyDescription", "tags"].filter((k) => {
    const v = displayResult?.suggestions?.[k];
    return Array.isArray(v) ? v.length > 0 : !!v;
  });
  const allSuggestionsApplied =
    suggestionFieldKeys.length > 0 && suggestionFieldKeys.every((k) => appliedFields.includes(k));
  const issueCount = (displayResult?.productIssues || []).length + (displayResult?.themeIssues || []).length;
  const historyCount = historyItems.length;
  const selectedImage = selectedProduct?.image;
  const scoreValue = displayResult?.score ?? 0;
  const scoreStateClass = scoreValue >= 80 ? "seo-score-good" : scoreValue >= 50 ? "seo-score-fair" : "seo-score-poor";
  const creditLimit = subscription?.limitCount ?? 0;
  const creditUsed = subscription?.usedCount ?? 0;
  const creditRemaining = Math.max(0, creditLimit - creditUsed);
  const planLabel = subscription?.plan ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1) : "Free";
  const formatUpdatedAt = (value) => {
    if (!value) return "—";
    const now = Date.now();
    const diffDays = Math.max(0, Math.round((now - new Date(value).getTime()) / 86400000));
    if (diffDays === 0) return i18n.language?.startsWith("tr") ? "Bugün güncellendi" : "Updated today";
    return i18n.language?.startsWith("tr") ? `${diffDays} gün önce güncellendi` : `Updated ${diffDays} days ago`;
  };

  return (
    <Page
      title={t("seo.pageTitle")}
      subtitle={t("seo.pageSubtitle")}
      backAction={{ url: "/app" }}
    >
      <style>{`
        .seo-control-shell{background:linear-gradient(180deg,#f6f8ff 0%,#ffffff 56%);border:1px solid #dbe3f1;border-radius:18px;padding:20px;box-shadow:0 18px 50px rgba(15,23,42,.08);min-height:720px;max-width:1480px;margin:0 auto}
        .seo-control-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:16px}
        .seo-control-title{display:flex;align-items:center;gap:12px;color:#111827}
        .seo-control-mark{width:40px;height:40px;border-radius:12px;background:#eef2ff;border:1px solid #c7d2fe;display:flex;align-items:center;justify-content:center;color:#4f46e5;font-weight:800}
        .seo-control-title h2{font-size:18px;line-height:1.2;font-weight:800;margin:0;color:#111827}
        .seo-control-title p{font-size:13px;line-height:1.45;margin:4px 0 0;color:#5b6475}
        .seo-control-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
        .seo-metric{background:#ffffff;border:1px solid #dbe3f1;border-radius:12px;padding:14px 16px;min-height:78px;box-shadow:0 8px 20px rgba(15,23,42,.04)}
        .seo-metric span{display:block;font-size:11px;line-height:1.2;color:#64748b;font-weight:700}
        .seo-metric strong{display:block;margin-top:8px;font-size:25px;line-height:1;color:#111827}
        .seo-score-good strong{color:#059669}.seo-score-fair strong{color:#b7791f}.seo-score-poor strong{color:#dc2626}
        .seo-control-workspace{display:grid;grid-template-columns:minmax(380px,430px) minmax(0,1fr);gap:16px;align-items:start}
        .seo-panel{background:#ffffff;border:1px solid #dbe3f1;border-radius:14px;padding:14px;color:#111827;box-shadow:0 8px 22px rgba(15,23,42,.05)}
        .seo-panel-title{font-size:13px;font-weight:800;color:#111827;margin:0 0 10px}
        .seo-product-card{display:flex;gap:12px;align-items:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:11px}
        .seo-product-fallback{width:52px;height:52px;border-radius:10px;background:#eef2ff;color:#4f46e5;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex:none}
        .seo-product-title{font-size:14px;font-weight:750;color:#111827;margin:0;line-height:1.28}
        .seo-muted{font-size:12px;color:#64748b;line-height:1.45;margin:0}
        .seo-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
        .seo-product-list{display:grid;gap:9px;max-height:580px;overflow:auto;padding-right:3px}
        .seo-product-row{width:100%;text-align:left;border:1px solid #e2e8f0;background:#ffffff;border-radius:12px;padding:11px;cursor:pointer;color:#111827;transition:border-color .15s ease,box-shadow .15s ease,background .15s ease}
        .seo-product-row:hover,.seo-product-row.is-active{border-color:#818cf8;box-shadow:0 8px 20px rgba(79,70,229,.11);background:#fbfcff}
        .seo-product-row-main{display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:10px;align-items:center}
        .seo-product-row img{width:48px;height:48px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0;background:#f8fafc}
        .seo-product-meta{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:7px;font-size:12px;color:#64748b}
        .seo-product-chip{display:inline-flex;align-items:center;gap:3px;border:1px solid #e2e8f0;border-radius:999px;padding:2px 7px;background:#f8fafc;color:#475569}
        .seo-history-list{display:grid;gap:8px;margin-top:10px;max-height:260px;overflow:auto;padding-right:2px}
        .seo-history-item{width:100%;text-align:left;border:1px solid #e2e8f0;background:#ffffff;border-radius:11px;padding:10px;cursor:pointer;color:#334155}
        .seo-history-item:hover{border-color:#818cf8;background:#fbfcff}
        .seo-main-empty{min-height:390px;display:flex;align-items:center;justify-content:center;text-align:center;background:#ffffff;border:1px solid #dbe3f1;border-radius:14px;color:#64748b;box-shadow:0 8px 22px rgba(15,23,42,.04)}
        .seo-main-empty-icon{width:52px;height:52px;border-radius:16px;margin:0 auto 14px;background:#eef2ff;border:1px solid #c7d2fe;display:flex;align-items:center;justify-content:center;color:#4f46e5;font-weight:800}
        .seo-result-head{display:flex;align-items:center;gap:18px;background:#ffffff;border:1px solid #dbe3f1;border-radius:14px;padding:18px;margin-bottom:14px;color:#111827;box-shadow:0 8px 22px rgba(15,23,42,.04)}
        .seo-result-sections{display:grid;gap:12px}
        .seo-control-shell .Polaris-Card{box-shadow:0 8px 22px rgba(15,23,42,.04)}
        @media (max-width:1100px){.seo-control-workspace{grid-template-columns:1fr}.seo-product-list{max-height:420px}}
        @media (max-width:760px){.seo-control-shell{padding:14px;border-radius:14px}.seo-control-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.seo-control-head{align-items:flex-start;flex-direction:column}.seo-product-row-main{grid-template-columns:44px minmax(0,1fr)}.seo-product-row-main>.Polaris-Badge{grid-column:2}}
      `}</style>
      <Modal
        open={auditConfirmOpen}
        onClose={() => setAuditConfirmOpen(false)}
        title={i18n.language?.startsWith("tr") ? "Yapay Zeka ile Analiz Et?" : "Analyze with AI?"}
        primaryAction={{
          content: i18n.language?.startsWith("tr") ? "Analiz Et" : "Analyze",
          onAction: submitAudit,
          loading: isWorking && formIntent === "audit",
        }}
        secondaryActions={[
          {
            content: i18n.language?.startsWith("tr") ? "İptal" : "Cancel",
            onAction: () => setAuditConfirmOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" tone="subdued">
              {i18n.language?.startsWith("tr")
                ? "Bu işlem aylık kotanızdan 1 AI analizi kullanacak."
                : "This will use 1 AI analysis from your monthly quota."}
            </Text>
            {selectedProduct && (
              <div className="seo-product-card">
                {selectedProduct.image ? (
                  <Thumbnail source={selectedProduct.image} alt={selectedProduct.title} size="medium" />
                ) : (
                  <div className="seo-product-fallback">IMG</div>
                )}
                <BlockStack gap="050">
                  <Text as="p" fontWeight="semibold">{selectedProduct.title}</Text>
                  {selectedProduct.handle && <Text as="p" tone="subdued" variant="bodySm">/{selectedProduct.handle}</Text>}
                  {typeof selectedProduct.score === "number" && (
                    <Badge tone={selectedProduct.score >= 80 ? "success" : selectedProduct.score >= 50 ? "warning" : "critical"}>
                      {selectedProduct.score}
                    </Badge>
                  )}
                </BlockStack>
              </div>
            )}
            <Box background="bg-fill-tertiary" padding="300" borderRadius="200">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="050">
                  <Text as="p" fontWeight="semibold">
                    {i18n.language?.startsWith("tr") ? "Aylık AI Analiz" : "Monthly AI analysis"}
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    {planLabel} · {creditRemaining}/{creditLimit}
                  </Text>
                </BlockStack>
                <Badge tone={creditRemaining > 0 ? "success" : "critical"}>
                  {creditRemaining > 0
                    ? i18n.language?.startsWith("tr") ? "Kota var" : "Available"
                    : i18n.language?.startsWith("tr") ? "Kota dolu" : "Limit reached"}
                </Badge>
              </InlineStack>
            </Box>
          </BlockStack>
        </Modal.Section>
      </Modal>
      <div className="seo-control-shell">
        <div className="seo-control-head">
          <div className="seo-control-title">
            <div className="seo-control-mark">✦</div>
            <div>
              <h2>{t("seo.pageTitle")}</h2>
              <p>{t("seo.pageSubtitle")}</p>
            </div>
          </div>
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
        </div>

        <div className="seo-control-grid">
          <div className={`seo-metric ${displayResult ? scoreStateClass : ""}`}>
            <span>{t("seo.score.heading")}</span>
            <strong>{displayResult ? scoreValue : "—"}</strong>
          </div>
          <div className="seo-metric seo-score-poor">
            <span>{t("seo.score.issuesHeading", { count: issueCount })}</span>
            <strong>{displayResult ? issueCount : "—"}</strong>
          </div>
          <div className="seo-metric">
            <span>{t("seo.history.heading")}</span>
            <strong>{selectedProduct ? historyCount : "—"}</strong>
          </div>
          <div className="seo-metric seo-score-good">
            <span>{t("seo.history.appliedBadge")}</span>
            <strong>{displayResult?.appliedAt || allSuggestionsApplied ? "✓" : "—"}</strong>
          </div>
        </div>

        <div className="seo-control-workspace">
          <aside className="seo-panel">
            <p className="seo-panel-title">{i18n.language?.startsWith("tr") ? "Ürünler" : "Products"}</p>
            <div className="seo-product-list">
              {productSummaries.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className={`seo-product-row ${selectedProduct?.id === product.id ? "is-active" : ""}`}
                  onClick={() => handleProductSelect(product)}
                >
                  <div className="seo-product-row-main">
                    {product.image ? (
                      <img src={product.image} alt={product.title} loading="lazy" decoding="async" />
                    ) : (
                      <div className="seo-product-fallback">IMG</div>
                    )}
                    <div>
                      <p className="seo-product-title">{product.title}</p>
                      {product.handle && <p className="seo-muted">/{product.handle}</p>}
                    </div>
                    <Badge tone={product.score >= 80 ? "success" : product.score >= 50 ? "warning" : "critical"}>
                      {product.score}
                    </Badge>
                  </div>
                  <div className="seo-product-meta">
                    <span className="seo-product-chip">{product.imageCount} img</span>
                    <span className="seo-product-chip">{Math.max(0, product.imageCount - product.missingAltCount)}/{product.imageCount} alt</span>
                    <span>· {formatUpdatedAt(product.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <p className="seo-panel-title">{t("seo.step1.heading")}</p>
            </div>
            {selectedProduct ? (
              <div className="seo-product-card">
                {selectedImage ? (
                  <Thumbnail source={selectedImage} alt={selectedProduct.title} size="medium" />
                ) : (
                  <div className="seo-product-fallback">IMG</div>
                )}
                <div>
                  <p className="seo-product-title">{selectedProduct.title}</p>
                  <div style={{ marginTop: 6 }}>
                    <Badge tone="success">{t("seo.step1.selected")}</Badge>
                  </div>
                </div>
              </div>
            ) : (
              <p className="seo-muted">{t("common.noProductSelected")}</p>
            )}
            <div className="seo-actions">
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
            </div>

            {selectedProduct && (
              <div style={{ marginTop: 18 }}>
                <p className="seo-panel-title">{t("seo.history.heading")}</p>
                {historyItems.length === 0 ? (
                  <p className="seo-muted">{t("seo.history.empty")}</p>
                ) : (
                  <div className="seo-history-list">
                    {historyItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="seo-history-item"
                        onClick={() => handleHistoryClick(item.id)}
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="span" variant="bodySm">
                            {new Date(item.createdAt).toLocaleDateString(dateLocale, {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                          <InlineStack gap="100" blockAlign="center">
                            {item.appliedAt && <Badge tone="success">{t("seo.history.appliedBadge")}</Badge>}
                            <Badge tone={item.score >= 80 ? "success" : item.score >= 50 ? "warning" : "critical"}>
                              {item.score}
                            </Badge>
                            {isLoadingHistoryItem && loadingAuditId === item.id && <Spinner size="small" />}
                          </InlineStack>
                        </InlineStack>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>

          <main>
        {error && (
          <Box paddingBlockEnd="300">
            <Banner title={t("seo.errorBanner.title")} tone="critical"><p>{error}</p></Banner>
          </Box>
        )}

        {fetcher.data?.applied && (
          <Box paddingBlockEnd="300">
            <Banner title={t("seo.appliedBanner.title")} tone="success">
              <p>{t("seo.appliedBanner.body")}</p>
            </Banner>
          </Box>
        )}

        {isWorking && formIntent === "audit" && (
          <div className="seo-main-empty">
            <div>
              <div className="seo-main-empty-icon"><Spinner size="small" /></div>
              <p className="seo-product-title">{t("seo.step1.auditing")}</p>
              <p className="seo-muted">{t("seo.auditingMessage")}</p>
            </div>
          </div>
        )}

        {!selectedProduct && !(isWorking && formIntent === "audit") && (
          <div className="seo-main-empty">
            <div>
              <div className="seo-main-empty-icon">✦</div>
              <p className="seo-product-title">{t("seo.step1.heading")}</p>
              <p className="seo-muted">{t("common.noProductSelected")}</p>
              <div style={{ marginTop: 14 }}>
                <Button onClick={handleProductPick}>{t("common.selectProduct")}</Button>
              </div>
            </div>
          </div>
        )}

        {selectedProduct && !displayResult?.success && !(isWorking && formIntent === "audit") && (
          <div className="seo-main-empty">
            <div>
              <div className="seo-main-empty-icon">⌁</div>
              <p className="seo-product-title">{t("seo.step1.runAudit")}</p>
              <p className="seo-muted">{t("seo.pageSubtitle")}</p>
              <div style={{ marginTop: 14 }}>
                <Button variant="primary" onClick={handleAudit}>{t("seo.step1.runAudit")}</Button>
              </div>
            </div>
          </div>
        )}

        {displayResult?.success && !(isWorking && formIntent === "audit") && (
          <>
            <div className="seo-result-head">
              <ScoreRing score={displayResult.score} />
              <div style={{ flex: 1 }}>
                <p className="seo-product-title">{t("seo.score.heading")}</p>
                <p className="seo-muted">{displayResult.productTitle}</p>
                <Box paddingBlockStart="200">
                  <ProgressBar
                    progress={displayResult.score}
                    tone={displayResult.score >= 80 ? "success" : displayResult.score >= 50 ? "warning" : "critical"}
                  />
                </Box>
              </div>
              <InlineStack gap="200" blockAlign="center">
                {displayResult.fromHistory && (
                  <Badge tone="info">{t("seo.history.fromHistoryBadge")}</Badge>
                )}
                <Badge tone={displayResult.score >= 80 ? "success" : displayResult.score >= 50 ? "warning" : "critical"}>
                  {t("seo.score.value", { score: displayResult.score })}
                </Badge>
              </InlineStack>
            </div>

            <div className="seo-result-sections">
              <Card>
                <BlockStack gap="300" inlineAlign="center">
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
            </div>

            {showThemeSection && (
              <Box paddingBlockStart="300">
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
              </Box>
            )}

            {suggestionFieldKeys.length > 0 && (
              <Box paddingBlockStart="300">
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="050">
                        <Text as="h2" variant="headingMd">{t("seo.suggestions.heading")}</Text>
                        <Text as="p" tone="subdued" variant="bodySm">
                          {t("seo.suggestions.description")}
                        </Text>
                      </BlockStack>
                      {allSuggestionsApplied ? (
                        <Badge tone="success">{t("seo.history.appliedBadge")}</Badge>
                      ) : (
                        <Button variant="primary" onClick={handleApplyAll} loading={isApplying && pendingField === "all"}>
                          {isApplying && pendingField === "all" ? t("seo.suggestions.applying") : t("seo.suggestions.apply")}
                        </Button>
                      )}
                    </InlineStack>

                    <Divider />

                    {displayResult.suggestions.title && (
                      <BlockStack gap="100">
                        <TextField
                          label={t("seo.suggestions.seoTitle.label")}
                          value={getValue("title")}
                          onChange={(v) => updateSuggestion("title", v)}
                          helpText={t("seo.suggestions.seoTitle.helpText", { count: getValue("title").length })}
                          autoComplete="off"
                          disabled={appliedFields.includes("title")}
                        />
                        <InlineStack align="end">
                          {appliedFields.includes("title") ? (
                            <Badge tone="success">{t("seo.history.appliedBadge")}</Badge>
                          ) : (
                            <Button size="slim" onClick={() => handleApplySection("title")} loading={isApplying && pendingField === "title"}>
                              {t("seo.suggestions.applySection")}
                            </Button>
                          )}
                        </InlineStack>
                      </BlockStack>
                    )}

                    {displayResult.suggestions.metaDescription && (
                      <BlockStack gap="100">
                        <TextField
                          label={t("seo.suggestions.metaDescription.label")}
                          value={getValue("metaDescription")}
                          onChange={(v) => updateSuggestion("metaDescription", v)}
                          multiline={3}
                          helpText={t("seo.suggestions.metaDescription.helpText", { count: getValue("metaDescription").length })}
                          autoComplete="off"
                          disabled={appliedFields.includes("metaDescription")}
                        />
                        <InlineStack align="end">
                          {appliedFields.includes("metaDescription") ? (
                            <Badge tone="success">{t("seo.history.appliedBadge")}</Badge>
                          ) : (
                            <Button size="slim" onClick={() => handleApplySection("metaDescription")} loading={isApplying && pendingField === "metaDescription"}>
                              {t("seo.suggestions.applySection")}
                            </Button>
                          )}
                        </InlineStack>
                      </BlockStack>
                    )}

                    {displayResult.suggestions.handle && (
                      <BlockStack gap="100">
                        <TextField
                          label={t("seo.suggestions.handle.label")}
                          value={getValue("handle")}
                          onChange={(v) => updateSuggestion("handle", v)}
                          prefix="/products/"
                          autoComplete="off"
                          disabled={appliedFields.includes("handle")}
                        />
                        <InlineStack align="end">
                          {appliedFields.includes("handle") ? (
                            <Badge tone="success">{t("seo.history.appliedBadge")}</Badge>
                          ) : (
                            <Button size="slim" onClick={() => handleApplySection("handle")} loading={isApplying && pendingField === "handle"}>
                              {t("seo.suggestions.applySection")}
                            </Button>
                          )}
                        </InlineStack>
                      </BlockStack>
                    )}

                    {displayResult.suggestions.altText && (
                      <BlockStack gap="100">
                        <TextField
                          label={t("seo.suggestions.altText.label", { count: displayResult.imagesWithoutAlt?.length || 0 })}
                          value={getValue("altText")}
                          onChange={(v) => updateSuggestion("altText", v)}
                          autoComplete="off"
                          disabled={appliedFields.includes("altText")}
                        />
                        <InlineStack align="end">
                          {appliedFields.includes("altText") ? (
                            <Badge tone="success">{t("seo.history.appliedBadge")}</Badge>
                          ) : (
                            <Button size="slim" onClick={() => handleApplySection("altText")} loading={isApplying && pendingField === "altText"}>
                              {t("seo.suggestions.applySection")}
                            </Button>
                          )}
                        </InlineStack>
                      </BlockStack>
                    )}

                    {displayResult.suggestions.bodyDescription && (
                      <BlockStack gap="100">
                        <TextField
                          label={t("seo.suggestions.bodyDescription.label")}
                          value={getValue("bodyDescription")}
                          onChange={(v) => updateSuggestion("bodyDescription", v)}
                          multiline={6}
                          helpText={t("seo.suggestions.bodyDescription.helpText")}
                          autoComplete="off"
                          disabled={appliedFields.includes("bodyDescription")}
                        />
                        <InlineStack align="end">
                          {appliedFields.includes("bodyDescription") ? (
                            <Badge tone="success">{t("seo.history.appliedBadge")}</Badge>
                          ) : (
                            <Button size="slim" onClick={() => handleApplySection("bodyDescription")} loading={isApplying && pendingField === "bodyDescription"}>
                              {t("seo.suggestions.applySection")}
                            </Button>
                          )}
                        </InlineStack>
                      </BlockStack>
                    )}

                    {displayResult.suggestions.tags?.length > 0 && (
                      <BlockStack gap="100">
                        <Text as="p" fontWeight="semibold">{t("seo.suggestions.tags.label")}</Text>
                        <Text as="p" tone="subdued" variant="bodySm">{t("seo.suggestions.tags.helpText")}</Text>
                        <InlineStack gap="100">
                          {displayResult.suggestions.tags.map((tag, i) => (
                            <Tag key={i}>{tag}</Tag>
                          ))}
                        </InlineStack>
                        <InlineStack align="end">
                          {appliedFields.includes("tags") ? (
                            <Badge tone="success">{t("seo.history.appliedBadge")}</Badge>
                          ) : (
                            <Button size="slim" onClick={() => handleApplySection("tags")} loading={isApplying && pendingField === "tags"}>
                              {t("seo.suggestions.applySection")}
                            </Button>
                          )}
                        </InlineStack>
                      </BlockStack>
                    )}
                  </BlockStack>
                </Card>
              </Box>
            )}
          </>
        )}
          </main>
        </div>
      </div>
    </Page>
  );
}
