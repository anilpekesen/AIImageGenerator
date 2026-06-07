import { useState } from "react";
import { Text, InlineStack, BlockStack, Box, Badge, Button } from "@shopify/polaris";

const SCENE_LABELS = {
  "studio": "Studio Beyaz",
  "lifestyle-indoor": "Lifestyle İç Mekan",
  "outdoor": "Dış Mekan",
  "marble-luxury": "Mermer / Lüks",
  "dark-moody": "Dramatik Koyu",
  "flat-lay": "Flat Lay",
};

export default function GenerationGrid({ outputs, selected, onSelectionChange }) {
  const toggleSelect = (url) => {
    if (selected.includes(url)) {
      onSelectionChange(selected.filter((u) => u !== url));
    } else {
      onSelectionChange([...selected, url]);
    }
  };

  const selectAll = () => {
    onSelectionChange(outputs.filter((o) => o.url).map((o) => o.url));
  };

  const clearAll = () => onSelectionChange([]);

  return (
    <BlockStack gap="300">
      <InlineStack gap="200">
        <Button variant="plain" onClick={selectAll}>Tümünü Seç</Button>
        {selected.length > 0 && (
          <Button variant="plain" tone="critical" onClick={clearAll}>Seçimi Temizle</Button>
        )}
        {selected.length > 0 && (
          <Text as="span" tone="subdued" variant="bodySm">
            {selected.length} görsel seçili
          </Text>
        )}
      </InlineStack>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "12px",
        }}
      >
        {outputs.map((output, index) => {
          const isSelected = output.url && selected.includes(output.url);
          const label = output.label || SCENE_LABELS[output.scene] || `Sahne ${index + 1}`;

          return (
            <div
              key={index}
              onClick={() => output.url && toggleSelect(output.url)}
              style={{
                cursor: output.url ? "pointer" : "default",
                borderRadius: "12px",
                overflow: "hidden",
                border: isSelected ? "3px solid #008060" : "3px solid transparent",
                position: "relative",
                transition: "border-color 0.2s",
                boxShadow: isSelected
                  ? "0 0 0 2px rgba(0,128,96,0.2)"
                  : "0 1px 4px rgba(0,0,0,0.1)",
              }}
            >
              {output.url ? (
                <img
                  src={output.url}
                  alt={label}
                  loading="lazy"
                  decoding="async"
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    background: "#f4f6f8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text as="p" tone="subdued" variant="bodySm">Üretilemedi</Text>
                </div>
              )}

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
            </div>
          );
        })}
      </div>
    </BlockStack>
  );
}
