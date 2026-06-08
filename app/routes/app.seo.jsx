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
  Divider,
  TextField,
  ProgressBar,
  Icon,
} from "@shopify/polaris";
import { AlertTriangleIcon, CheckCircleIcon } from "@shopify/polaris-icons";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";
import { fetchProductSeoData, auditProduct } from "../services/seo-audit.server";
import { generateSeoSuggestions } from "../services/ai-text.server";
import { createSeoAudit, markAudited } from "../models/seo-audit.server";
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

    try {
      const product = await fetchProductSeoData(admin, productId);
      const audit = auditProduct(product, t);

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
        issues: audit.issues,
        suggestions,
      });

      return json({
        success: true,
        auditId: saved.id,
        score: audit.score,
        issues: audit.issues,
        currentSeo: audit.currentSeo,
        suggestions,
        imagesWithoutAlt: audit.imagesWithoutAlt,
        productTitle,
        productId,
      });
    } catch (error) {
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
    const imageIds = JSON.parse(formData.get("imageIds") || "[]");

    try {
      const seoInput = {};
      if (title) seoInput.title = title;
      if (metaDescription) seoInput.description = metaDescription;

      const productInput = { id: `gid://shopify/Product/${productId}` };
      if (Object.keys(seoInput).length > 0) productInput.seo = seoInput;
      if (handle) productInput.handle = handle;

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

      await markAudited(auditId, { title, metaDescription, handle, altText });

      return json({ applied: true });
    } catch (error) {
      return json({ error: t("seo.errors.applyFailed", { message: error.message }) }, { status: 500 });
    }
  }

  return json({ error: t("seo.errors.invalidAction") }, { status: 400 });
};

const severityTone = { warning: "critical", info: "warning" };
const severityIcon = { warning: AlertTriangleIcon, info: AlertTriangleIcon };

export default function Seo() {
  const { preselectedProduct } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const actionData = useActionData();
  const shopify = useAppBridge();
  const { t } = useTranslation();

  const [selectedProduct, setSelectedProduct] = useState(preselectedProduct);
  const [editedSuggestions, setEditedSuggestions] = useState({});

  const isWorking = navigation.state === "submitting";
  const formIntent = navigation.formData?.get("intent");

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
    }
  }, [shopify, selectedProduct]);

  const handleAudit = useCallback(() => {
    if (!selectedProduct) return;
    const formData = new FormData();
    formData.append("intent", "audit");
    formData.append("productId", selectedProduct.id);
    formData.append("productTitle", selectedProduct.title);
    submit(formData, { method: "post" });
  }, [selectedProduct, submit]);

  const handleApply = useCallback(() => {
    if (!actionData?.auditId) return;
    const s = { ...actionData.suggestions, ...editedSuggestions };
    const formData = new FormData();
    formData.append("intent", "apply");
    formData.append("auditId", actionData.auditId);
    formData.append("productId", actionData.productId);
    if (s.title) formData.append("title", s.title);
    if (s.metaDescription) formData.append("metaDescription", s.metaDescription);
    if (s.handle) formData.append("handle", s.handle);
    if (s.altText) formData.append("altText", s.altText);
    formData.append(
      "imageIds",
      JSON.stringify((actionData.imagesWithoutAlt || []).map((img) => img.id))
    );
    submit(formData, { method: "post" });
    shopify.toast.show(t("seo.toast.applied"));
  }, [actionData, editedSuggestions, submit, shopify, t]);

  const updateSuggestion = (field, value) => {
    setEditedSuggestions((prev) => ({ ...prev, [field]: value }));
  };

  const getValue = (field) => editedSuggestions[field] ?? actionData?.suggestions?.[field] ?? "";

  return (
    <Page
      title={t("seo.pageTitle")}
      subtitle={t("seo.pageSubtitle")}
      backAction={{ url: "/app" }}
    >
      <Layout>
        {actionData?.error && (
          <Layout.Section>
            <Banner title={t("seo.errorBanner.title")} tone="critical"><p>{actionData.error}</p></Banner>
          </Layout.Section>
        )}

        {actionData?.applied && (
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

        {actionData?.success && (
          <>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">{t("seo.score.heading")}</Text>
                    <Badge tone={actionData.score >= 80 ? "success" : actionData.score >= 50 ? "warning" : "critical"}>
                      {t("seo.score.value", { score: actionData.score })}
                    </Badge>
                  </InlineStack>
                  <ProgressBar
                    progress={actionData.score}
                    tone={actionData.score >= 80 ? "success" : actionData.score >= 50 ? "warning" : "critical"}
                  />

                  {actionData.issues.length === 0 ? (
                    <InlineStack gap="200" blockAlign="center">
                      <Icon source={CheckCircleIcon} tone="success" />
                      <Text as="p">{t("seo.score.noIssues")}</Text>
                    </InlineStack>
                  ) : (
                    <BlockStack gap="200">
                      <Text as="p" fontWeight="semibold">
                        {t("seo.score.issuesHeading", { count: actionData.issues.length })}
                      </Text>
                      {actionData.issues.map((issue, i) => (
                        <InlineStack key={i} gap="200" blockAlign="start" wrap={false}>
                          <Icon source={AlertTriangleIcon} tone={severityTone[issue.severity] || "warning"} />
                          <BlockStack gap="025">
                            <Text as="p" fontWeight="semibold">{issue.label}</Text>
                            <Text as="p" tone="subdued" variant="bodySm">{issue.detail}</Text>
                          </BlockStack>
                        </InlineStack>
                      ))}
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>

            {Object.keys(actionData.suggestions || {}).some((k) => actionData.suggestions[k]) && (
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
                      <Button variant="primary" onClick={handleApply} loading={isWorking && formIntent === "apply"}>
                        {isWorking && formIntent === "apply" ? t("seo.suggestions.applying") : t("seo.suggestions.apply")}
                      </Button>
                    </InlineStack>

                    <Divider />

                    {actionData.suggestions.title && (
                      <TextField
                        label={t("seo.suggestions.seoTitle.label")}
                        value={getValue("title")}
                        onChange={(v) => updateSuggestion("title", v)}
                        helpText={t("seo.suggestions.seoTitle.helpText", { count: getValue("title").length })}
                        autoComplete="off"
                      />
                    )}

                    {actionData.suggestions.metaDescription && (
                      <TextField
                        label={t("seo.suggestions.metaDescription.label")}
                        value={getValue("metaDescription")}
                        onChange={(v) => updateSuggestion("metaDescription", v)}
                        multiline={3}
                        helpText={t("seo.suggestions.metaDescription.helpText", { count: getValue("metaDescription").length })}
                        autoComplete="off"
                      />
                    )}

                    {actionData.suggestions.handle && (
                      <TextField
                        label={t("seo.suggestions.handle.label")}
                        value={getValue("handle")}
                        onChange={(v) => updateSuggestion("handle", v)}
                        prefix="/products/"
                        autoComplete="off"
                      />
                    )}

                    {actionData.suggestions.altText && (
                      <TextField
                        label={t("seo.suggestions.altText.label", { count: actionData.imagesWithoutAlt?.length || 0 })}
                        value={getValue("altText")}
                        onChange={(v) => updateSuggestion("altText", v)}
                        autoComplete="off"
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
