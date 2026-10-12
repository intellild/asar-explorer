import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocalePreference } from "~/i18n/useLocalePreference";
import { Button } from "./ui/button";

export function NotFound({ children }: { children?: ReactNode }) {
  const { t } = useTranslation();
  useLocalePreference();
  return (
    <div className="preview-message">
      {children || <p>{t("common.notFound")}</p>}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.history.back()}>
          {t("common.back")}
        </Button>
        <Button asChild>
          <Link to="/">{t("common.home")}</Link>
        </Button>
      </div>
    </div>
  );
}
