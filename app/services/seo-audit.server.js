import * as cheerio from "cheerio";

const PRODUCT_QUERY = `
  query getProductSeo($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      descriptionHtml
      status
      onlineStoreUrl
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
  const descriptionText = plainText(product.descriptionHtml);
  const seoDescription = product.seo?.description || descriptionText;
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

  // Product images
  if (mediaImages.length === 0) {
    issues.push({
      field: "images",
      label: t("seoAudit.issues.noImages.label"),
      detail: t("seoAudit.issues.noImages.detail"),
      severity: "warning",
    });
    score -= 20;
  } else if (mediaImages.length < 3) {
    issues.push({
      field: "images",
      label: t("seoAudit.issues.tooFewImages.label"),
      detail: t("seoAudit.issues.tooFewImages.detail", { count: mediaImages.length }),
      severity: "info",
    });
    score -= 8;
  }

  // Body description
  if (descriptionText.length < 100) {
    issues.push({
      field: "description",
      label: t("seoAudit.issues.descriptionTooShort.label"),
      detail: t("seoAudit.issues.descriptionTooShort.detail", { length: descriptionText.length }),
      severity: "warning",
    });
    score -= 15;
  }

  // Product status
  if (product.status !== "ACTIVE") {
    issues.push({
      field: "status",
      label: t("seoAudit.issues.notActive.label"),
      detail: t("seoAudit.issues.notActive.detail", { status: product.status }),
      severity: "warning",
    });
    score -= 10;
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
    productDescription: descriptionText,
    productDescriptionHtml: product.descriptionHtml || "",
  };
}

const PASSWORD_PAGE_PATTERN = /name=["']password["']|action=["'][^"']*\/password["']/i;

export async function fetchLivePageHtml(url) {
  if (!url) return { accessible: false, html: null };
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RankavioBot/1.0; +https://rankavio.com)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { accessible: false, html: null };
    const html = await response.text();
    if (PASSWORD_PAGE_PATTERN.test(html)) {
      return { accessible: false, html: null };
    }
    return { accessible: true, html };
  } catch {
    return { accessible: false, html: null };
  }
}

export function auditLivePage(html, t) {
  const issues = [];
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim();
  if (!title) {
    issues.push({
      field: "theme.title",
      label: t("seoAudit.themeIssues.titleTag.label"),
      detail: t("seoAudit.themeIssues.titleTag.detail"),
      severity: "theme",
    });
  }

  const metaDescription = ($('meta[name="description"]').attr("content") || "").trim();
  if (!metaDescription) {
    issues.push({
      field: "theme.metaDescription",
      label: t("seoAudit.themeIssues.metaDescriptionTag.label"),
      detail: t("seoAudit.themeIssues.metaDescriptionTag.detail"),
      severity: "theme",
    });
  }

  const canonical = $('link[rel="canonical"]').attr("href");
  if (!canonical) {
    issues.push({
      field: "theme.canonical",
      label: t("seoAudit.themeIssues.canonical.label"),
      detail: t("seoAudit.themeIssues.canonical.detail"),
      severity: "theme",
    });
  }

  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogDescription = $('meta[property="og:description"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  if (!ogTitle || !ogDescription || !ogImage) {
    issues.push({
      field: "theme.og",
      label: t("seoAudit.themeIssues.ogTags.label"),
      detail: t("seoAudit.themeIssues.ogTags.detail"),
      severity: "theme",
    });
  }

  let hasProductSchema = false;
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html() || "";
    if (content.includes('"Product"')) {
      hasProductSchema = true;
    }
  });
  if (!hasProductSchema) {
    issues.push({
      field: "theme.structuredData",
      label: t("seoAudit.themeIssues.structuredData.label"),
      detail: t("seoAudit.themeIssues.structuredData.detail"),
      severity: "theme",
    });
  }

  const h1Count = $("h1").length;
  if (h1Count === 0) {
    issues.push({
      field: "theme.h1",
      label: t("seoAudit.themeIssues.h1Missing.label"),
      detail: t("seoAudit.themeIssues.h1Missing.detail"),
      severity: "theme",
    });
  } else if (h1Count > 1) {
    issues.push({
      field: "theme.h1",
      label: t("seoAudit.themeIssues.h1Multiple.label"),
      detail: t("seoAudit.themeIssues.h1Multiple.detail", { count: h1Count }),
      severity: "theme",
    });
  }

  return { issues };
}
