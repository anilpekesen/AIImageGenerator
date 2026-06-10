import { useState, useEffect, useCallback } from "react";
import { useFetcher } from "@remix-run/react";
import { Modal, BlockStack, InlineStack, Box, Text, Spinner, Button } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";

export default function ProductShootsModal({ productId, productTitle, onClose }) {
  const { t } = useTranslation();
  const shopify = useAppBridge();
  const imagesFetcher = useFetcher();
  const saveFetcher = useFetcher();

  const [selected, setSelected] = useState([]);
  const [zoomImage, setZoomImage] = useState(null);

  useEffect(() => {
    imagesFetcher.load(`/app/api/product-generations?productId=${productId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    if (saveFetcher.data?.saved) {
      shopify.toast.show(t("generate.toast.saved", { count: selected.length }));
      setSelected([]);
    } else if (saveFetcher.data?.error) {
      shopify.toast.show(saveFetcher.data.error, { isError: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveFetcher.data]);

  const images = imagesFetcher.data?.images || [];
  const isLoading = !imagesFetcher.data;

  const toggleSelect = useCallback((url) => {
    setSelected((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  }, []);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", "save-to-product");
    formData.append("productId", productId);
    formData.append("imageUrls", JSON.stringify(selected));
    saveFetcher.submit(formData, { method: "post" });
  }, [selected, productId, saveFetcher]);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={productTitle}
        size="large"
        primaryAction={{
          content: t("generate.outputs.saveButton", { count: selected.length }),
          onAction: handleSave,
          disabled: selected.length === 0,
          loading: saveFetcher.state === "submitting",
        }}
        secondaryActions={[{ content: t("common.close"), onAction: onClose }]}
      >
        <Modal.Section>
          {isLoading ? (
            <Box padding="800">
              <BlockStack gap="200" inlineAlign="center">
                <Spinner size="large" />
                <Text as="p" tone="subdued">{t("productShoots.loading")}</Text>
              </BlockStack>
            </Box>
          ) : images.length === 0 ? (
            <Box padding="800">
              <Text as="p" tone="subdued" alignment="center">{t("productShoots.empty")}</Text>
            </Box>
          ) : (
            <BlockStack gap="300">
              <InlineStack gap="200">
                <Button variant="plain" onClick={() => setSelected(images.map((image) => image.url))}>
                  {t("generationGrid.selectAll")}
                </Button>
                {selected.length > 0 && (
                  <Button variant="plain" tone="critical" onClick={() => setSelected([])}>
                    {t("generationGrid.clearSelection")}
                  </Button>
                )}
                {selected.length > 0 && (
                  <Text as="span" tone="subdued" variant="bodySm">
                    {t("generationGrid.selectedCount", { count: selected.length })}
                  </Text>
                )}
              </InlineStack>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                {images.map((image, index) => {
                  const isSelected = selected.includes(image.url);
                  const label =
                    image.label ||
                    (image.scene && t(`generationGrid.scenes.${image.scene}`, { defaultValue: "" })) ||
                    image.photoSetLabel ||
                    "";

                  return (
                    <div
                      key={`${image.url}-${index}`}
                      onClick={() => toggleSelect(image.url)}
                      style={{
                        cursor: "pointer",
                        borderRadius: "12px",
                        overflow: "hidden",
                        border: isSelected ? "3px solid #008060" : "3px solid transparent",
                        position: "relative",
                        transition: "border-color 0.2s",
                        boxShadow: isSelected ? "0 0 0 2px rgba(0,128,96,0.2)" : "0 1px 4px rgba(0,0,0,0.1)",
                      }}
                    >
                      <img
                        src={image.url}
                        alt={label}
                        loading="lazy"
                        decoding="async"
                        style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                      />

                      {label && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
                            padding: "20px 8px 8px",
                          }}
                        >
                          <Text as="p" variant="bodySm" tone="text-inverse" fontWeight="semibold">
                            {label}
                          </Text>
                        </div>
                      )}

                      {isSelected && (
                        <div
                          style={{
                            position: "absolute",
                            top: "8px",
                            right: "8px",
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: "#008060",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "14px",
                            fontWeight: "bold",
                          }}
                        >
                          ✓
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomImage({ url: image.url, label });
                        }}
                        aria-label={t("productShoots.zoom")}
                        style={{
                          position: "absolute",
                          top: "8px",
                          left: "8px",
                          background: "rgba(0,0,0,0.6)",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "13px",
                          cursor: "pointer",
                          backdropFilter: "blur(4px)",
                          lineHeight: "1.4",
                        }}
                      >
                        🔍
                      </button>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>

      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
            padding: "40px",
          }}
        >
          <img
            src={zoomImage.url}
            alt={zoomImage.label}
            style={{ maxWidth: "100%", maxHeight: "85%", objectFit: "contain", borderRadius: "8px" }}
          />
          {zoomImage.label && (
            <Text as="p" tone="text-inverse" variant="bodyMd">
              {zoomImage.label}
            </Text>
          )}
        </div>
      )}
    </>
  );
}
