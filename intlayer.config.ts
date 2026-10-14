import { Locales, type IntlayerConfig } from "intlayer";

const config: IntlayerConfig = {
  internationalization: {
    locales: [Locales.ENGLISH],
    defaultLocale: Locales.ENGLISH,
  },
  editor: {
    enabled: true,
    applicationURL: "http://127.0.0.1:1420",
  },
  content: {
    contentDir: ["./src/lib/translations"],
  },
};

export default config;
