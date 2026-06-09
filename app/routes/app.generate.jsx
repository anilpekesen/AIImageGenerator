import { useState, useCallback, useEffect } from "react";
import { useLoaderData, useSubmit, useNavigation, useActionData, useFetcher } from "@remix-run/react";
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
  Divider,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";
import i18next from "../i18next.server";
import {
  CREDIT_COSTS,
  consumeCredits,
  getOrCreateSubscription,
  refundCredits,
} from "../models/subscription.server";
import { startGeneration, refineScene } from "../services/replicate.server";
import { createGeneration, updateGeneration } from "../models/generation.server";
import GenerationGrid from "../components/GenerationGrid";
import ImageUploader from "../components/ImageUploader";
import { fetchProductBasicInfo } from "../services/product.server";

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

    const creditsReserved = await consumeCredits(shop, CREDIT_COSTS.PHOTO_SET);
    if (!creditsReserved) {
      return json({ error: t("generate.errors.monthlyLimitReached") }, { status: 400 });
    }

    const generation = await createGeneration({ shop, productId, productTitle, inputImage: imageUrl });

    // Fire and forget — respond immediately, generate in background
    (async () => {
      try {
        const outputs = await startGeneration({ imageUrl, productTitle, locale });
        await updateGeneration(generation.id, { outputs: JSON.stringify(outputs), status: "done" });
        const successCount = outputs.filter((o) => o.url).length;
        await refundCredits(shop, CREDIT_COSTS.PHOTO_SET - successCount);
      } catch (error) {
        await refundCredits(shop, CREDIT_COSTS.PHOTO_SET);
        await updateGeneration(generation.id, { status: "failed" });
        console.error("[generate] background generation failed:", error.message);
      }
    })();

    return json({ pending: true, generationId: generation.id });
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

  if (intent === "refine-scene") {
    const imageUrl = formData.get("imageUrl");
    const refinementPrompt = formData.get("refinementPrompt");
    const outputIndex = parseInt(formData.get("outputIndex"), 10);
    const scene = formData.get("scene") || "";
    const label = formData.get("label") || "";

    const creditsReserved = await consumeCredits(shop, CREDIT_COSTS.REFINE);
    if (!creditsReserved) {
      return json({ error: t("generate.errors.monthlyLimitReached") }, { status: 400 });
    }

    try {
      const newUrl = await refineScene({ imageUrl, refinementPrompt });
      return json({ refined: true, outputIndex, newOutput: { url: newUrl, scene, label } });
    } catch (error) {
      await refundCredits(shop, CREDIT_COSTS.REFINE);
      return json({ error: t("generate.errors.generationFailed", { message: error.message }) }, { status: 500 });
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
  const [currentOutputs, setCurrentOutputs] = useState([]);
  const [refineIndex, setRefineIndex] = useState(null);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [pendingGenerationId, setPendingGenerationId] = useState(null);

  const statusFetcher = useFetcher();

  const isGenerating = (navigation.state === "submitting" && navigation.formData?.get("intent") === "generate") || !!pendingGenerationId;
  const isRefining = navigation.state === "submitting" && navigation.formData?.get("intent") === "refine-scene";
  const remaining = subscription.limitCount - subscription.usedCount;
  const canGenerate = remaining >= 6;
  const canRefine = remaining >= 1;

  // Start polling when action returns pending
  useEffect(() => {
    if (actionData?.pending && actionData.generationId) {
      setPendingGenerationId(actionData.generationId);
    }
    if (actionData?.refined) {
      setCurrentOutputs((prev) => {
        const next = [...prev];
        next[actionData.outputIndex] = actionData.newOutput;
        return next;
      });
      setRefineIndex(null);
      setRefinePrompt("");
    }
  }, [actionData]);

  // Poll every 4 seconds while pending
  useEffect(() => {
    if (!pendingGenerationId) return;
    const interval = setInterval(() => {
      statusFetcher.load(`/app/api/generation-status?id=${pendingGenerationId}`);
    }, 4000);
    return () => clearInterval(interval);
  }, [pendingGenerationId]);

  // Handle poll result
  useEffect(() => {
    if (statusFetcher.data?.status === "done") {
      setCurrentOutputs(statusFetcher.data.outputs);
      setPendingGenerationId(null);
      setRefineIndex(null);
      setRefinePrompt("");
    } else if (statusFetcher.data?.status === "failed") {
      setPendingGenerationId(null);
    }
  }, [statusFetcher.data]);
  const locale = i18n.resolvedLanguage ?? "tr";

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

    submit(formData, { method: "post" });
  }, [uploadedImageUrl, selectedProduct, submit]);

  const handleSaveToProduct = useCallback(() => {
    if (!selectedOutputs.length || !selectedProduct) return;

    const formData = new FormData();
    formData.append("intent", "save-to-product");
    formData.append("productId", selectedProduct.id);
    formData.append("imageUrls", JSON.stringify(selectedOutputs));

    submit(formData, { method: "post" });
    shopify.toast.show(t("generate.toast.saved", { count: selectedOutputs.length }));
  }, [selectedOutputs, selectedProduct, submit, shopify, t]);

  const handleRefine = useCallback(() => {
    if (refineIndex === null || !refinePrompt.trim()) return;
    const output = currentOutputs[refineIndex];
    if (!output?.url) return;
    const fd = new FormData();
    fd.append("intent", "refine-scene");
    fd.append("imageUrl", output.url);
    fd.append("refinementPrompt", refinePrompt);
    fd.append("outputIndex", String(refineIndex));
    fd.append("scene", output.scene || "");
    fd.append("label", output.label || "");
    submit(fd, { method: "post" });
  }, [refineIndex, refinePrompt, currentOutputs, submit]);

  return (
    <Page
      title={t("generate.pageTitle")}
      subtitle={t("generate.pageSubtitle")}
      backAction={{ url: "/app" }}
    >
      <Layout>
        {!canGenerate && (
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

        {statusFetcher.data?.status === "failed" && (
          <Layout.Section>
            <Banner title={t("generate.errorBanner.title")} tone="critical">
              <p>{t("generate.errors.generationFailed", { message: "Background generation failed" })}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Banner tone="info">
            <BlockStack gap="100">
              <Text as="p" fontWeight="semibold" variant="bodySm">
                {locale === "tr" ? "Yapay Zeka Otomatik Analiz" : "AI Automatic Analysis"}
              </Text>
              <Text as="p" variant="bodySm">
                {locale === "tr"
                  ? "Ürün görseli yüklendiğinde AI ürünü analiz eder, kategorisine ve özelliklerine göre 6 özgün editöryal sahne konsepti oluşturur. Herhangi bir kategori seçmenize gerek yok."
                  : "When a product image is uploaded, AI analyzes it and automatically creates 6 unique editorial scene concepts based on its category and characteristics. No category selection needed."}
              </Text>
            </BlockStack>
          </Banner>
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
                disabled={!uploadedImageUrl || !selectedProduct || !canGenerate}
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

        {currentOutputs.length > 0 && (
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
                  outputs={currentOutputs}
                  selected={selectedOutputs}
                  onSelectionChange={setSelectedOutputs}
                  refiningIndex={refineIndex}
                  onRefineRequest={(index) => {
                    setRefineIndex(index);
                    setRefinePrompt("");
                  }}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {currentOutputs.length > 0 && refineIndex !== null && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="300" blockAlign="center">
                  {currentOutputs[refineIndex]?.url && (
                    <img
                      src={currentOutputs[refineIndex].url}
                      alt=""
                      style={{ width: "56px", height: "56px", objectFit: "cover", borderRadius: "8px", flexShrink: 0 }}
                    />
                  )}
                  <BlockStack gap="50">
                    <Text as="p" fontWeight="semibold" variant="bodySm">
                      {t("generate.refine.heading")}
                      {currentOutputs[refineIndex]?.label ? ` — ${currentOutputs[refineIndex].label}` : ""}
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      {t("generate.refine.description")}
                    </Text>
                  </BlockStack>
                </InlineStack>

                <TextField
                  value={refinePrompt}
                  onChange={setRefinePrompt}
                  placeholder={t("generate.refine.placeholder")}
                  multiline={2}
                  autoComplete="off"
                  label=""
                  labelHidden
                />

                <InlineStack gap="200" blockAlign="center">
                  <Button
                    variant="primary"
                    onClick={handleRefine}
                    loading={isRefining}
                    disabled={!refinePrompt.trim() || !canRefine}
                  >
                    {isRefining ? t("generate.refine.loading") : t("generate.refine.cta")}
                  </Button>
                  <Button
                    variant="plain"
                    onClick={() => { setRefineIndex(null); setRefinePrompt(""); }}
                    disabled={isRefining}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Text as="span" tone="subdued" variant="bodySm">
                    {t("generate.step3.remaining", { count: remaining })}
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
