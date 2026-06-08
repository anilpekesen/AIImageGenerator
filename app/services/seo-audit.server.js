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

export function auditProduct(product, t) {
  const issues = [];
  let score = 100;

  const seoTitle = product.seo?.title || product.title;
  const seoDescription = product.seo?.description || plainText(product.descriptionHtml);
  const handle = product.handle;
  const mediaImages = (product.media?.nodes || []).filter((n) => n.image);
  const imagesWithAlt = mediaImages.filter((n) => n.alt && n.alt.trim().length > 0);

  // SEO title
  if (!product.seo?.title) {
    issues.push({
      field: "title",
      label: t("seoAudit.issues.titleMissing.label"),
      detail: t("seoAudit.issues.titleMissing.detail"),
      severity: "warning",
    });
    score -= 15;
  } else if (seoTitle.length > 60 || seoTitle.length < 30) {
    issues.push({
      field: "title",
      label: t("seoAudit.issues.titleLength.label"),
      detail: t("seoAudit.issues.titleLength.detail", { length: seoTitle.length }),
      severity: "info",
    });
    score -= 8;
  }

  // Meta description
  if (!product.seo?.description) {
    issues.push({
      field: "metaDescription",
      label: t("seoAudit.issues.descriptionMissing.label"),
      detail: t("seoAudit.issues.descriptionMissing.detail"),
      severity: "warning",
    });
    score -= 20;
  } else if (seoDescription.length > 160 || seoDescription.length < 120) {
    issues.push({
      field: "metaDescription",
      label: t("seoAudit.issues.descriptionLength.label"),
      detail: t("seoAudit.issues.descriptionLength.detail", { length: seoDescription.length }),
      severity: "info",
    });
    score -= 8;
  }

  // URL handle
  if (handle && (handle.length > 50 || /[0-9]{4,}/.test(handle))) {
    issues.push({
      field: "handle",
      label: t("seoAudit.issues.handle.label"),
      detail: t("seoAudit.issues.handle.detail", { handle }),
      severity: "info",
    });
    score -= 7;
  }

  // Image alt-text coverage
  if (mediaImages.length > 0) {
    const coverage = Math.round((imagesWithAlt.length / mediaImages.length) * 100);
    if (coverage < 100) {
      issues.push({
        field: "altText",
        label: t("seoAudit.issues.altText.label"),
        detail: t("seoAudit.issues.altText.detail", {
          total: mediaImages.length,
          withAlt: imagesWithAlt.length,
          coverage,
        }),
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
