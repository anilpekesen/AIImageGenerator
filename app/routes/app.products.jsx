import { useState, useCallback, useMemo } from "react";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { json } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Banner,
  BlockStack,
  InlineStack,
  InlineGrid,
  Badge,
  Thumbnail,
  Box,
  DataTable,
  TextField,
} from "@shopify/polaris";
import { ImageIcon, ExportIcon } from "@shopify/polaris-icons";
import { useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";
import { fetchProductsForList, addImagesToProduct } from "../services/product.server";
import { auditProduct } from "../services/seo-audit.server";
import { getProductIdsWithGenerations } from "../models/generation.server";
import { getLatestAppliedMap } from "../models/seo-audit.server";
import i18next from "../i18next.server";
import ProductShootsModal from "../components/ProductShootsModal";
import { downloadCsv } from "../utils/csv";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const locale = await i18next.getLocale(request);
  const t = await i18next.getFixedT(locale);

  let productList;
  try {
    productList = await fetchProductsForList(admin, { first: 50 });
  } catch (error) {
    console.error("Products page product fetch failed", {
      shop: session.shop,
      status: error?.status || error?.response?.status || error?.response?.code,
      name: error?.name,
      message: error?.message,
    });
    return json({
      products: [],
      hasNextPage: false,
      productAccessError: true,
      stats: { avgScore: 0, needsWork: 0, couldBeBetter: 0, wellOptimized: 0 },
    });
  }

  const { nodes, pageInfo } = productList;
  const productIdsWithGenerations = await getProductIdsWithGenerations(session.shop);
  const appliedMap = await getLatestAppliedMap(session.shop);

  const products = nodes.map((product) => {
    const audit = auditProduct(product, t);
    const id = product.id.replace("gid://shopify/Product/", "");
    const applied = appliedMap[id];
    return {
      id,
      title: product.title,
      image: product.featuredImage?.url || null,
      isActive: product.status === "ACTIVE",
      score: audit.score,
      issueCount: audit.issues.length,
      hasGenerations: productIdsWithGenerations.has(id),
      lastOptimized: applied?.appliedAt || null,
      appliedFields: applied?.appliedFields || [],
    };
  });

  const stats = {
    avgScore: products.length > 0 ? Math.round(products.reduce((sum, p) => sum + p.score, 0) / products.length) : 0,
    needsWork: products.filter((p) => p.score < 50).length,
    couldBeBetter: products.filter((p) => p.score >= 50 && p.score < 75).length,
    wellOptimized: products.filter((p) => p.score >= 75).length,
  };

  return json({ products, hasNextPage: pageInfo.hasNextPage, productAccessError: false, stats });
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const locale = await i18next.getLocale(request);
  const t = await i18next.getFixedT(locale);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save-to-product") {
    const productId = formData.get("productId");
    const imageUrls = JSON.parse(formData.get("imageUrls") || "[]");

    try {
      const result = await addImagesToProduct(admin, productId, imageUrls);
      if (!result.success) {
        return json({ error: t("generate.errors.saveFailed", { message: result.errors.join(", ") }) }, { status: 500 });
      }
      return json({ saved: true });
    } catch (error) {
      return json({ error: t("generate.errors.saveFailed", { message: error.message }) }, { status: 500 });
    }
  }

  return json({ error: t("generate.errors.invalidAction") }, { status: 400 });
};

function scoreTone(score) {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "critical";
}

const dateLocales = { tr: "tr-TR", en: "en-US" };

const SECTION_BADGE_GROUPS = [
  { key: "title", labelKey: "products.sectionLabels.title", fields: ["title"] },
  { key: "description", labelKey: "products.sectionLabels.description", fields: ["metaDescription", "bodyDescription"] },
  { key: "handle", labelKey: "products.sectionLabels.handle", fields: ["handle"] },
  { key: "tags", labelKey: "products.sectionLabels.tags", fields: ["tags"] },
  { key: "altText", labelKey: "products.sectionLabels.altText", fields: ["altText"] },
];

function appliedFieldLabels(appliedFields, t) {
  return SECTION_BADGE_GROUPS.filter((group) =>
    group.fields.some((field) => appliedFields.includes(field))
  )
    .map((group) => t(group.labelKey))
    .join(", ");
}

export default function Products() {
  const { products, hasNextPage, productAccessError, stats } = useLoaderData();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const dateLocale = dateLocales[i18n.language] || "en-US";

  const [shootsProduct, setShootsProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [sortState, setSortState] = useState({ index: 2, direction: "ascending" });

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((p) => p.title.toLowerCase().includes(term));
  }, [products, search]);

  const sortedProducts = useMemo(() => {
    const { index, direction } = sortState;
    const key = index === 2 ? "score" : index === 3 ? "issueCount" : null;
    if (!key) return filteredProducts;
    const dir = direction === "ascending" ? 1 : -1;
    return [...filteredProducts].sort((a, b) => (a[key] - b[key]) * dir);
  }, [filteredProducts, sortState]);

  const handleSort = useCallback((index, direction) => {
    setSortState({ index, direction });
  }, []);

  const totalIssues = useMemo(
    () => sortedProducts.reduce((sum, p) => sum + p.issueCount, 0),
    [sortedProducts]
  );

  const handleExportCsv = useCallback(() => {
    const headers = [
      t("products.table.product"),
      t("products.table.status"),
      t("products.table.score"),
      t("products.table.issues"),
      t("products.table.lastOptimized"),
    ];
    const rows = sortedProducts.map((product) => [
      product.title,
      product.isActive ? t("products.status.active") : t("products.status.draft"),
      String(product.score),
      String(product.issueCount),
      product.lastOptimized
        ? [new Date(product.lastOptimized).toISOString().slice(0, 10), appliedFieldLabels(product.appliedFields, t)]
            .filter(Boolean)
            .join(" - ")
        : "",
    ]);
    downloadCsv("seo-genel-bakis.csv", headers, rows);
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
        <Badge key={`score-${product.id}`} tone={scoreTone(product.score)}>
          {t("products.seoScore", { score: product.score })}
        </Badge>,
        product.issueCount,
        product.lastOptimized ? (
          <BlockStack key={`optimized-${product.id}`} gap="100">
            <Text as="span" tone="subdued" variant="bodySm">
              {t("products.lastOptimized", {
                date: new Date(product.lastOptimized).toLocaleDateString(dateLocale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              })}
            </Text>
            <InlineStack gap="100" wrap>
              {SECTION_BADGE_GROUPS.filter((group) =>
                group.fields.some((field) => product.appliedFields.includes(field))
              ).map((group) => (
                <Badge key={group.key} size="small" tone="success">
                  {t(group.labelKey)}
                </Badge>
              ))}
            </InlineStack>
          </BlockStack>
        ) : (
          <Text as="span" tone="subdued">
            —
          </Text>
        ),
        <InlineStack key={`actions-${product.id}`} gap="150" wrap>
          <Button size="slim" onClick={() => navigate(`/app/seo?productId=${product.id}`)}>
            {t("products.actions.seo")}
          </Button>
          <Button size="slim" onClick={() => navigate(`/app/competition?productId=${product.id}`)}>
            {t("products.actions.competitorAnalysis")}
          </Button>
          {product.hasGenerations && (
            <Button size="slim" onClick={() => setShootsProduct(product)}>
              {t("products.actions.viewShoots")}
            </Button>
          )}
          <Button size="slim" variant="primary" onClick={() => navigate(`/app/generate?productId=${product.id}`)}>
            {t("products.actions.generateImage")}
          </Button>
        </InlineStack>,
      ]),
    [sortedProducts, t, dateLocale, navigate]
  );

  return (
    <Page
      title={t("products.pageTitle")}
      subtitle={t("products.pageSubtitle")}
      secondaryActions={[
        {
          content: t("products.exportCsv"),
          icon: ExportIcon,
          onAction: handleExportCsv,
          disabled: sortedProducts.length === 0,
        },
      ]}
    >
      <Layout>
        {productAccessError && (
          <Layout.Section>
            <Banner title={t("products.productAccessError.title")} tone="warning">
              <p>{t("products.productAccessError.body")}</p>
            </Banner>
          </Layout.Section>
        )}

        {products.length === 0 ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text as="h2" variant="headingMd">
                  {t("products.empty.heading")}
                </Text>
                <Text as="p" tone="subdued">
                  {t("products.empty.body")}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : (
          <>
            <Layout.Section>
              <InlineGrid columns={{ xs: 2, sm: 4 }} gap="400">
                <Card>
                  <BlockStack gap="100">
                    <Text as="p" tone="subdued" variant="bodySm">{t("products.stats.avgScore")}</Text>
                    <Text as="p" variant="headingLg">{stats.avgScore}</Text>
                  </BlockStack>
                </Card>
                <Card>
                  <BlockStack gap="100">
                    <Text as="p" tone="subdued" variant="bodySm">{t("products.stats.needsWork")}</Text>
                    <Text as="p" variant="headingLg" tone="critical">{stats.needsWork}</Text>
                  </BlockStack>
                </Card>
                <Card>
                  <BlockStack gap="100">
                    <Text as="p" tone="subdued" variant="bodySm">{t("products.stats.couldBeBetter")}</Text>
                    <Text as="p" variant="headingLg" tone="caution">{stats.couldBeBetter}</Text>
                  </BlockStack>
                </Card>
                <Card>
                  <BlockStack gap="100">
                    <Text as="p" tone="subdued" variant="bodySm">{t("products.stats.wellOptimized")}</Text>
                    <Text as="p" variant="headingLg" tone="success">{stats.wellOptimized}</Text>
                  </BlockStack>
                </Card>
              </InlineGrid>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <TextField
                  label={t("products.search.label")}
                  labelHidden
                  placeholder={t("products.search.placeholder")}
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
                      {t("products.emptyFiltered")}
                    </Text>
                  </Box>
                </Card>
              ) : (
                <Card padding="0">
                  <DataTable
                    columnContentTypes={["text", "text", "numeric", "numeric", "text", "text"]}
                    headings={[
                      t("products.table.product"),
                      t("products.table.status"),
                      t("products.table.score"),
                      t("products.table.issues"),
                      t("products.table.lastOptimized"),
                      t("products.table.actions"),
                    ]}
                    rows={tableRows}
                    totals={["", "", String(stats.avgScore), String(totalIssues), "", ""]}
                    totalsName={{
                      singular: t("products.totalsLabel", { count: sortedProducts.length }),
                      plural: t("products.totalsLabel", { count: sortedProducts.length }),
                    }}
                    sortable={[false, false, true, true, false, false]}
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
                    {t("products.firstFiftyNotice")}
                  </Text>
                </Box>
              )}
            </Layout.Section>
          </>
        )}
      </Layout>

      {shootsProduct && (
        <ProductShootsModal
          productId={shootsProduct.id}
          productTitle={shootsProduct.title}
          onClose={() => setShootsProduct(null)}
        />
      )}
    </Page>
  );
}
