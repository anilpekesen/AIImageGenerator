import { useTranslation } from "react-i18next";
import { LogoMark } from "./icons";
import { BLOG_POSTS } from "../../content/blog-posts";

export default function BlogIndex() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("en") ? "en" : "tr";

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

      <main className="rk__blog-page">
        <div className="rk__container">
          <div className="rk__blog-head">
            <p className="rk__section-label">{t("blog.index.eyebrow")}</p>
            <h1>{t("blog.index.heading")}</h1>
            <p>{t("blog.index.subheading")}</p>
          </div>

          <div className="rk__blog-list">
            {BLOG_POSTS.map((post) => {
              const content = post[lang];
              return (
                <article className="rk__blog-card" key={post.slug}>
                  <a href={`/blog/${post.slug}`}>
                    <img src={post.coverImage} alt={content.title} loading="lazy" />
                  </a>
                  <div className="rk__blog-card-body">
                    <span className="rk__blog-date">{post.publishedAt}</span>
                    <h2>
                      <a href={`/blog/${post.slug}`}>{content.title}</a>
                    </h2>
                    <p>{content.excerpt}</p>
                    <a className="rk__blog-card-link" href={`/blog/${post.slug}`}>
                      {t("blog.index.readMore")} →
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
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
