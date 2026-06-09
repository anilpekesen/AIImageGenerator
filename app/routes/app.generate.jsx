import { useState, useCallback } from "react";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
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
  Box,
  Thumbnail,
  Badge,
  Select,
  Divider,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";
import i18next from "../i18next.server";
import { getOrCreateSubscription } from "../models/subscription.server";
import { startGeneration } from "../services/replicate.server";
import { createGeneration, updateGeneration } from "../models/generation.server";
import { decrementUsage } from "../models/subscription.server";
import GenerationGrid from "../components/GenerationGrid";
import ImageUploader from "../components/ImageUploader";
import { fetchProductBasicInfo } from "../services/product.server";
import { PHOTO_SETS } from "../services/photo-sets.js";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const subscription = await getOrCreateSubscription(session.shop);

  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");

  const preselectedProduct = productId
    ? await fetchProductBasicInfo(admin, productId)
    : null;

  return json({ subscription, preselectedProduct });
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;
  const locale = await i18next.getLocale(request);
  const t = await i18next.getFixedT(locale);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "generate") {
    const imageUrl = formData.get("imageUrl");
    const productId = formData.get("productId");
    const productTitle = formData.get("productTitle");
    const photoSetId = formData.get("photoSetId") || "general";

    const subscription = await getOrCreateSubscription(shop);
    if (subscription.usedCount >= subscription.limitCount) {
      return json({ error: t("generate.errors.monthlyLimitReached") }, { status: 400 });
    }

    const generation = await createGeneration({
      shop,
      productId,
      productTitle,
      inputImage: imageUrl,
    });

    try {
      const outputs = await startGeneration({ imageUrl, productTitle, photoSetId, locale });

      await updateGeneration(generation.id, {
        outputs: JSON.stringify(outputs),
        status: "done",
      });

      await decrementUsage(shop);

      return json({ success: true, generationId: generation.id, outputs });
    } catch (error) {
      await updateGeneration(generation.id, { status: "failed" });
      return json({ error: t("generate.errors.generationFailed", { message: error.message }) }, { status: 500 });
    }
  }

  if (intent === "save-to-product") {
    const productId = formData.get("productId");
    const imageUrls = JSON.parse(formData.get("imageUrls") || "[]");

    try {
      for (const url of imageUrls) {
        await admin.graphql(`
          mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
            productCreateMedia(productId: $productId, media: $media) {
              media {
                ... on MediaImage {
                  id
                  image { url }
                }
              }
              mediaUserErrors { field message }
            }
          }
        `, {
          variables: {
            productId: `gid://shopify/Product/${productId}`,
            media: [{ alt: "AI Generated Photo", mediaContentType: "IMAGE", originalSource: url }],
          },
        });
      }
      return json({ saved: true });
    } catch (error) {
      return json({ error: t("generate.errors.saveFailed", { message: error.message }) }, { status: 500 });
    }
  }

  return json({ error: t("generate.errors.invalidAction") }, { status: 400 });
};

export default function Generate() {
  const { subscription, preselectedProduct } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const { t, i18n } = useTranslation();

  const [selectedProduct, setSelectedProduct] = useState(preselectedProduct);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [selectedOutputs, setSelectedOutputs] = useState([]);
  const [photoSetId, setPhotoSetId] = useState("general");

  const isGenerating = navigation.state === "submitting";
  const remaining = subscription.limitCount - subscription.usedCount;
  const locale = i18n.resolvedLanguage ?? "tr";

  const photoSetOptions = PHOTO_SETS.map((ps) => ({
    label: locale === "tr" ? ps.labelTR : ps.labelEN,
    value: ps.id,
  }));

  const selectedPhotoSet = PHOTO_SETS.find((ps) => ps.id === photoSetId) ?? PHOTO_SETS[0];
  const setDescription = locale === "tr" ? selectedPhotoSet.descriptionTR : selectedPhotoSet.descriptionEN;

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
      if (product.images[0]?.originalSrc) {
        setUploadedImageUrl(product.images[0].originalSrc);
      }
    }
  }, [shopify, selectedProduct]);

  const handleGenerate = useCallback(() => {
    if (!uploadedImageUrl || !selectedProduct) return;

    const formData = new FormData();
    formData.append("intent", "generate");
    formData.append("imageUrl", uploadedImageUrl);
    formData.append("productId", selectedProduct.id);
    formData.append("productTitle", selectedProduct.title);
    formData.append("photoSetId", photoSetId);

    submit(formData, { method: "post" });
  }, [uploadedImageUrl, selectedProduct, photoSetId, submit]);

  const handleSaveToProduct = useCallback(() => {
    if (!selectedOutputs.length || !selectedProduct) return;

    const formData = new FormData();
    formData.append("intent", "save-to-product");
    formData.append("productId", selectedProduct.id);
    formData.append("imageUrls", JSON.stringify(selectedOutputs));

    submit(formData, { method: "post" });
    shopify.toast.show(t("generate.toast.saved", { count: selectedOutputs.length }));
  }, [selectedOutputs, selectedProduct, submit, shopify, t]);

  return (
    <Page
      title={t("generate.pageTitle")}
      subtitle={t("generate.pageSubtitle")}
      backAction={{ url: "/app" }}
    >
      <Layout>
        {remaining <= 0 && (
          <Layout.Section>
            <Banner
              title={t("generate.limitBanner.title")}
              tone="warning"
              action={{ content: t("generate.limitBanner.action"), url: "/app/billing" }}
            >
              <p>{t("generate.limitBanner.body")}</p>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.error && (
          <Layout.Section>
            <Banner title={t("generate.errorBanner.title")} tone="critical">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.saved && (
          <Layout.Section>
            <Banner title={t("generate.savedBanner.title")} tone="success">
              <p>{t("generate.savedBanner.body")}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <BlockStack gap="100">
                <Text as="h2" variant="headingMd">{t("generate.photoSet.heading")}</Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  {t("generate.photoSet.description")}
                </Text>
              </BlockStack>

              <Select
                options={photoSetOptions}
                value={photoSetId}
                onChange={setPhotoSetId}
                label={t("generate.photoSet.label")}
                labelInline
              />

              <Box background="bg-fill-secondary" padding="300" borderRadius="200">
                <BlockStack gap="200">
                  <Text as="p" fontWeight="semibold" variant="bodySm">
                    {locale === "tr" ? selectedPhotoSet.labelTR : selectedPhotoSet.labelEN}
                  </Text>
                  <Text as="p" tone="subdued" variant="bodySm">{setDescription}</Text>
                  <InlineStack gap="150" wrap>
                    {selectedPhotoSet.scenes.map((s) => (
                      <Badge key={s.scene} tone="info">
                        {locale === "tr" ? s.labelTR : s.labelEN}
                      </Badge>
                    ))}
                  </InlineStack>
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">{t("generate.step1.heading")}</Text>

              {selectedProduct ? (
                <InlineStack gap="300" blockAlign="center">
                  {selectedProduct.image && (
                    <Thumbnail
                      source={selectedProduct.image}
                      alt={selectedProduct.title}
                      size="medium"
                    />
                  )}
                  <BlockStack gap="100">
                    <Text as="p" fontWeight="semibold">{selectedProduct.title}</Text>
                    <Badge tone="success">{t("generate.step1.selected")}</Badge>
                  </BlockStack>
                </InlineStack>
              ) : (
                <Text as="p" tone="subdued">
                  {t("common.noProductSelected")}
                </Text>
              )}

              <Button onClick={handleProductPick}>
                {selectedProduct ? t("common.changeProduct") : t("common.selectProduct")}
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">{t("generate.step2.heading")}</Text>

              <ImageUploader
                currentImage={uploadedImageUrl}
                onImageSelect={setUploadedImageUrl}
              />

              {selectedProduct?.image && !uploadedImageUrl && (
                <Button
                  variant="plain"
                  onClick={() => setUploadedImageUrl(selectedProduct.image)}
                >
                  {t("generate.step2.useExistingImage")}
                </Button>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingMd">{t("generate.step3.heading")}</Text>
                  <Text as="p" tone="subdued">
                    {t("generate.step3.description")}
                  </Text>
                </BlockStack>
                <Text as="p" tone="subdued" variant="bodySm">
                  {t("generate.step3.remaining", { count: remaining })}
                </Text>
              </InlineStack>

              <Button
                variant="primary"
                size="large"
                onClick={handleGenerate}
                loading={isGenerating}
                disabled={!uploadedImageUrl || !selectedProduct || remaining <= 0}
              >
                {isGenerating ? t("generate.step3.ctaLoading") : t("generate.step3.cta")}
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {isGenerating && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400" inlineAlign="center">
                <Spinner size="large" />
                <BlockStack gap="100" inlineAlign="center">
                  <Text as="p" fontWeight="semibold">
                    {t("generate.generating.title")}
                  </Text>
                  <Text as="p" tone="subdued">
                    {t("generate.generating.description")}
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {actionData?.outputs && actionData.outputs.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">{t("generate.outputs.heading")}</Text>
                    <Text as="p" tone="subdued">
                      {t("generate.outputs.subheading")}
                    </Text>
                  </BlockStack>
                  {selectedOutputs.length > 0 && (
                    <Button
                      variant="primary"
                      onClick={handleSaveToProduct}
                    >
                      {t("generate.outputs.saveButton", { count: selectedOutputs.length })}
                    </Button>
                  )}
                </InlineStack>

                <GenerationGrid
                  outputs={actionData.outputs}
                  selected={selectedOutputs}
                  onSelectionChange={setSelectedOutputs}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
