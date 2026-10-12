import {
  Link,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useLocalePreference } from "~/i18n/useLocalePreference";
import { Button } from "./ui/button";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  const { t } = useTranslation();
  useLocalePreference();
  console.error("DefaultCatchBoundary Error:", error);
  return (
    <div className="preview-message" role="alert">
      <p>{t("common.unexpectedError")}</p>
      <div className="flex gap-2">
        <Button onClick={() => void router.invalidate()}>
          {t("common.retry")}
        </Button>
        <Button variant="outline" asChild>
          <Link to="/">{t("common.home")}</Link>
        </Button>
      </div>
    </div>
  );
}
