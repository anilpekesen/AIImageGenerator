import { useState, useRef, useCallback } from "react";
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
  InlineGrid,
  Badge,
  ProgressBar,
  Banner,
  Divider,
  Box,
  Icon,
  Thumbnail,
  Modal,
} from "@shopify/polaris";
import {
  ImageIcon,
  ClockIcon,
  StarIcon,
  ProductIcon,
  MagicIcon,
  SearchIcon,
  ChartVerticalIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@shopify/polaris-icons";
import { Trans, useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";
import { getOrCreateSubscription } from "../models/subscription.server";
import { getRecentGenerations, countDoneGenerations } from "../models/generation.server";
import { fetchProductsForList, fetchProductsCount } from "../services/product.server";
import { auditProduct } from "../services/seo-audit.server";
import { countAnalyses } from "../models/competitor-analysis.server";
import { countAudits } from "../models/seo-audit.server";
import { PHOTO_SETS } from "../services/photo-sets.js";
import i18next from "../i18next.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const { shop } = session;
  const locale = await i18next.getLocale(request);
  const t = await i18next.getFixedT(locale);

  const [
    subscription,
    recentGenerations,
    { nodes: productNodes },
    productsCount,
    competitorAnalysesCount,
    seoAuditsCount,
    doneGenerationsCount,
  ] = await Promise.all([
    getOrCreateSubscription(shop),
    getRecentGenerations(shop, 3),
    fetchProductsForList(admin, { first: 50 }),
    fetchProductsCount(admin),
    countAnalyses(shop),
    countAudits(shop),
    countDoneGenerations(shop),
  ]);

  const scoredProducts = productNodes.map((product) => {
    const audit = auditProduct(product, t);
    return {
      id: product.id.replace("gid://shopify/Product/", ""),
      title: product.title,
      image: product.featuredImage?.url || null,
      score: audit.score,
      issueCount: audit.issues.length,
    };
  });

  const sortedByScore = [...scoredProducts].sort((a, b) => b.score - a.score);
  const bestProduct = sortedByScore[0] || null;
  const worstProduct = sortedByScore.length > 1 ? sortedByScore[sortedByScore.length - 1] : null;
  const avgSeoScore = scoredProducts.length
    ? Math.round(scoredProducts.reduce((sum, p) => sum + p.score, 0) / scoredProducts.length)
    : null;

  return json({
    subscription,
    recentGenerations,
    shop,
    productsCount,
    avgSeoScore,
    bestProduct,
    worstProduct,
    stats: {
      competitorAnalysesCount,
      seoAuditsCount,
      doneGenerationsCount,
    },
  });
};

function StatTile({ icon, tone, label, value }) {
  return (
    <Card>
      <BlockStack gap="300">
        <Box background={`bg-fill-${tone}`} padding="200" borderRadius="200" width="fit-content">
          <Icon source={icon} tone={tone} />
        </Box>
        <BlockStack gap="050">
          <Text as="p" variant="heading2xl">{value}</Text>
          <Text as="p" tone="subdued" variant="bodySm">{label}</Text>
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

function ProductHighlightRow({ icon, tone, label, product, actionLabel, onAction, t }) {
  return (
    <InlineStack align="space-between" blockAlign="center" wrap={false} gap="400">
      <InlineStack gap="300" blockAlign="center" wrap={false}>
        <Box background={`bg-fill-${tone}`} padding="150" borderRadius="200">
          <Icon source={icon} tone={tone} />
        </Box>
        <Thumbnail source={product.image || ImageIcon} alt={product.title} size="small" />
        <BlockStack gap="050">
          <Text as="p" tone="subdued" variant="bodySm">{label}</Text>
          <Text as="p" fontWeight="semibold" truncate>{product.title}</Text>
          <Badge tone={tone === "critical" ? "critical" : "success"}>
            {t("dashboard.seoInsights.score", { score: product.score })}
          </Badge>
        </BlockStack>
      </InlineStack>
      <Button onClick={onAction}>{actionLabel}</Button>
    </InlineStack>
  );
}

export default function Index() {
  const { subscription, recentGenerations, productsCount, avgSeoScore, bestProduct, worstProduct, stats } = useLoaderData();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? "tr";

  const [activeSetId, setActiveSetId] = useState(null);
  const activeSet = activeSetId ? PHOTO_SETS.find((s) => s.id === activeSetId) : null;
  const [modalImage, setModalImage] = useState(null);
  const fileInputRef = useRef(null);

  const handleModalClose = useCallback(() => {
    setActiveSetId(null);
    setModalImage(null);
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setModalImage(ev.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleModalGenerate = useCallback(() => {
    handleModalClose();
    navigate(`/app/generate?photoSetId=${activeSetId}`);
  }, [activeSetId, navigate, handleModalClose]);

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

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            <StatTile
              icon={ProductIcon}
              tone="info"
              label={t("dashboard.stats.totalProducts")}
              value={productsCount}
            />
            <StatTile
              icon={MagicIcon}
              tone="magic"
              label={t("dashboard.stats.remainingCredits")}
              value={remaining}
            />
            <StatTile
              icon={SearchIcon}
              tone="success"
              label={t("dashboard.stats.avgSeoScore")}
              value={avgSeoScore != null ? t("dashboard.seoInsights.score", { score: avgSeoScore }) : "—"}
            />
            <StatTile
              icon={ChartVerticalIcon}
              tone="warning"
              label={t("dashboard.stats.competitorAnalyses")}
              value={stats.competitorAnalysesCount}
            />
          </InlineGrid>
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

              <Divider />

              <BlockStack gap="150">
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued" variant="bodySm">
                    {t("dashboard.stats.totalProducts")}
                  </Text>
                  <Text as="p" fontWeight="semibold" variant="bodySm">{productsCount}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued" variant="bodySm">
                    {t("dashboard.stats.competitorAnalyses")}
                  </Text>
                  <Text as="p" fontWeight="semibold" variant="bodySm">{stats.competitorAnalysesCount}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued" variant="bodySm">
                    {t("dashboard.stats.seoAudits")}
                  </Text>
                  <Text as="p" fontWeight="semibold" variant="bodySm">{stats.seoAuditsCount}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued" variant="bodySm">
                    {t("dashboard.stats.totalGenerations")}
                  </Text>
                  <Text as="p" fontWeight="semibold" variant="bodySm">{stats.doneGenerationsCount}</Text>
                </InlineStack>
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
                  {t("dashboard.seoInsights.heading")}
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  {t("dashboard.seoInsights.subheading")}
                </Text>
              </BlockStack>

              {bestProduct ? (
                <BlockStack gap="400">
                  <ProductHighlightRow
                    icon={ArrowUpIcon}
                    tone="success"
                    label={t("dashboard.seoInsights.bestProduct")}
                    product={bestProduct}
                    actionLabel={t("dashboard.seoInsights.action")}
                    onAction={() => navigate(`/app/seo?productId=${bestProduct.id}`)}
                    t={t}
                  />
                  {worstProduct && (
                    <>
                      <Divider />
                      <ProductHighlightRow
                        icon={ArrowDownIcon}
                        tone="critical"
                        label={t("dashboard.seoInsights.worstProduct")}
                        product={worstProduct}
                        actionLabel={t("dashboard.seoInsights.action")}
                        onAction={() => navigate(`/app/seo?productId=${worstProduct.id}`)}
                        t={t}
                      />
                    </>
                  )}
                </BlockStack>
              ) : (
                <Text as="p" tone="subdued">{t("dashboard.seoInsights.empty")}</Text>
              )}

              <Button onClick={() => navigate("/app/products")}>
                {t("dashboard.seoInsights.viewAllProducts")}
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

        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">
                    {t("dashboard.photoSets.heading")}
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm">
                    {t("dashboard.photoSets.subheading")}
                  </Text>
                </BlockStack>
                <Button variant="plain" onClick={() => navigate("/app/generate")}>
                  {t("dashboard.photoSets.viewAll")}
                </Button>
              </InlineStack>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: "10px",
              }}>
                {PHOTO_SETS.map((set) => {
                  const shortLabel = locale === "tr"
                    ? set.labelTR.replace(" Fotoğraf Seti", "")
                    : set.labelEN.replace(" Photo Set", "");
                  return (
                    <div
                      key={set.id}
                      onClick={() => setActiveSetId(set.id)}
                      style={{
                        cursor: "pointer",
                        borderRadius: "10px",
                        overflow: "hidden",
                        position: "relative",
                        aspectRatio: "1 / 1",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.transition = "transform 0.15s ease"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                    >
                      <img
                        src={set.exampleImage}
                        alt={shortLabel}
                        loading="lazy"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                      <div style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.2) 65%, transparent 100%)",
                        padding: "28px 8px 8px",
                      }}>
                        <p style={{ margin: 0, color: "#fff", fontSize: "11px", fontWeight: "650", lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
                          {shortLabel}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
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

              <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
                <InlineStack gap="300" blockAlign="center" wrap={false}>
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

                <InlineStack gap="300" blockAlign="center" wrap={false}>
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

                <InlineStack gap="300" blockAlign="center" wrap={false}>
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
              </InlineGrid>

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
      </Layout>

      {activeSet && (
        <Modal
          open={activeSetId !== null}
          onClose={handleModalClose}
          title={locale === "tr" ? activeSet.labelTR : activeSet.labelEN}
        >
          <Modal.Section>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            {/* Top: image upload + description side by side */}
            <div style={{ display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>

              {/* Left: image upload area */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flexShrink: 0,
                  width: "140px",
                  height: "140px",
                  borderRadius: "12px",
                  overflow: "hidden",
                  cursor: "pointer",
                  position: "relative",
                  border: modalImage ? "2px solid var(--p-color-border-brand)" : "2px dashed var(--p-color-border)",
                  background: "var(--p-color-bg-surface-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {modalImage ? (
                  <>
                    <img src={modalImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <div style={{
                      position: "absolute", top: "6px", right: "6px",
                      background: "rgba(0,0,0,0.55)", borderRadius: "50%",
                      width: "24px", height: "24px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "12px" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--p-color-icon-subdued)" strokeWidth="1.5" style={{ margin: "0 auto 6px" }}>
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                    </svg>
                    <p style={{ margin: 0, fontSize: "11px", color: "var(--p-color-text-subdued)", lineHeight: 1.3 }}>
                      {t("dashboard.photoSets.uploadImage")}
                    </p>
                  </div>
                )}
              </div>

              {/* Right: description */}
              <div style={{ flex: 1, minWidth: "180px" }}>
                <p style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--p-color-text-subdued)", lineHeight: 1.5 }}>
                  {locale === "tr" ? activeSet.descriptionTR : activeSet.descriptionEN}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {activeSet.scenes.map((scene, idx) => (
                    <span key={scene.scene} style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      background: "var(--p-color-bg-fill-secondary)",
                      borderRadius: "100px", padding: "3px 10px",
                      fontSize: "11px", fontWeight: "600", color: "var(--p-color-text)",
                    }}>
                      <span style={{
                        width: "16px", height: "16px", borderRadius: "50%",
                        background: "var(--p-color-bg-fill-brand)", color: "white",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontSize: "9px", fontWeight: "700", flexShrink: 0,
                      }}>{idx + 1}</span>
                      {locale === "tr" ? scene.labelTR : scene.labelEN}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Example output image */}
            <div style={{ marginTop: "16px", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--p-color-border)" }}>
              <img
                src={activeSet.exampleImage}
                alt={locale === "tr" ? activeSet.labelTR : activeSet.labelEN}
                style={{ width: "100%", display: "block", maxHeight: "220px", objectFit: "cover" }}
              />
            </div>

            {/* Generate button */}
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <Button variant="primary" size="large" onClick={handleModalGenerate}>
                {t("dashboard.photoSets.runAI")}
                <span style={{ marginLeft: "6px" }}>→</span>
              </Button>
            </div>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
