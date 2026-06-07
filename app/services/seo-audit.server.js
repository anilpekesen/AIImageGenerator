const PRODUCT_QUERY = `
  query getProductSeo($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      descriptionHtml
      seo { title description }
      media(first: 20) {
        nodes {
          ... on MediaImage {
            id
            alt
            image { url }
          }
        }
      }
    }
  }
`;

export async function fetchProductSeoData(admin, productId) {
  const response = await admin.graphql(PRODUCT_QUERY, {
    variables: { id: `gid://shopify/Product/${productId}` },
  });
  const { data } = await response.json();
  return data.product;
}

function plainText(html) {
  return (html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function auditProduct(product) {
  const issues = [];
  let score = 100;

  const seoTitle = product.seo?.title || product.title;
  const seoDescription = product.seo?.description || plainText(product.descriptionHtml);
  const handle = product.handle;
  const mediaImages = (product.media?.nodes || []).filter((n) => n.image);
  const imagesWithAlt = mediaImages.filter((n) => n.alt && n.alt.trim().length > 0);

  // SEO başlığı
  if (!product.seo?.title) {
    issues.push({
      field: "title",
      label: "SEO başlığı eksik",
      detail: "Ürün için özel bir SEO başlığı tanımlanmamış, varsayılan ürün adı kullanılıyor.",
      severity: "warning",
    });
    score -= 15;
  } else if (seoTitle.length > 60 || seoTitle.length < 30) {
    issues.push({
      field: "title",
      label: "SEO başlığı ideal uzunlukta değil",
      detail: `Mevcut uzunluk: ${seoTitle.length} karakter. İdeal aralık: 50-60 karakter.`,
      severity: "info",
    });
    score -= 8;
  }

  // Meta açıklama
  if (!product.seo?.description) {
    issues.push({
      field: "metaDescription",
      label: "Meta açıklama eksik",
      detail: "Arama sonuçlarında gösterilecek özel bir meta açıklama tanımlanmamış.",
      severity: "warning",
    });
    score -= 20;
  } else if (seoDescription.length > 160 || seoDescription.length < 120) {
    issues.push({
      field: "metaDescription",
      label: "Meta açıklama ideal uzunlukta değil",
      detail: `Mevcut uzunluk: ${seoDescription.length} karakter. İdeal aralık: 150-160 karakter.`,
      severity: "info",
    });
    score -= 8;
  }

  // URL handle
  if (handle && (handle.length > 50 || /[0-9]{4,}/.test(handle))) {
    issues.push({
      field: "handle",
      label: "URL handle iyileştirilebilir",
      detail: `Mevcut handle: "${handle}". Kısa, anahtar kelime odaklı bir handle daha iyi sonuç verir.`,
      severity: "info",
    });
    score -= 7;
  }

  // Görsel alt-text kapsamı
  if (mediaImages.length > 0) {
    const coverage = Math.round((imagesWithAlt.length / mediaImages.length) * 100);
    if (coverage < 100) {
      issues.push({
        field: "altText",
        label: "Görsellerde alt-text eksik",
        detail: `${mediaImages.length} görselin ${imagesWithAlt.length} tanesinde alt-text var (%${coverage} kapsama).`,
        severity: coverage === 0 ? "warning" : "info",
      });
      score -= coverage === 0 ? 20 : 10;
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    issues,
    currentSeo: {
      title: seoTitle,
      description: seoDescription,
      handle,
    },
    imagesWithoutAlt: mediaImages.filter((n) => !n.alt || n.alt.trim().length === 0),
    productDescription: plainText(product.descriptionHtml),
  };
}
