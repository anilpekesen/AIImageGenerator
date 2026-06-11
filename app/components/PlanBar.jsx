import { useNavigate } from "@remix-run/react";
import { Badge, Box, Button, InlineStack, ProgressBar, Text } from "@shopify/polaris";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

const PLAN_TONE = {
  free: "info",
  solo: "attention",
  pro: "success",
  premium: "magic",
};

export default function PlanBar({ subscription }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const plan = subscription?.plan || "free";
  const used = subscription?.usedCount ?? 0;
  const limit = subscription?.limitCount || 1;
  const progress = Math.min(100, Math.round((used / limit) * 100));

  return (
    <Box
      background="bg-surface"
      borderBlockEndWidth="025"
      borderColor="border"
      paddingBlock="200"
      paddingInline="400"
    >
      <InlineStack align="space-between" blockAlign="center" gap="400" wrap={false}>
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <Badge tone={PLAN_TONE[plan] || "info"}>{t(`billing.plans.${plan}.name`)}</Badge>
          <Box minWidth="120px" maxWidth="160px" width="100%">
            <ProgressBar
              progress={progress}
              size="small"
              tone={progress >= 90 ? "critical" : "primary"}
            />
          </Box>
          <Text as="span" variant="bodySm" tone="subdued">
            {t("planBar.usage", { used, limit })}
          </Text>
        </InlineStack>
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <LanguageSwitcher />
          <Button size="slim" onClick={() => navigate("/app/billing")}>
            {t("planBar.manage")}
          </Button>
        </InlineStack>
      </InlineStack>
    </Box>
  );
}
