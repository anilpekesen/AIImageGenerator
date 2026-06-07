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
  ProgressBar,
  Banner,
  Divider,
  Box,
  Icon,
} from "@shopify/polaris";
import { ImageIcon, ClockIcon, StarIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getOrCreateSubscription } from "../models/subscription.server";
import { getRecentGenerations } from "../models/generation.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  const [subscription, recentGenerations] = await Promise.all([
    getOrCreateSubscription(shop),
    getRecentGenerations(shop, 3),
  ]);

  return json({ subscription, recentGenerations, shop });
};

export default function Index() {
  const { subscription, recentGenerations } = useLoaderData();
  const navigate = useNavigate();

  const usagePercent = Math.round(
    (subscription.usedCount / subscription.limitCount) * 100
  );
  const remaining = subscription.limitCount - subscription.usedCount;

  return (
    <Page title="Snap6 — Stüdyo Çekimine Son">
      <Layout>
        <Layout.Section>
          <Banner
            title="Stüdyo çekimi maliyetine son verin 📸"
            tone="info"
            action={{ content: "Şimdi 6 Sahne Üret", onAction: () => navigate("/app/generate") }}
          >
            <p>
              Bir fotoğraf yükleyin, <strong>tek tıkla</strong> 6 profesyonel sahne
              elinizde olsun: stüdyo beyazı, lifestyle, dış mekan, lüks mermer,
              dramatik koyu ve flat lay. Prompt yazmaya, fotoğrafçı beklemeye gerek yok.
            </p>
          </Banner>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  Plan Durumu
                </Text>
                <Badge tone={subscription.plan === "free" ? "attention" : "success"}>
                  {subscription.plan === "free"
                    ? "Ücretsiz"
                    : subscription.plan === "basic"
                    ? "Basic"
                    : "Pro"}
                </Badge>
              </InlineStack>

              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="p" tone="subdued">
                    Bu ay kullanılan
                  </Text>
                  <Text as="p" fontWeight="semibold">
                    {subscription.usedCount} / {subscription.limitCount} üretim
                  </Text>
                </InlineStack>
                <ProgressBar
                  progress={usagePercent}
                  tone={usagePercent >= 90 ? "critical" : usagePercent >= 70 ? "warning" : "success"}
                />
                <Text as="p" tone="subdued" variant="bodySm">
                  {remaining} üretim hakkı kaldı
                </Text>
              </BlockStack>

              {subscription.plan === "free" && (
                <>
                  <Divider />
                  <Button
                    variant="primary"
                    onClick={() => navigate("/app/billing")}
                  >
                    Planı Yükselt — $9.99/ay'dan
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
                  Neden Snap6?
                </Text>
                <Text as="p" tone="subdued" variant="bodySm">
                  Diğer AI görsel uygulamaları sizi prompt yazmaya ve tek tek
                  üretmeye zorlar. Snap6'da tek tıkla <strong>6 hazır sahne</strong> birden gelir.
                </Text>
              </BlockStack>

              <BlockStack gap="300">
                <InlineStack gap="300" blockAlign="center">
                  <Box
                    background="bg-fill-info"
                    padding="200"
                    borderRadius="200"
                  >
                    <Icon source={ImageIcon} tone="info" />
                  </Box>
                  <BlockStack gap="050">
                    <Text as="p" fontWeight="semibold">
                      1 Yükleme → 6 Sahne
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      Stüdyo beyazı, lifestyle, dış mekan, mermer/lüks, dramatik koyu, flat lay — hepsi otomatik
                    </Text>
                  </BlockStack>
                </InlineStack>

                <InlineStack gap="300" blockAlign="center">
                  <Box
                    background="bg-fill-success"
                    padding="200"
                    borderRadius="200"
                  >
                    <Icon source={StarIcon} tone="success" />
                  </Box>
                  <BlockStack gap="050">
                    <Text as="p" fontWeight="semibold">
                      Sıfır Prompt, Sıfır Tahmin
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      Sahneler fotoğrafçılık uzmanlarınca hazırlandı — siz sadece tıklayın
                    </Text>
                  </BlockStack>
                </InlineStack>

                <InlineStack gap="300" blockAlign="center">
                  <Box
                    background="bg-fill-warning"
                    padding="200"
                    borderRadius="200"
                  >
                    <Icon source={ClockIcon} tone="warning" />
                  </Box>
                  <BlockStack gap="050">
                    <Text as="p" fontWeight="semibold">
                      Tek Tıkla Ürün Sayfasına Kayıt
                    </Text>
                    <Text as="p" tone="subdued" variant="bodySm">
                      Beğendiğiniz sahneler doğrudan Shopify ürün galerinize eklenir
                    </Text>
                  </BlockStack>
                </InlineStack>
              </BlockStack>

              <Button
                variant="primary"
                size="large"
                onClick={() => navigate("/app/generate")}
                disabled={remaining <= 0}
              >
                {remaining <= 0 ? "Limit Doldu — Planı Yükselt" : "Stüdyo Çekimine Son Verin — Şimdi Üret"}
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
                    Son Üretimler
                  </Text>
                  <Button variant="plain" onClick={() => navigate("/app/history")}>
                    Tümünü Gör
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
      </Layout>
    </Page>
  );
}
