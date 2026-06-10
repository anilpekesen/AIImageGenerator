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

const CATEGORY_IMAGES = [
  { key: "general", file: "genel.png" },
  { key: "sofaSet", file: "koltuk-takimi.png" },
  { key: "clothing", file: "giyim.png" },
  { key: "jewelry", file: "taki.png" },
  { key: "bag", file: "canta.png" },
  { key: "underwear", file: "ic-giyim.png" },
  { key: "hat", file: "sapka.png" },
  { key: "babyClothing", file: "bebek-kiyafeti.png" },
];

const SHOWCASE_RESULTS = [
  { key: "studioWhite", file: "genel.png" },
  { key: "lifestyle", file: "giyim.png" },
  { key: "detail", file: "taki.png" },
  { key: "luxury", file: "canta.png" },
  { key: "editorial", file: "sapka.png" },
  { key: "flatLay", file: "bebek-kiyafeti.png" },
];

const FEATURE_ICONS = [IconBolt, IconGrid, IconUpload, IconCredit];

export default function MarketingHome() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const features = t("marketing.features.items", { returnObjects: true });
  const steps = t("marketing.howItWorks.steps", { returnObjects: true });
  const compareHeaders = t("marketing.compare.headers", { returnObjects: true });
  const compareRows = t("marketing.compare.rows", { returnObjects: true });
  const plans = t("marketing.pricing.plans", { returnObjects: true });
  const faqItems = t("marketing.faq.items", { returnObjects: true });

  return (
    <div className="rk">
      {/* ----------------------------- nav ----------------------------- */}
      <header className="rk__nav">
        <div className="rk__container rk__nav-inner">
          <a href="#top" className="rk__logo">
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
            <div className="rk__lang-toggle">
              <a href="?lng=tr" className={lang === "tr" ? "is-active" : ""}>TR</a>
              <a href="?lng=en" className={lang === "en" ? "is-active" : ""}>EN</a>
            </div>
            <a href={APP_URL} className="rk__btn rk__btn--primary rk__btn--sm">
              {t("marketing.nav.cta")}
            </a>
          </div>
        </div>
      </header>

      {/* ----------------------------- hero ----------------------------- */}
      <section className="rk__hero" id="top">
        <div className="rk__hero-glow" />
        <div className="rk__container rk__hero-inner">
          <div>
            <span className="rk__badge">
              <span className="rk__dot" />
              {t("marketing.hero.badge")}
            </span>
            <h1>
              {t("marketing.hero.titleLine1")}
              <br />
              <span className="rk__grad-text">{t("marketing.hero.titleLine2")}</span>
            </h1>
            <p>{t("marketing.hero.subtitle")}</p>
            <div className="rk__hero-actions">
              <a href={APP_URL} className="rk__btn rk__btn--primary">
                {t("marketing.hero.ctaPrimary")}
                <IconArrow />
              </a>
              <a href="#how-it-works" className="rk__btn rk__btn--ghost">
                {t("marketing.hero.ctaSecondary")}
              </a>
            </div>
            <ul className="rk__hero-meta">
              <li><IconCheck /> {t("marketing.hero.meta.noPrompt")}</li>
              <li><IconCheck /> {t("marketing.hero.meta.categories")}</li>
              <li><IconCheck /> {t("marketing.hero.meta.directSave")}</li>
            </ul>
          </div>

          <div className="rk__showcase">
            <div className="rk__showcase-header">
              <span>{t("marketing.hero.showcaseLabel")}</span>
              <span className="rk__grad-text">{t("marketing.hero.showcaseResultLabel")}</span>
            </div>
            <div className="rk__showcase-body">
              <div className="rk__showcase-input">
                <img src="/images/photo-sets/ic-giyim.png" alt={t("marketing.hero.showcaseLabel")} loading="lazy" />
                <span className="rk__showcase-arrow"><IconArrow /></span>
              </div>
              <div className="rk__showcase-grid">
                {SHOWCASE_RESULTS.map((item) => (
                  <div key={item.key}>
                    <img src={`/images/photo-sets/${item.file}`} alt={t(`marketing.showcaseScenes.${item.key}`)} loading="lazy" />
                    <span>{t(`marketing.showcaseScenes.${item.key}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- features --------------------------- */}
      <section className="rk__section" id="features">
        <div className="rk__container">
          <div className="rk__section-head">
            <span className="rk__eyebrow">{t("marketing.features.eyebrow")}</span>
            <h2>{t("marketing.features.heading")}</h2>
            <p>{t("marketing.features.subheading")}</p>
          </div>
          <div className="rk__grid-4">
            {features.map((feature, i) => {
              const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
              return (
                <div className="rk__card" key={feature.title}>
                  <div className="rk__card-icon"><Icon /></div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* -------------------------- categories --------------------------- */}
      <section className="rk__section rk__section--light" id="categories">
        <div className="rk__container">
          <div className="rk__section-head">
            <span className="rk__eyebrow">{t("marketing.categories.eyebrow")}</span>
            <h2>{t("marketing.categories.heading")}</h2>
            <p>{t("marketing.categories.subheading")}</p>
          </div>
          <div className="rk__cat-grid">
            {CATEGORY_IMAGES.map((item) => (
              <div className="rk__cat-item" key={item.key}>
                <img src={`/images/photo-sets/${item.file}`} alt={t(`marketing.categories.items.${item.key}`)} loading="lazy" />
                <span>{t(`marketing.categories.items.${item.key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------- how it works --------------------------- */}
      <section className="rk__section rk__section--soft" id="how-it-works">
        <div className="rk__container">
          <div className="rk__section-head">
            <span className="rk__eyebrow">{t("marketing.howItWorks.eyebrow")}</span>
            <h2>{t("marketing.howItWorks.heading")}</h2>
            <p>{t("marketing.howItWorks.subheading")}</p>
          </div>
          <div className="rk__steps">
            {steps.map((step, i) => (
              <div className="rk__step" key={step.title}>
                <span className="rk__step-num">{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------- comparison ---------------------------- */}
      <section className="rk__section">
        <div className="rk__container">
          <div className="rk__section-head">
            <span className="rk__eyebrow">{t("marketing.compare.eyebrow")}</span>
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

      {/* ---------------------------- pricing ------------------------------ */}
      <section className="rk__section" id="pricing">
        <div className="rk__container">
          <div className="rk__section-head">
            <span className="rk__eyebrow">{t("marketing.pricing.eyebrow")}</span>
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
                      <IconCheck />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href={APP_URL}
                  className={`rk__btn rk__btn--block ${plan.highlight ? "rk__btn--primary" : "rk__btn--ghost"}`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------ faq -------------------------------- */}
      <section className="rk__section rk__section--light" id="faq">
        <div className="rk__container">
          <div className="rk__section-head">
            <span className="rk__eyebrow">{t("marketing.faq.eyebrow")}</span>
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

      {/* --------------------------- final cta ------------------------------ */}
      <section className="rk__section">
        <div className="rk__container">
          <div className="rk__cta">
            <div className="rk__cta-glow" />
            <h2>{t("marketing.finalCta.heading")}</h2>
            <p>{t("marketing.finalCta.subheading")}</p>
            <div className="rk__hero-actions">
              <a href={APP_URL} className="rk__btn rk__btn--primary">
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

      {/* ----------------------------- footer -------------------------------- */}
      <footer className="rk__footer">
        <div className="rk__container rk__footer-inner">
          <div>
            <a href="#top" className="rk__logo" style={{ marginBottom: "10px" }}>
              <LogoMark size={26} />
              Rankavio
            </a>
            <p className="rk__footer-copy" style={{ marginTop: "8px" }}>
              {t("marketing.footer.tagline")}
            </p>
          </div>
          <ul className="rk__footer-links">
            <li><a href="#features">{t("marketing.footer.links.features")}</a></li>
            <li><a href="#pricing">{t("marketing.footer.links.pricing")}</a></li>
            <li><a href="#faq">{t("marketing.footer.links.faq")}</a></li>
            <li><a href={APP_URL}>{t("marketing.footer.links.app")}</a></li>
          </ul>
          <p className="rk__footer-copy">
            © {new Date().getFullYear()} Rankavio. {t("marketing.footer.copyright")}
          </p>
        </div>
      </footer>
    </div>
  );
}
