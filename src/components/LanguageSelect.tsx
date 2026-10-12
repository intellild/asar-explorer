import { useTranslation } from "react-i18next";
import { supportedLanguage } from "~/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export function LanguageSelect() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "zh-CN";
  return (
    <Select
      value={language}
      onValueChange={(value) => {
        const next = supportedLanguage(value);
        if (next) void i18n.changeLanguage(next);
      }}
    >
      <SelectTrigger
        className="language-select"
        aria-label={t("common.language")}
      >
        <SelectValue>
          {t(language === "en" ? "common.english" : "common.chinese")}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        <SelectItem value="zh-CN">{t("common.chinese")}</SelectItem>
        <SelectItem value="en">{t("common.english")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
