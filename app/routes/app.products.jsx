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
  Badge,
  Thumbnail,
  Divider,
  Box,
  Tabs,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";
import { fetchProductsForList, addImagesToProduct } from "../services/product.server";
import { auditProduct } from "../services/seo-audit.server";
import { getProductIdsWithGenerations } from "../models/generation.server";
import i18next from "../i18next.server";
import ProductShootsModal from "../components/ProductShootsModal";

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
    return json({ products: [], hasNextPage: false, productAccessError: true });
  }

  const { nodes, pageInfo } = productList;
  const productIdsWithGenerations = await getProductIdsWithGenerations(session.shop);

  const products = nodes.map((product) => {
    const audit = auditProduct(product, t);
    const id = product.id.replace("gid://shopify/Product/", "");
    return {
      id,
      title: product.title,
      image: product.featuredImage?.url || null,
      isActive: product.status === "ACTIVE",
      score: audit.score,
      issueCount: audit.issues.length,
      hasGenerations: productIdsWithGenerations.has(id),
    };
  });

  return json({ products, hasNextPage: pageInfo.hasNextPage, productAccessError: false });
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

export default function Products() {
  const { products, hasNextPage, productAccessError } = useLoaderData();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [selectedTab, setSelectedTab] = useState(0);
  const handleTabChange = useCallback((index) => setSelectedTab(index), []);
  const [shootsProduct, setShootsProduct] = useState(null);

  const activeProducts = useMemo(() => products.filter((p) => p.isActive), [products]);
  const passiveProducts = useMemo(() => products.filter((p) => !p.isActive), [products]);

  const tabs = [
    { id: "active", content: t("products.tabs.active", { count: activeProducts.length }) },
    { id: "passive", content: t("products.tabs.passive", { count: passiveProducts.length }) },
  ];
  const visibleProducts = selectedTab === 0 ? activeProducts : passiveProducts;

  return (
    <Page title={t("products.pageTitle")} subtitle={t("products.pageSubtitle")}>
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
          <Layout.Section>
            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} />

              {visibleProducts.length === 0 ? (
                <Box padding="400">
                  <Text as="p" tone="subdued" alignment="center">
                    {t("products.emptyFiltered")}
                  </Text>
                </Box>
              ) : (
              <BlockStack>
                {visibleProducts.map((product, index) => (
                  <div key={product.id}>
                    <Box padding="400">
                      <InlineStack align="space-between" blockAlign="center" wrap={false} gap="400">
                        <InlineStack gap="300" blockAlign="center" wrap={false}>
                          <Thumbnail
                            source={product.image || ImageIcon}
                            alt={product.title}
                            size="small"
                          />
                          <BlockStack gap="100">
                            <Text as="p" fontWeight="semibold">
                              {product.title}
                            </Text>
                            <InlineStack gap="150" blockAlign="center">
                              <Badge tone={scoreTone(product.score)}>
                                {t("products.seoScore", { score: product.score })}
                              </Badge>
                              {product.issueCount > 0 && (
                                <Text as="span" tone="subdued" variant="bodySm">
                                  {t("products.issueCount", { count: product.issueCount })}
                                </Text>
                              )}
                            </InlineStack>
                          </BlockStack>
                        </InlineStack>

                        <InlineStack gap="200" wrap={false}>
                          <Button onClick={() => navigate(`/app/seo?productId=${product.id}`)}>
                            {t("products.actions.seo")}
                          </Button>
                          <Button onClick={() => navigate(`/app/competition?productId=${product.id}`)}>
                            {t("products.actions.competitorAnalysis")}
                          </Button>
                          {product.hasGenerations && (
                            <Button onClick={() => setShootsProduct(product)}>
                              {t("products.actions.viewShoots")}
                            </Button>
                          )}
                          <Button
                            variant="primary"
                            onClick={() => navigate(`/app/generate?productId=${product.id}`)}
                          >
                            {t("products.actions.generateImage")}
                          </Button>
                        </InlineStack>
                      </InlineStack>
                    </Box>
                    {index < visibleProducts.length - 1 && <Divider />}
                  </div>
                ))}
              </BlockStack>
              )}
            </Card>

            {hasNextPage && (
              <Box paddingBlockStart="400">
                <Text as="p" tone="subdued" variant="bodySm" alignment="center">
                  {t("products.firstFiftyNotice")}
                </Text>
              </Box>
            )}
          </Layout.Section>
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
