const PRODUCT_LIST_QUERY = `
  query getProductsForList($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: TITLE) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        title
        handle
        status
        productType
        tags
        descriptionHtml
        seo { title description }
        featuredImage { url }
        media(first: 10) {
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
  }
`;

export async function fetchProductsForList(admin, { first = 50, after = null } = {}) {
  const response = await admin.graphql(PRODUCT_LIST_QUERY, {
    variables: { first, after },
  });
  const { data } = await response.json();
  return data.products;
}

const PRODUCTS_COUNT_QUERY = `
  query getProductsCount {
    productsCount {
      count
    }
  }
`;

export async function fetchProductsCount(admin) {
  const response = await admin.graphql(PRODUCTS_COUNT_QUERY);
  const { data } = await response.json();
  return data.productsCount?.count ?? 0;
}

const PRODUCT_BASIC_QUERY = `
  query getProductBasicInfo($id: ID!) {
    product(id: $id) {
      id
      title
      productType
      tags
      descriptionHtml
      featuredImage { url }
    }
  }
`;

export async function fetchProductBasicInfo(admin, productId) {
  const response = await admin.graphql(PRODUCT_BASIC_QUERY, {
    variables: { id: `gid://shopify/Product/${productId}` },
  });
  const { data } = await response.json();
  if (!data.product) return null;

  return {
    id: data.product.id.replace("gid://shopify/Product/", ""),
    title: data.product.title,
    productType: data.product.productType || "",
    tags: data.product.tags || [],
    descriptionHtml: data.product.descriptionHtml || "",
    image: data.product.featuredImage?.url || null,
  };
}

const PRODUCT_CREATE_MEDIA_MUTATION = `
  mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media {
        ... on MediaImage {
          id
          image { url }
        }
      }
      mediaUserErrors { field message }
    }
  }
`;

export async function addImagesToProduct(admin, productId, imageUrls) {
  const errors = [];
  for (const url of imageUrls) {
    const response = await admin.graphql(PRODUCT_CREATE_MEDIA_MUTATION, {
      variables: {
        productId: `gid://shopify/Product/${productId}`,
        media: [{ alt: "AI Generated Photo", mediaContentType: "IMAGE", originalSource: url }],
      },
    });
    const { data } = await response.json();
    const userErrors = data?.productCreateMedia?.mediaUserErrors || [];
    if (userErrors.length > 0) {
      errors.push(...userErrors.map((e) => e.message));
    }
  }
  return { success: errors.length === 0, errors };
}
