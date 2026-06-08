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
  Badge,
  Thumbnail,
  Divider,
  Box,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { fetchProductsForList } from "../services/product.server";
import { auditProduct } from "../services/seo-audit.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const { nodes, pageInfo } = await fetchProductsForList(admin, { first: 50 });

  const products = nodes.map((product) => {
    const audit = auditProduct(product);
    return {
      id: product.id.replace("gid://shopify/Product/", ""),
      title: product.title,
      image: product.featuredImage?.url || null,
      score: audit.score,
      issueCount: audit.issues.length,
    };
  });

  return json({ products, hasNextPage: pageInfo.hasNextPage });
};

function scoreTone(score) {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "critical";
}

export default function Products() {
  const { products, hasNextPage } = useLoaderData();
  const navigate = useNavigate();

  return (
    <Page title="Ürünler" subtitle="Tüm ürünleriniz, SEO puanları ve hızlı işlemler bir arada">
      <Layout>
        {products.length === 0 ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text as="h2" variant="headingMd">
                  Henüz ürün yok
                </Text>
                <Text as="p" tone="subdued">
                  Mağazanıza ürün ekleyince burada listelenecek.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : (
          <Layout.Section>
            <Card padding="0">
              <BlockStack>
                {products.map((product, index) => (
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
                                {`SEO Puanı: ${product.score}`}
                              </Badge>
                              {product.issueCount > 0 && (
                                <Text as="span" tone="subdued" variant="bodySm">
                                  {product.issueCount} iyileştirme önerisi
                                </Text>
                              )}
                            </InlineStack>
                          </BlockStack>
                        </InlineStack>

                        <InlineStack gap="200" wrap={false}>
                          <Button onClick={() => navigate(`/app/seo?productId=${product.id}`)}>
                            SEO
                          </Button>
                          <Button onClick={() => navigate(`/app/competition?productId=${product.id}`)}>
                            Rakip Analizi
                          </Button>
                          <Button
                            variant="primary"
                            onClick={() => navigate(`/app/generate?productId=${product.id}`)}
                          >
                            Resim Üret
                          </Button>
                        </InlineStack>
                      </InlineStack>
                    </Box>
                    {index < products.length - 1 && <Divider />}
                  </div>
                ))}
              </BlockStack>
            </Card>

            {hasNextPage && (
              <Box paddingBlockStart="400">
                <Text as="p" tone="subdued" variant="bodySm" alignment="center">
                  İlk 50 ürün gösteriliyor.
                </Text>
              </Box>
            )}
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
