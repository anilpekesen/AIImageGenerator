const SEARCH_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

export async function searchCompetitors(query, { num = 10 } = {}) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !engineId) {
    throw new Error("Google Custom Search API yapılandırılmamış (.env dosyasını kontrol edin)");
  }

  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", engineId);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(num, 10)));

  const response = await fetch(url.toString());

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google Search API hatası (${response.status}): ${body}`);
  }

  const data = await response.json();

  const items = data.items || [];
  return items.map((item) => ({
    title: item.title,
    link: item.link,
    snippet: item.snippet,
    displayLink: item.displayLink,
  }));
}
