const SERPAPI_ENDPOINT = "https://serpapi.com/search";

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function parseCurrency(currency) {
  if (!currency) return "USD";
  const c = currency.toLowerCase();
  if (currency === "₺" || c === "try") return "TRY";
  if (currency === "€" || c === "eur") return "EUR";
  if (currency === "£" || c === "gbp") return "GBP";
  if (currency === "$" || c === "usd") return "USD";
  return currency;
}

function parseShoppingResults(results) {
  return results
    .slice(0, 20)
    .map((r) => ({
      site: r.source || extractDomain(r.link || ""),
      title: r.title || "",
      price: r.extracted_price ?? r.price ?? 0,
      currency: parseCurrency(r.currency ?? ""),
      link: r.link || r.product_link || "",
      rating: r.rating ?? null,
      reviews: r.reviews ?? null,
      source: "shopping",
    }))
    .filter((r) => r.price > 0);
}

function parseOrganicResults(results) {
  const prices = [];
  for (const r of results) {
    const ext = r.rich_snippet?.bottom?.detected_extensions;
    if (!ext) continue;
    const price = ext.price ?? 0;
    const priceFrom = ext.price_from ?? null;
    const priceTo = ext.price_to ?? null;
    const effectivePrice = price || priceFrom || 0;
    if (effectivePrice > 0) {
      prices.push({
        site: extractDomain(r.link || ""),
        title: r.title || "",
        price: effectivePrice,
        priceFrom,
        priceTo,
        currency: parseCurrency(ext.currency ?? ""),
        link: r.link || "",
        rating: ext.rating ?? null,
        reviews: ext.reviews ?? null,
        source: "organic",
      });
    }
  }
  return prices;
}

/**
 * Searches Google Shopping (with an organic-results fallback) via SerpAPI and
 * returns competitor listings with real price/rating data, sorted by price.
 */
export async function searchCompetitorPrices(query, { country = "tr" } = {}) {
  const apiKey = process.env.SERP_API_KEY;
  if (!apiKey) {
    throw new Error("SerpAPI yapılandırılmamış (.env dosyasında SERP_API_KEY eksik)");
  }
  const hl = country === "tr" ? "tr" : "en";
  const results = [];

  try {
    const url = new URL(SERPAPI_ENDPOINT);
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", query);
    url.searchParams.set("gl", country);
    url.searchParams.set("hl", hl);
    url.searchParams.set("num", "20");
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      if (data.shopping_results) results.push(...parseShoppingResults(data.shopping_results));
    }
  } catch {
    // continue to organic fallback
  }

  if (results.length < 5) {
    try {
      const url = new URL(SERPAPI_ENDPOINT);
      url.searchParams.set("engine", "google");
      url.searchParams.set("q", query);
      url.searchParams.set("gl", country);
      url.searchParams.set("hl", hl);
      url.searchParams.set("num", "20");
      url.searchParams.set("api_key", apiKey);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        if (data.organic_results) {
          const organicPrices = parseOrganicResults(data.organic_results);
          const existingSites = new Set(results.map((r) => r.site));
          results.push(...organicPrices.filter((r) => !existingSites.has(r.site)));
        }
      }
    } catch {
      // ignore — return whatever we have
    }
  }

  results.sort((a, b) => a.price - b.price);
  return results;
}
