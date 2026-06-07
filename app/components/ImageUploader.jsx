import { useState, useRef } from "react";
import { BlockStack, Text, Box, Button, InlineStack } from "@shopify/polaris";

export default function ImageUploader({ currentImage, onImageSelect }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        onImageSelect(reader.result);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  return (
    <BlockStack gap="300">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? "#008060" : "#c9cccf"}`,
          borderRadius: "12px",
          padding: "24px",
          textAlign: "center",
          cursor: "pointer",
          background: isDragging ? "#f0fdf4" : "#fafbfb",
          transition: "all 0.2s",
          minHeight: "120px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        {isUploading ? (
          <Text as="p" tone="subdued">Yükleniyor...</Text>
        ) : currentImage ? (
          <>
            <img
              src={currentImage}
              alt="Seçilen görsel"
              style={{
                maxHeight: "160px",
                maxWidth: "100%",
                objectFit: "contain",
                borderRadius: "8px",
              }}
            />
            <Text as="p" variant="bodySm" tone="subdued">
              Değiştirmek için tıklayın
            </Text>
          </>
        ) : (
          <>
            <div style={{ fontSize: "32px" }}>🖼️</div>
            <Text as="p" fontWeight="semibold">
              Görsel sürükleyin veya tıklayın
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              PNG, JPG, WEBP — Max 10MB
            </Text>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleInputChange}
      />

      {currentImage && (
        <Button
          variant="plain"
          tone="critical"
          onClick={(e) => {
            e.stopPropagation();
            onImageSelect(null);
          }}
        >
          Görseli Kaldır
        </Button>
      )}
    </BlockStack>
  );
}
