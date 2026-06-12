import { useTranslation } from "react-i18next";
import {
  LogoMark,
  IconBolt,
  IconGrid,
  IconUpload,
  IconCredit,
  IconCheck,
  IconArrow,
} from "./icons";

const APP_URL = "https://app.rankavio.com";
const APP_STORE_URL = "https://apps.shopify.com/aiimagegenerator";

const CATEGORY_IMAGES = [
  { key: "general", file: "genel.png" },
  { key: "armchair", file: "koltuk-berjer.png" },
  { key: "sofaSet", file: "koltuk-takimi.png" },
  { key: "diningTable", file: "yemek-masasi.png" },
  { key: "chair", file: "sandalye.png" },
  { key: "bedFrame", file: "karyola.png" },
  { key: "officeFurniture", file: "ofis-mobilyasi.png" },
  { key: "cushion", file: "minder.png" },
  { key: "pillow", file: "kirlent.png" },
  { key: "curtain", file: "perde.png" },
  { key: "tablecloth", file: "masa-ortusu.png" },
  { key: "blanket", file: "battaniye.png" },
  { key: "bedspread", file: "yatak-ortusu.png" },
  { key: "clothing", file: "giyim.png" },
  { key: "babyClothing", file: "bebek-kiyafeti.png" },
  { key: "jewelry", file: "taki.png" },
  { key: "bag", file: "canta.png" },
  { key: "underwear", file: "ic-giyim.png" },
  { key: "hat", file: "sapka.png" },
];

const SHOWCASE_RESULTS = [
  { key: "studioWhite", file: "koltuk-takimi.png" },
  { key: "lifestyle", file: "yemek-masasi.png" },
  { key: "detail", file: "taki.png" },
  { key: "luxury", file: "canta.png" },
  { key: "editorial", file: "perde.png" },
  { key: "flatLay", file: "battaniye.png" },
];

const FEATURE_ICONS = [IconBolt, IconGrid, IconUpload, IconCredit];
const HERO_IMAGES = [
  "koltuk-berjer.png",
  "taki.png",
  "canta.png",
  "battaniye.png",
  "bebek-kiyafeti.png",
  "ofis-mobilyasi.png",
];

export default function MarketingHome() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("en") ? "en" : "tr";

  const features = t("marketing.features.items", { returnObjects: true });
  const steps = t("marketing.howItWorks.steps", { returnObjects: true });
  const compareHeaders = t("marketing.compare.headers", { returnObjects: true });
  const compareRows = t("marketing.compare.rows", { returnObjects: true });
  const plans = t("marketing.pricing.plans", { returnObjects: true });
  const faqItems = t("marketing.faq.items", { returnObjects: true });

  return (
    <div className="rk">
      <header className="rk__nav">
        <div className="rk__container rk__nav-inner">
          <a href="#top" className="rk__logo" aria-label="Rankavio">
            <LogoMark />
            Rankavio
          </a>
          <nav className="rk__nav-links">
            <a href="#features">{t("marketing.nav.features")}</a>
            <a href="#categories">{t("marketing.nav.categories")}</a>
            <a href="#how-it-works">{t("marketing.nav.howItWorks")}</a>
            <a href="#pricing">{t("marketing.nav.pricing")}</a>
            <a href="#faq">{t("marketing.nav.faq")}</a>
          </nav>
          <div className="rk__nav-right">
            <div className="rk__lang-toggle" aria-label="Language">
              <a href="?lng=tr" className={lang === "tr" ? "is-active" : ""}>TR</a>
              <a href="?lng=en" className={lang === "en" ? "is-active" : ""}>EN</a>
            </div>
            <a href={APP_STORE_URL} className="rk__btn rk__btn--primary rk__btn--sm">
              {t("marketing.nav.cta")}
            </a>
          </div>
        </div>
      </header>

      <section className="rk__hero" id="top">
        <div className="rk__hero-media" aria-hidden="true">
          {HERO_IMAGES.map((file, index) => (
            <img
              key={file}
              src={`/images/photo-sets/${file}`}
              alt=""
              className={`rk__hero-image rk__hero-image--${index + 1}`}
            />
          ))}
        </div>
        <div className="rk__container rk__hero-inner">
          <div className="rk__hero-copy">
            <p className="rk__badge">{t("marketing.hero.badge")}</p>
            <h1>Rankavio</h1>
            <p className="rk__hero-title">
              {t("marketing.hero.titleLine1")} {t("marketing.hero.titleLine2")}
            </p>
            <p className="rk__hero-text">{t("marketing.hero.subtitle")}</p>
            <div className="rk__hero-actions">
              <a href={APP_STORE_URL} className="rk__btn rk__btn--primary">
                {t("marketing.hero.ctaPrimary")}
                <IconArrow />
              </a>
              <a href="#how-it-works" className="rk__btn rk__btn--ghost">
                {t("marketing.hero.ctaSecondary")}
              </a>
            </div>
            <ul className="rk__hero-meta">
              <li><IconCheck aria-hidden="true" /> {t("marketing.hero.meta.noPrompt")}</li>
              <li><IconCheck aria-hidden="true" /> {t("marketing.hero.meta.categories")}</li>
              <li><IconCheck aria-hidden="true" /> {t("marketing.hero.meta.directSave")}</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rk__studio" aria-label={t("marketing.hero.showcaseResultLabel")}>
        <div className="rk__container rk__studio-inner">
          <div className="rk__studio-before">
            <span>{t("marketing.hero.showcaseLabel")}</span>
            <img src="/images/photo-sets/ic-giyim.png" alt={t("marketing.hero.showcaseLabel")} loading="lazy" />
          </div>
          <div className="rk__studio-arrow" aria-hidden="true"><IconArrow /></div>
          <div className="rk__studio-after">
            <div>
              <span>{t("marketing.hero.showcaseResultLabel")}</span>
              <strong>{features[0].title}</strong>
            </div>
            <div className="rk__scene-grid">
              {SHOWCASE_RESULTS.map((item) => (
                <figure key={item.key}>
                  <img src={`/images/photo-sets/${item.file}`} alt={t(`marketing.showcaseScenes.${item.key}`)} loading="lazy" />
                  <figcaption>{t(`marketing.showcaseScenes.${item.key}`)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rk__section" id="features">
        <div className="rk__container rk__split-head">
          <div>
            <p className="rk__section-label">{t("marketing.features.eyebrow")}</p>
            <h2>{t("marketing.features.heading")}</h2>
          </div>
          <p>{t("marketing.features.subheading")}</p>
        </div>
        <div className="rk__container">
          <div className="rk__feature-board">
            <div className="rk__feature-main">
              <IconBolt aria-hidden="true" />
              <h3>{features[0].title}</h3>
              <p>{features[0].description}</p>
            </div>
            <div className="rk__feature-stack">
              {features.slice(1).map((feature, i) => {
                const Icon = FEATURE_ICONS[(i + 1) % FEATURE_ICONS.length];
                return (
                  <article key={feature.title} className="rk__feature-row">
                    <Icon aria-hidden="true" />
                    <div>
                      <h3>{feature.title}</h3>
                      <p>{feature.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="rk__section rk__section--gallery" id="categories">
        <div className="rk__container rk__split-head">
          <div>
            <p className="rk__section-label">{t("marketing.categories.eyebrow")}</p>
            <h2>{t("marketing.categories.heading")}</h2>
          </div>
          <p>{t("marketing.categories.subheading")}</p>
        </div>
        <div className="rk__category-rail" aria-label={t("marketing.categories.heading")}>
          {CATEGORY_IMAGES.map((item) => (
            <figure className="rk__cat-item" key={item.key}>
              <img src={`/images/photo-sets/${item.file}`} alt={t(`marketing.categories.items.${item.key}`)} loading="lazy" />
              <figcaption>{t(`marketing.categories.items.${item.key}`)}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="rk__section rk__section--light" id="how-it-works">
        <div className="rk__container">
          <div className="rk__section-head">
            <p className="rk__section-label">{t("marketing.howItWorks.eyebrow")}</p>
            <h2>{t("marketing.howItWorks.heading")}</h2>
            <p>{t("marketing.howItWorks.subheading")}</p>
          </div>
          <ol className="rk__steps">
            {steps.map((step, i) => (
              <li className="rk__step" key={step.title}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="rk__section">
        <div className="rk__container rk__compare-layout">
          <div className="rk__compare-copy">
            <p className="rk__section-label">{t("marketing.compare.eyebrow")}</p>
            <h2>{t("marketing.compare.heading")}</h2>
            <p>{t("marketing.compare.subheading")}</p>
          </div>
          <div className="rk__compare">
            <table>
              <thead>
                <tr>
                  {compareHeaders.map((header, i) => (
                    <th key={i}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, i) => (
                      <td key={i}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rk__section rk__section--pricing" id="pricing">
        <div className="rk__container">
          <div className="rk__section-head">
            <p className="rk__section-label">{t("marketing.pricing.eyebrow")}</p>
            <h2>{t("marketing.pricing.heading")}</h2>
            <p>{t("marketing.pricing.subheading")}</p>
          </div>
          <div className="rk__pricing">
            {plans.map((plan) => (
              <div
                className={`rk__price-card${plan.highlight ? " rk__price-card--highlight" : ""}`}
                key={plan.name}
              >
                {plan.highlight && <span className="rk__price-tag">{plan.highlight}</span>}
                <h3>{plan.name}</h3>
                <div className="rk__price-amount">
                  {plan.price} <span>{t("marketing.pricing.perMonth")}</span>
                </div>
                <div className="rk__price-credits">{plan.credits}</div>
                <ul className="rk__price-features">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <IconCheck aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href={APP_STORE_URL}
                  className={`rk__btn rk__btn--block ${plan.highlight ? "rk__btn--primary" : "rk__btn--ghost"}`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rk__section rk__section--light" id="faq">
        <div className="rk__container">
          <div className="rk__section-head">
            <p className="rk__section-label">{t("marketing.faq.eyebrow")}</p>
            <h2>{t("marketing.faq.heading")}</h2>
          </div>
          <div className="rk__faq">
            {faqItems.map((item, i) => (
              <details className="rk__faq-item" key={item.q} open={i === 0}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="rk__section">
        <div className="rk__container">
          <div className="rk__cta">
            <h2>{t("marketing.finalCta.heading")}</h2>
            <p>{t("marketing.finalCta.subheading")}</p>
            <div className="rk__hero-actions">
              <a href={APP_STORE_URL} className="rk__btn rk__btn--primary">
                {t("marketing.finalCta.ctaPrimary")}
                <IconArrow />
              </a>
              <a href="#pricing" className="rk__btn rk__btn--ghost">
                {t("marketing.finalCta.ctaSecondary")}
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="rk__footer">
        <div className="rk__container rk__footer-inner">
          <div>
            <a href="#top" className="rk__logo">
              <LogoMark size={26} />
              Rankavio
            </a>
            <p className="rk__footer-copy">{t("marketing.footer.tagline")}</p>
          </div>
          <ul className="rk__footer-links">
            <li><a href="#features">{t("marketing.footer.links.features")}</a></li>
            <li><a href="#pricing">{t("marketing.footer.links.pricing")}</a></li>
            <li><a href="#faq">{t("marketing.footer.links.faq")}</a></li>
            <li><a href={APP_URL}>{t("marketing.footer.links.app")}</a></li>
            <li><a href="/privacy-policy">{t("marketing.footer.links.privacy")}</a></li>
            <li><a href="/terms-of-service">{t("marketing.footer.links.terms")}</a></li>
          </ul>
          <p className="rk__footer-copy">
            © {new Date().getFullYear()} Rankavio. {t("marketing.footer.copyright")}
          </p>
        </div>
      </footer>
    </div>
  );
}
