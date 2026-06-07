# Snap6 — Geliştirme Geçmişi ve Karar Kayıtları

Bu dosya, projenin fikir aşamasından mevcut duruma kadar yapılan araştırma,
tartışma ve mimari kararların özetidir (Claude Code ile yapılan konuşmalardan
derlenmiştir).

---

## 1. Fikrin Doğuşu — Pazar Araştırması

**Başlangıç noktası:** Shopify App Store'daki öne çıkan uygulamalar
(`apps.shopify.com/stories?filter=featured-app&locale=tr`) incelendi; az rakipli,
girilebilir sektörler arandı.

**Doğrulanan fikir:** "1 ürün fotoğrafı yükle → AI 6 farklı sahnede gerçekçi
showcase görseli üretsin" niş'i araştırıldı. Gerçek rakip inceleme sayıları
kontrol edildi (yeni girenler dahil — Cartario: 0 yorum, MagicStudio: 0 yorum).
Sonuç: bu **spesifik** kombinasyon ("tek tık → 6 hazır sahne, prompt yazmaya
gerek yok") henüz baskın bir oyuncusu olmayan açık bir niş.

**Dışarıdan gelen eleştiri ve değerlendirmesi:** "AI Image Generator" kategorisinin
"4.126 sonuç" ile kırmızı okyanus olduğu, bunun yerine "PrintLabApp" (POD/DTF
print-ready dosya üretimi) gibi bambaşka bir yöne pivot edilmesi önerisi geldi.
Bu öneri incelendi: (a) "PrintLabApp" diye bir şeyin var olmadığı doğrulandı,
(b) eleştiri "AI image generator" kategorisinin genel doygunluğuna odaklanıyordu,
oysa bizim niş çok daha dar ve spesifikti. **Karar: mevcut fikir terk edilmedi,
konumlandırma keskinleştirildi** (bkz. Bölüm 2).

---

## 2. Konumlandırma Kararı (Onaylandı ve Uygulandı)

Jenerik "AI Image Generator" kimliğinden uzaklaşıp şu üç değişiklik yapıldı:

1. **Spesifik vaat:** App Store başlığı jenerik tutulmadı →
   **"Snap6: AI Photo Studio"** / Türkçe dahili adlandırma:
   **"6 Sahneli AI Foto Stüdyosu — Tek Tıkla"**
2. **Mesaj odağı değişti:** "görsel üretirim" yerine **"stüdyo çekimi maliyetini
   ortadan kaldırırım, 6 hazır sahne sunarım"** — rakiplerin çoğu tek tek,
   prompt yazarak üretim yapıyor; biz tek tıkla 6 hazır sahne sunuyoruz.
3. **SEO + konumlandırma dengesi:** Pazarlama metinlerinde "AI image generator"
   anahtar kelimesi aranabilirlik için geçiyor, ama ana konumlanma
   **"6 otomatik sahne, tek tık"** üzerine kuruldu.

Bu kararlar; dashboard banner'ı, `/app/generate` sayfası, buton metinleri ve
`APP_STORE_LISTING.md` içeriğine yansıtıldı.

---

## 3. Teknik Mimari (Faz 1 — MVP)

- **Framework:** Remix (`@shopify/shopify-app-remix`) + Polaris UI + App Bridge
- **Görsel üretim motoru:** Replicate API
  - `lucataco/remove-bg` → arka plan temizleme
  - `black-forest-labs/flux-1.1-pro` → 6 farklı sahne üretimi (paralel, `Promise.all`)
  - 6 sahne: Studio Beyaz, Lifestyle İç Mekan, Dış Mekan, Mermer/Lüks,
    Dramatik Koyu, Flat Lay (`app/services/replicate.server.js` → `SCENE_PROMPTS`)
- **Veritabanı:** Prisma + SQLite (`Session`, `Generation`, `Subscription`)
- **Plan/Billing:** Shopify Billing API — FREE (10/ay), BASIC ($9.99/100),
  PRO ($29.99/500) — `BillingInterval.Every30Days`
- **Sayfalar:** Ana sayfa, `/app/generate` (üretim), `/app/history`, `/app/billing`

---

## 4. Faz 2 — Üç Yeni Yetenek (Tamamlandı)

Kullanıcı isteği: *"ürün düzenleme ekranında görseller eklenebilsin, Google
tarafında rekabet analizi yapılabilsin, ve Shopify'daki içeriklerin SEO'su
kontrol edilsin."*

### a) Admin UI Extension — Ürün Sayfasına Gömülü 6-Sahne Üretici
- **Konum:** `extensions/product-photo-studio/`
- Shopify'ın native **Admin Block Extension** mekanizması kullanıldı
  (`admin.product-details.block.render` hedefi) — merchant ürün sayfasından
  ayrılmadan üretim yapabiliyor.
- `BlockExtension.jsx`: ürünün öne çıkan görselini Admin GraphQL (`query` API'si)
  ile çeker, `auth.idToken()` ile backend'e authenticated istek atar,
  6 sahneyi grid'de gösterir, seçilenleri `productCreateMedia` mutasyonuyla
  ürüne kaydeder.
- Yeni backend rotaları: `api.extension.generate.jsx`, `api.extension.save.jsx`
  (CORS + `authenticate.admin` korumalı, mevcut `replicate.server.js` ve
  `subscription.server.js` yeniden kullanılıyor — kod tekrarı yok)

> **Geliştirici notu:** `BlockExtension.jsx` içindeki `APP_URL` sabiti, her
> `npm run dev` çalıştırmasında değişen tünel adresiyle elle güncellenmeli
> (bkz. dosya başındaki yorum).

### b) Google Rekabet Analizi
- **Google Custom Search JSON API** entegrasyonu (`google-search.server.js`)
- Seçilen ürün için Google'da rakip arama → ilk 10 sonuç DB'ye kaydedilir
  (`CompetitorAnalysis` modeli)
- **Claude API (Anthropic, `claude-sonnet-4-6`)** ile rakip sonuçlarının AI
  özeti çıkarılır (`ai-text.server.js` → `summarizeCompetitors`)
- UI: `/app/competition` — ürün seç → analiz yap → rakip listesi + AI özet kartı

### c) SEO Kontrolü — Audit + AI Öneri + Tek Tıkla Uygula
- `seo-audit.server.js`: ürünün SEO başlığı, meta açıklaması, URL handle'ı ve
  görsel alt-text kapsamını denetler, 0-100 puanlar, sorun listesi çıkarır
- Claude API ile her zayıf alan için iyileştirilmiş metin önerisi üretilir
  (`generateSeoSuggestions`)
- UI: `/app/seo` — denetim sonucu (puan + sorunlar) → düzenlenebilir öneriler →
  **"Uygula"** → `productUpdate` ve medya `alt` mutasyonlarıyla doğrudan
  Shopify ürününe yazılır
- Sonuçlar `SeoAudit` modelinde saklanır (`appliedAt` ile uygulanma takibi)

### Ortak Altyapı
- **Yeni Prisma modelleri:** `CompetitorAnalysis`, `SeoAudit`
  (migration uygulandı: `npx prisma generate && npx prisma db push`)
- **Yeni env değişkenleri:** `ANTHROPIC_API_KEY`, `GOOGLE_SEARCH_API_KEY`,
  `GOOGLE_SEARCH_ENGINE_ID`
- **NavMenu güncellendi:** Ana Sayfa, Görsel Üret, Rekabet Analizi,
  SEO Kontrolü, Geçmiş, Abonelik

---

## 5. Mevcut Durum / Sıradaki Adımlar

✅ Tüm kod yazıldı, Prisma migration uygulandı, extension bağımlılıkları kuruldu
(`npm install` — 0 vulnerability), tüm 5 tablo (`Session`, `Generation`,
`Subscription`, `CompetitorAnalysis`, `SeoAudit`) veritabanında doğrulandı.

**Test/doğrulama için yapılması gerekenler:**
1. `npm run dev` (= `shopify app dev`) ile geliştirme sunucusunu başlat
   - Bu, Partner hesabına bağlanmanı, tünel açmanı ve development store
     seçmeni otomatik yönetir — Partner Dashboard'a manuel gitmene gerek yok
   - CLI, `shopify.app.toml`'daki `application_url`'i yeni tünel adresiyle
     günceller — **bu adresi `BlockExtension.jsx`'teki `APP_URL` sabitine de
     elle yazmayı unutma**
2. Development store'da bir ürün düzenleme sayfasını aç → Snap6 block
   extension'ının göründüğünü doğrula
3. Extension'dan "Tek Tıkla 6 Sahne Üret" → sonucun geldiğini ve seçilen
   görsellerin ürüne kaydedildiğini doğrula
4. `/app/competition`'da bir ürün seç → Google sonuçları + AI özetinin
   geldiğini doğrula (gerçek `GOOGLE_SEARCH_API_KEY`/`GOOGLE_SEARCH_ENGINE_ID`
   ve `ANTHROPIC_API_KEY` `.env`'de tanımlı olmalı)
5. `/app/seo`'da denetim çalıştır → puan/öneri görünümü ve "Uygula" sonrası
   Shopify ürününde değişikliğin yansıdığını doğrula

---

## 6. Önemli Dosya Haritası

```
AIImageGenerator/
├── app/
│   ├── routes/
│   │   ├── app._index.jsx          → Ana sayfa (Snap6 — Stüdyo Çekimine Son)
│   │   ├── app.generate.jsx        → 6 Sahne Üret sayfası
│   │   ├── app.competition.jsx     → Rekabet Analizi
│   │   ├── app.seo.jsx             → SEO Kontrolü
│   │   ├── app.history.jsx / app.billing.jsx
│   │   ├── api.extension.generate.jsx  → Extension'dan üretim isteği
│   │   └── api.extension.save.jsx      → Extension'dan ürüne kaydetme
│   ├── services/
│   │   ├── replicate.server.js     → 6 sahne üretim motoru
│   │   ├── ai-text.server.js       → Claude API wrapper (özet + SEO önerisi)
│   │   ├── google-search.server.js → Google Custom Search wrapper
│   │   └── seo-audit.server.js     → SEO denetim mantığı + puanlama
│   └── models/
│       ├── generation.server.js / subscription.server.js
│       ├── competitor-analysis.server.js
│       └── seo-audit.server.js
├── extensions/
│   └── product-photo-studio/
│       ├── shopify.extension.toml  → admin.product-details.block.render hedefi
│       └── src/BlockExtension.jsx  → Ürün sayfasına gömülü üretim arayüzü
├── prisma/schema.prisma            → Session, Generation, Subscription,
│                                      CompetitorAnalysis, SeoAudit
└── APP_STORE_LISTING.md            → App Store başvuru metinleri (EN)
```
