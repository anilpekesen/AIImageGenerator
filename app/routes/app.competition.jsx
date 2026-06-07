import { useState, useCallback } from "react";
import { useSubmit, useNavigation, useActionData } from "@remix-run/react";
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
  Link,
  Divider,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { searchCompetitors } from "../services/google-search.server";
import { summarizeCompetitors } from "../services/ai-text.server";
import { createCompetitorAnalysis } from "../models/competitor-analysis.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const productId = formData.get("productId");
  const productTitle = formData.get("productTitle");

  if (!productTitle) {
    return json({ error: "Ürün başlığı bulunamadı." }, { status: 400 });
  }

  const query = productTitle;

  try {
    const results = await searchCompetitors(query, { num: 10 });

    if (results.length === 0) {
      return json({ error: "Google'da bu ürün için sonuç bulunamadı." }, { status: 200 });
    }

    const aiSummary = await summarizeCompetitors(productTitle, results);

    await createCompetitorAnalysis({
      shop: session.shop,
      productId,
      productTitle,
      query,
      results,
      aiSummary,
    });

    return json({ success: true, results, aiSummary, productTitle });
  } catch (error) {
    return json({ error: "Analiz başarısız: " + error.message }, { status: 500 });
  }
};

export default function Competition() {
  const submit = useSubmit();
  const navigation = useNavigation();
  const actionData = useActionData();
  const shopify = useAppBridge();

  const [selectedProduct, setSelectedProduct] = useState(null);
  const isAnalyzing = navigation.state === "submitting";

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
    }
  }, [shopify, selectedProduct]);

  const handleAnalyze = useCallback(() => {
    if (!selectedProduct) return;

    const formData = new FormData();
    formData.append("productId", selectedProduct.id);
    formData.append("productTitle", selectedProduct.title);
    submit(formData, { method: "post" });
  }, [selectedProduct, submit]);

  return (
    <Page
      title="Google Rekabet Analizi"
      subtitle="Ürününüzü Google'da arayan rakipleri görün, AI ile farkınızı bulun"
      backAction={{ url: "/app" }}
    >
      <Layout>
        {actionData?.error && (
          <Layout.Section>
            <Banner title="Sonuç" tone="warning">
              <p>{actionData.error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">1. Ürün Seç</Text>

              {selectedProduct ? (
                <InlineStack gap="300" blockAlign="center">
                  {selectedProduct.image && (
                    <Thumbnail source={selectedProduct.image} alt={selectedProduct.title} size="medium" />
                  )}
                  <BlockStack gap="100">
                    <Text as="p" fontWeight="semibold">{selectedProduct.title}</Text>
                    <Badge tone="success">Seçildi</Badge>
                  </BlockStack>
                </InlineStack>
              ) : (
                <Text as="p" tone="subdued">Henüz ürün seçilmedi</Text>
              )}

              <InlineStack gap="200">
                <Button onClick={handleProductPick}>
                  {selectedProduct ? "Farklı Ürün Seç" : "Ürün Seç"}
                </Button>
                {selectedProduct && (
                  <Button
                    variant="primary"
                    onClick={handleAnalyze}
                    loading={isAnalyzing}
                  >
                    {isAnalyzing ? "Analiz Ediliyor..." : "Google'da Rakip Analizi Yap"}
                  </Button>
                )}
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {isAnalyzing && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300" inlineAlign="center">
                <Spinner size="large" />
                <Text as="p" tone="subdued">
                  Google'da "{selectedProduct?.title}" için rakipler aranıyor ve AI analiz ediyor...
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {actionData?.success && (
          <>
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Box background="bg-fill-info" padding="200" borderRadius="200">
                      <Text as="span">🤖</Text>
                    </Box>
                    <Text as="h2" variant="headingMd">AI Rekabet Özeti</Text>
                  </InlineStack>
                  <Text as="p" tone="subdued">
                    "{actionData.productTitle}" için Google sonuçlarına dayalı analiz:
                  </Text>
                  <Box
                    background="bg-fill-secondary"
                    padding="400"
                    borderRadius="200"
                  >
                    <Text as="p" style={{ whiteSpace: "pre-wrap" }}>
                      {actionData.aiSummary}
                    </Text>
                  </Box>
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Google'daki Rakipler ({actionData.results.length})
                  </Text>
                  <BlockStack gap="300">
                    {actionData.results.map((r, i) => (
                      <Box key={i}>
                        <BlockStack gap="100">
                          <Link url={r.link} external monochrome={false}>
                            <Text as="p" fontWeight="semibold">{r.title}</Text>
                          </Link>
                          <InlineStack gap="200">
                            <Badge tone="info">{r.displayLink}</Badge>
                          </InlineStack>
                          <Text as="p" tone="subdued" variant="bodySm">{r.snippet}</Text>
                        </BlockStack>
                        {i < actionData.results.length - 1 && <Box paddingBlockStart="300"><Divider /></Box>}
                      </Box>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}
