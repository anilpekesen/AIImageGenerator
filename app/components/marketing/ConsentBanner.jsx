import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const CONSENT_KEY = "rankavio_cookie_consent";

function updateAnalyticsConsent(value) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  window.gtag("consent", "update", {
    analytics_storage: value === "accepted" ? "granted" : "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });

  if (value === "accepted") {
    window.gtag("config", "G-BW8FN5HVNT");
  }
}

export default function ConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const savedConsent = window.localStorage.getItem(CONSENT_KEY);
      setVisible(!savedConsent);
    } catch {
      setVisible(true);
    }
  }, []);

  const saveConsent = (value) => {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // Continue with the in-memory state when storage is unavailable.
    }
    updateAnalyticsConsent(value);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside className="rk-consent" aria-label={t("marketing.consent.ariaLabel")}>
      <div className="rk-consent__copy">
        <strong>{t("marketing.consent.title")}</strong>
        <p>
          {t("marketing.consent.body")}{" "}
          <a href="/privacy-policy">{t("marketing.consent.privacyLink")}</a>
        </p>
      </div>
      <div className="rk-consent__actions">
        <button
          type="button"
          className="rk-consent__button rk-consent__button--secondary"
          onClick={() => saveConsent("declined")}
        >
          {t("marketing.consent.decline")}
        </button>
        <button
          type="button"
          className="rk-consent__button rk-consent__button--primary"
          onClick={() => saveConsent("accepted")}
        >
          {t("marketing.consent.accept")}
        </button>
      </div>
    </aside>
  );
}
