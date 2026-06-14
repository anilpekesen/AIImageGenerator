import { useTranslation } from "react-i18next";
import { LogoMark } from "./icons";

export default function BlogPost({ post }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("en") ? "en" : "tr";
  const content = post[lang];

  return (
    <div className="rk">
      <header className="rk__nav">
        <div className="rk__container rk__nav-inner">
          <a href="/" className="rk__logo" aria-label="Rankavio">
            <LogoMark />
            Rankavio
          </a>
          <div className="rk__nav-right">
            <div className="rk__lang-toggle" aria-label="Language">
              <a href="?lng=tr" className={lang === "tr" ? "is-active" : ""}>TR</a>
              <a href="?lng=en" className={lang === "en" ? "is-active" : ""}>EN</a>
            </div>
            <a href="/" className="rk__btn rk__btn--ghost rk__btn--sm">
              {t("legal.backToHome")}
            </a>
          </div>
        </div>
      </header>

      <main className="rk__legal-page">
        <div className="rk__container rk__legal">
          <a className="rk__blog-back" href="/blog">{t("blog.post.backToBlog")}</a>
          <img className="rk__blog-cover" src={post.coverImage} alt={content.title} />
          <h1>{content.title}</h1>
          <p className="rk__legal-updated">{post.publishedAt}</p>

          {content.sections.map((section, index) => (
            <section key={index}>
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph, pIndex) => (
                <p key={pIndex}>{paragraph}</p>
              ))}
              {section.items && (
                <ul>
                  {section.items.map((item, iIndex) => (
                    <li key={iIndex}>{item}</li>
                  ))}
                </ul>
              )}
              {section.closingParagraphs?.map((paragraph, pIndex) => (
                <p key={`closing-${pIndex}`}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </main>

      <footer className="rk__footer">
        <div className="rk__container rk__footer-inner">
          <div>
            <a href="/" className="rk__logo">
              <LogoMark size={26} />
              Rankavio
            </a>
            <p className="rk__footer-copy">{t("marketing.footer.tagline")}</p>
          </div>
          <ul className="rk__footer-links">
            <li><a href="/#features">{t("marketing.footer.links.features")}</a></li>
            <li><a href="/#pricing">{t("marketing.footer.links.pricing")}</a></li>
            <li><a href="/#faq">{t("marketing.footer.links.faq")}</a></li>
            <li><a href="/blog">{t("marketing.footer.links.blog")}</a></li>
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
