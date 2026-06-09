import { useState, useCallback } from "react";
import {
  reactExtension,
  useApi,
  AdminBlock,
  BlockStack,
  InlineStack,
  Button,
  Text,
  Image,
  Banner,
  ProgressIndicator,
  Box,
} from "@shopify/ui-extensions-react/admin";

const TARGET = "admin.product-details.block.render";

// Backend URL must match the app URL configured in shopify.app.toml.
const APP_URL = "https://app.rankavio.com";

export default reactExtension(TARGET, () => <Snap6Block />);

const PRODUCT_QUERY = `
  query ProductForSnap6($id: ID!) {
    product(id: $id) {
      title
      productType
      tags
      descriptionHtml
      featuredImage { url }
    }
  }
`;

function Snap6Block() {
  const { data, query, auth } = useApi(TARGET);

  const productGid = data?.selected?.[0]?.id;

  const [status, setStatus] = useState("idle"); // idle | generating | done | error | saving | saved
  const [outputs, setOutputs] = useState([]);
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState(null);

  const callBackend = useCallback(
    async (path, payload) => {
      const token = await auth.idToken();
      const response = await fetch(`${APP_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "İstek başarısız");
      return json;
    },
    [auth]
  );

  const handleGenerate = useCallback(async () => {
    setStatus("generating");
    setError(null);
    setOutputs([]);
    setSelected([]);

    try {
      if (!productGid) {
        throw new Error("Ürün bilgisi bulunamadı.");
      }

      const { data: productData, errors } = await query(PRODUCT_QUERY, {
        variables: { id: productGid },
      });
      if (errors?.length) throw new Error(errors[0].message);

      const product = productData?.product;
      const imageUrl = product?.featuredImage?.url;
      if (!imageUrl) {
        throw new Error("Bu ürünün bir görseli yok. Önce bir ürün görseli ekleyin.");
      }

      const result = await callBackend("/api/extension/generate", {
        productId: productGid.replace("gid://shopify/Product/", ""),
        productTitle: product?.title,
        productType: product?.productType,
        tags: product?.tags || [],
        descriptionHtml: product?.descriptionHtml || "",
        imageUrl,
      });

      setOutputs(result.outputs || []);
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }, [callBackend, query, productGid]);

  const toggleSelect = (url) => {
    setSelected((prev) => (prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]));
  };

  const handleSave = useCallback(async () => {
    setStatus("saving");
    setError(null);
    try {
      await callBackend("/api/extension/save", {
        productId: productGid?.replace("gid://shopify/Product/", ""),
        imageUrls: selected,
      });
      setStatus("saved");
    } catch (err) {
      setError(err.message);
      setStatus("done");
    }
  }, [callBackend, productGid, selected]);

  return (
    <AdminBlock title="Snap6 — Stüdyo Çekimine Son">
      <BlockStack gap="base">
        <Text fontWeight="bold">1 fotoğraftan 6 profesyonel sahne — tek tık</Text>
        <Text>
          Stüdyo beyazı, lifestyle, dış mekan, mermer/lüks, dramatik koyu ve flat lay.
          Prompt yazmaya gerek yok.
        </Text>

        {status === "idle" && (
          <Button onPress={handleGenerate}>Tek Tıkla 6 Sahne Üret</Button>
        )}

        {status === "generating" && (
          <InlineStack gap="base" blockAlignment="center">
            <ProgressIndicator size="small-200" />
            <Text>6 sahne hazırlanıyor (~30-60 saniye)...</Text>
          </InlineStack>
        )}

        {error && (
          <Banner tone="critical" title="Bir sorun oluştu">
            <Text>{error}</Text>
          </Banner>
        )}

        {(status === "done" || status === "saving" || status === "saved") && outputs.length > 0 && (
          <BlockStack gap="base">
            <Text fontWeight="bold">Sonuçlar — kaydetmek istediklerinizi seçin</Text>
            <InlineStack gap="base">
              {outputs.map((o, i) => (
                <Box key={i} padding="base" inlineSize={140}>
                  {o.url ? (
                    <BlockStack gap="small">
                      <Image source={o.url} alt={o.label} />
                      <Button
                        variant={selected.includes(o.url) ? "primary" : "secondary"}
                        onPress={() => toggleSelect(o.url)}
                      >
                        {selected.includes(o.url) ? "✓ Seçildi" : "Seç"}
                      </Button>
                      <Text>{o.label}</Text>
                    </BlockStack>
                  ) : (
                    <Text>Üretilemedi</Text>
                  )}
                </Box>
              ))}
            </InlineStack>

            {selected.length > 0 && status !== "saved" && (
              <Button onPress={handleSave} disabled={status === "saving"}>
                {status === "saving"
                  ? "Kaydediliyor..."
                  : `${selected.length} Görseli Ürüne Kaydet`}
              </Button>
            )}

            {status === "saved" && (
              <Banner tone="success" title="Kaydedildi">
                <Text>Seçili görseller ürün galerisine eklendi.</Text>
              </Banner>
            )}

            <Button onPress={handleGenerate} variant="tertiary">
              Yeniden Üret
            </Button>
          </BlockStack>
        )}
      </BlockStack>
    </AdminBlock>
  );
}
