import { register, init, getLocaleFromNavigator } from "svelte-i18n";
import { resolveResource } from "@tauri-apps/api/path";
import { readTextFile } from "@tauri-apps/plugin-fs";


const locales = ["en"];

async function loadLocale(locale: string) {
  const path = await resolveResource(`resources/locales/${locale}/default.json`);
  const content = await readTextFile(path);
  return JSON.parse(content);
}

export function setupI18n() {
  for (const locale of locales) {
    register(locale, () => loadLocale(locale));
  }

  return init({
    fallbackLocale: "en",
    initialLocale: getLocaleFromNavigator() ?? "en",
  });
}
