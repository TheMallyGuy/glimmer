import { Locales, type IntlayerConfig } from "intlayer";

const config: IntlayerConfig = {
  internationalization: {
    locales: [Locales.ENGLISH, Locales.VIETNAMESE],
    defaultLocale: Locales.ENGLISH,
  },
  editor: {
    enabled: true,
    clientId: process.env.INTLAYER_CLIENT_ID,
    clientSecret: process.env.INTLAYER_CLIENT_SECRET,
    applicationURL: "http://127.0.0.1:1420",
    cmsURL: "https://app.intlayer.org",
  },
  content: {
    contentDir: ["./src/lib/translations"],
  },
};

export default config;
