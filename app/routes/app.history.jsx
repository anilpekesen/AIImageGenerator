import { useState } from "react";
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
  EmptyState,
  Box,
  Modal,
} from "@shopify/polaris";
import { useTranslation } from "react-i18next";
import { authenticate } from "../shopify.server";
import { getAllGenerations, maintainGenerations } from "../models/generation.server";
import ProductShootsModal from "../components/ProductShootsModal";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await maintainGenerations(session.shop);
  const generations = await getAllGenerations(session.shop);
  return json({ generations });
};

const statusTone = {
  done: "success",
  pending: "attention",
  processing: "info",
  failed: "critical",
};

const dateLocales = { tr: "tr-TR", en: "en-US" };

function HistoryThumbnail({ src, alt, onZoom, t }) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        style={{
          width: "60px",
          height: "60px",
          background: "#f4f6f8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "2px",
        }}
      >
        <span style={{ fontSize: "9px", lineHeight: "1.2", color: "#6d7175", wordBreak: "break-word" }}>
          {errored ? t("history.imageUnavailable") : t("generationGrid.notGenerated")}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onClick={onZoom}
      onError={() => setErrored(true)}
      style={{
        width: "60px",
        height: "60px",
        objectFit: "cover",
        display: "block",
        cursor: "pointer",
      }}
    />
  );
}

export default function History() {
  const { generations } = useLoaderData();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const dateLocale = dateLocales[i18n.language] || "en-US";
  const [previewImage, setPreviewImage] = useState(null);
  const [shootsProduct, setShootsProduct] = useState(null);

  if (generations.length === 0) {
    return (
      <Page title={t("history.pageTitle")} backAction={{ url: "/app" }}>
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading={t("history.empty.heading")}
                action={{ content: t("history.empty.action"), onAction: () => navigate("/app/generate") }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>{t("history.empty.body")}</p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title={t("history.pageTitle")} backAction={{ url: "/app" }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {generations.map((gen) => {
              const outputs = JSON.parse(gen.outputs || "[]");
              const tone = statusTone[gen.status] || statusTone.pending;
              const label = t(`history.status.${gen.status}`, { defaultValue: t("history.status.pending") });

              return (
                <Card key={gen.id}>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text as="p" fontWeight="semibold">
                          {gen.productTitle}
                        </Text>
                        <InlineStack gap="200" blockAlign="center">
                          {gen.photoSetLabel && (
                            <Badge tone="info">{gen.photoSetLabel}</Badge>
                          )}
                          <Text as="p" tone="subdued" variant="bodySm">
                            {new Date(gen.createdAt).toLocaleDateString(dateLocale, {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Text>
                        </InlineStack>
                      </BlockStack>
                      <Badge tone={tone}>{label}</Badge>
                    </InlineStack>

                    {outputs.length > 0 && (
                      <InlineStack gap="200" wrap>
                        {outputs.map((output, i) => (
                          <Box key={i} borderRadius="150" overflow="hidden">
                            <HistoryThumbnail
                              src={output.url}
                              alt={output.label || output.scene}
                              t={t}
                              onZoom={() =>
                                output.url &&
                                setPreviewImage({
                                  url: output.url,
                                  label: output.label || output.scene || gen.productTitle,
                                })
                              }
                            />
                          </Box>
                        ))}
                      </InlineStack>
                    )}

                    {gen.productId && outputs.some((output) => output.url) && (
                      <InlineStack align="end">
                        <Button onClick={() => setShootsProduct({ id: gen.productId, title: gen.productTitle })}>
                          {t("products.actions.viewShoots")}
                        </Button>
                      </InlineStack>
                    )}
                  </BlockStack>
                </Card>
              );
            })}
          </BlockStack>
        </Layout.Section>
      </Layout>

      {previewImage && (
        <Modal
          open
          onClose={() => setPreviewImage(null)}
          title={previewImage.label}
        >
          <Modal.Section>
            <img
              src={previewImage.url}
              alt={previewImage.label}
              style={{ width: "100%", borderRadius: "8px", display: "block" }}
            />
          </Modal.Section>
        </Modal>
      )}

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
