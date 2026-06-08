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
  Divider,
  Box,
  Thumbnail,
  Badge,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getOrCreateSubscription } from "../models/subscription.server";
import { startGeneration } from "../services/replicate.server";
import { createGeneration, updateGeneration } from "../models/generation.server";
import { decrementUsage } from "../models/subscription.server";
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

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "generate") {
    const imageUrl = formData.get("imageUrl");
    const productId = formData.get("productId");
    const productTitle = formData.get("productTitle");

    const subscription = await getOrCreateSubscription(shop);
    if (subscription.usedCount >= subscription.limitCount) {
      return json({ error: "Aylık limit doldu. Lütfen planınızı yükseltin." }, { status: 400 });
    }

    const generation = await createGeneration({
      shop,
      productId,
      productTitle,
      inputImage: imageUrl,
    });

    try {
      const outputs = await startGeneration({ imageUrl, productTitle });

      await updateGeneration(generation.id, {
        outputs: JSON.stringify(outputs),
        status: "done",
      });

      await decrementUsage(shop);

      return json({ success: true, generationId: generation.id, outputs });
    } catch (error) {
      await updateGeneration(generation.id, { status: "failed" });
      return json({ error: "Görsel üretimi başarısız: " + error.message }, { status: 500 });
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
      return json({ error: "Kaydetme hatası: " + error.message }, { status: 500 });
    }
  }

  return json({ error: "Geçersiz işlem" }, { status: 400 });
};

export default function Generate() {
  const { subscription, preselectedProduct } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();

  const [selectedProduct, setSelectedProduct] = useState(preselectedProduct);
  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [selectedOutputs, setSelectedOutputs] = useState([]);

  const isGenerating = navigation.state === "submitting";
  const remaining = subscription.limitCount - subscription.usedCount;

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
    shopify.toast.show(`${selectedOutputs.length} görsel ürüne eklendi!`);
  }, [selectedOutputs, selectedProduct, submit, shopify]);

  return (
    <Page
      title="6 Sahne Üret — Tek Tık"
      subtitle="1 fotoğraf yükleyin, stüdyo çekimi yerine geçecek 6 profesyonel sahne alın"
      backAction={{ url: "/app" }}
    >
      <Layout>
        {remaining <= 0 && (
          <Layout.Section>
            <Banner
              title="Aylık limitiniz doldu"
              tone="warning"
              action={{ content: "Planı Yükselt", url: "/app/billing" }}
            >
              <p>Bu ay daha fazla görsel üretemezsiniz. Planınızı yükseltin.</p>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.error && (
          <Layout.Section>
            <Banner title="Hata" tone="critical">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        {actionData?.saved && (
          <Layout.Section>
            <Banner title="Kaydedildi!" tone="success">
              <p>Seçili görseller ürününüze eklendi.</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">1. Ürün Seç</Text>

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
                    <Badge tone="success">Seçildi</Badge>
                  </BlockStack>
                </InlineStack>
              ) : (
                <Text as="p" tone="subdued">
                  Henüz ürün seçilmedi
                </Text>
              )}

              <Button onClick={handleProductPick}>
                {selectedProduct ? "Farklı Ürün Seç" : "Ürün Seç"}
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">2. Görsel Yükle</Text>

              <ImageUploader
                currentImage={uploadedImageUrl}
                onImageSelect={setUploadedImageUrl}
              />

              {selectedProduct?.image && !uploadedImageUrl && (
                <Button
                  variant="plain"
                  onClick={() => setUploadedImageUrl(selectedProduct.image)}
                >
                  Mevcut ürün görselini kullan
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
                  <Text as="h2" variant="headingMd">3. Tek Tıkla 6 Sahne Üret</Text>
                  <Text as="p" tone="subdued">
                    Prompt yazmanıza gerek yok — stüdyo beyazı, lifestyle, dış mekan,
                    mermer/lüks, dramatik koyu ve flat lay otomatik gelir (~30-60 sn)
                  </Text>
                </BlockStack>
                <Text as="p" tone="subdued" variant="bodySm">
                  Kalan: {remaining} üretim
                </Text>
              </InlineStack>

              <Button
                variant="primary"
                size="large"
                onClick={handleGenerate}
                loading={isGenerating}
                disabled={!uploadedImageUrl || !selectedProduct || remaining <= 0}
              >
                {isGenerating ? "6 Sahne Hazırlanıyor..." : "Stüdyo Çekimi Yerine — 6 Sahne Üret"}
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
                    Stüdyonuz hazırlanıyor...
                  </Text>
                  <Text as="p" tone="subdued">
                    Arka plan siliniyor ve 6 profesyonel sahne tek seferde üretiliyor. ~30-60 saniye.
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
                    <Text as="h2" variant="headingMd">Üretilen Görseller</Text>
                    <Text as="p" tone="subdued">
                      Kaydetmek istediklerinizi seçin
                    </Text>
                  </BlockStack>
                  {selectedOutputs.length > 0 && (
                    <Button
                      variant="primary"
                      onClick={handleSaveToProduct}
                    >
                      {selectedOutputs.length} Görseli Ürüne Kaydet
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
