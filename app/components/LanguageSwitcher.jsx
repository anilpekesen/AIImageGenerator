import { useFetcher } from "@remix-run/react";
import { ButtonGroup, Button } from "@shopify/polaris";
import { useTranslation } from "react-i18next";

const LANGUAGES = ["tr", "en"];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const fetcher = useFetcher();

  const setLanguage = (lng) => {
    if (lng === i18n.language) return;
    fetcher.submit({ locale: lng }, { method: "post", action: "/app/set-locale" });
  };

  return (
    <ButtonGroup variant="segmented">
      {LANGUAGES.map((lng) => (
        <Button
          key={lng}
          size="slim"
          pressed={i18n.language === lng}
          onClick={() => setLanguage(lng)}
        >
          {lng.toUpperCase()}
        </Button>
      ))}
    </ButtonGroup>
  );
}
