import { useTranslation } from "react-i18next";
import { supportedLanguage } from "~/i18n";

export function LanguageSelect() {
  const { t, i18n } = useTranslation();
  return (
    <select
      className="language-select"
      aria-label={t("common.language")}
      value={i18n.resolvedLanguage ?? "zh-CN"}
      onChange={(event) => {
        const language = supportedLanguage(event.target.value);
        if (language) void i18n.changeLanguage(language);
      }}
    >
      <option value="zh-CN">{t("common.chinese")}</option>
      <option value="en">{t("common.english")}</option>
    </select>
  );
}
