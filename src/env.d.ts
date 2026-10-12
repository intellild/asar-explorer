/// <reference types="@rsbuild/core/types" />

interface ImportMetaEnv {
  readonly PUBLIC_BASE_PATH: string;
}

declare module "monaco-editor/basic-languages/monaco.contribution.js";
declare module "monaco-editor/language/json/monaco.contribution.js";

declare module "*.toml" {
  interface Translations {
    [key: string]: string | Translations;
  }
  const messages: Translations;
  export default messages;
}
