import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

async function askClaude(systemPrompt, userPrompt, maxTokens = 1024) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  return message.content?.[0]?.text?.trim() || "";
}

export async function summarizeCompetitors(productTitle, results) {
  const system = `Sen bir e-ticaret fiyatlandırma ve rekabet analistisin. Sana bir ürün adı
ve o ürünü satan rakiplerin gerçek fiyat/puan verileri verilecek. Görevin:
1. Rakiplerin fiyat aralığını ve ortalama fiyat seviyesini yorumla (en ucuz/en pahalı kim, makas ne kadar geniş)
2. Yüksek puanlı/yorumlu rakiplerden konumlandırma ipuçları çıkar
3. Bu ürün için fiyatlandırma veya konumlandırma açısından fark yaratabilecek bir fırsat öner
Yanıtını Türkçe, kısa ve maddeler halinde ver. En fazla 4-5 madde, her biri 1-2 cümle.
Sayısal verileri (fiyat, puan) yorumlarken doğrudan referans ver.`;

  const resultsText = results
    .map((r, i) => {
      const price = r.priceFrom && r.priceTo
        ? `${r.priceFrom}–${r.priceTo} ${r.currency}`
        : `${r.price} ${r.currency}`;
      const rating = r.rating ? `${r.rating}★ (${r.reviews ?? 0} yorum)` : "puan yok";
      return `${i + 1}. ${r.title}\n   Satıcı: ${r.site}\n   Fiyat: ${price}\n   Puan: ${rating}`;
    })
    .join("\n\n");

  const user = `Ürün: "${productTitle}"\n\nRakip fiyat listesi (ucuzdan pahalıya sıralı):\n\n${resultsText}\n\nBu rakipleri analiz et ve yukarıdaki 3 maddeye göre özet çıkar.`;

  return askClaude(system, user, 800);
}

export async function generateSeoSuggestions(productTitle, productDescription, currentSeo, issues) {
  const system = `Sen bir Shopify SEO uzmanısın. Sana bir ürünün mevcut SEO bilgileri ve
tespit edilen sorunlar verilecek. Görevin, sorunlu alanlar için iyileştirilmiş içerik önermek.

Kurallar:
- SEO başlığı: 50-60 karakter, ürünün ana faydasını/anahtar kelimesini içersin
- Meta açıklama: 150-160 karakter, harekete geçirici, anahtar kelime içersin
- URL handle: kısa, küçük harf, tire ile ayrılmış, anahtar kelime odaklı, gereksiz kelime yok
- Görsel alt-text: ürünü ve bağlamını açıklayan, anahtar kelime içeren kısa cümle

Yanıtını SADECE şu JSON formatında ver, başka hiçbir metin ekleme:
{"title": "...", "metaDescription": "...", "handle": "...", "altText": "..."}

Sadece tespit edilen sorunlu alanlar için değer üret, sorunsuz alanlar için null koy.`;

  const user = `Ürün adı: "${productTitle}"
Ürün açıklaması: "${productDescription || "(yok)"}"
Mevcut SEO başlığı: "${currentSeo.title || "(yok)"}"
Mevcut meta açıklama: "${currentSeo.description || "(yok)"}"
Mevcut URL handle: "${currentSeo.handle || "(yok)"}"

Tespit edilen sorunlar:
${issues.map((i) => `- ${i.label}: ${i.detail}`).join("\n")}

Yukarıdaki JSON formatında öneri üret.`;

  const raw = await askClaude(system, user, 600);

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    return {};
  }
}
