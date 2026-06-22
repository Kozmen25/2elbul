import "server-only";

import type {
  SourceConnector,
  SourceIntegrationConfig,
} from "@/lib/bots/types";
import { parseEasyCepProductPage } from "@/lib/bots/adapters/easycep";
import { parseGetmobilProductPage } from "@/lib/bots/adapters/getmobil";

const integrationReadySlugs = new Set([
  "easycep",
  "getmobil",
  "yenilenmis-market",
  "teknosa-yenilenmis",
  "hepsiburada-yenilenmis",
  "mediamarkt-yenilenmis",
]);

export function getSourceConnector(
  config: SourceIntegrationConfig,
): SourceConnector {
  const supportedModes = [
    ...(config.apiUrl ? (["api"] as const) : []),
    ...(config.scrapeUrl ? (["scrape"] as const) : []),
  ];

  return {
    slug: config.sourceSlug,
    supportedModes,
    parseProductPage:
      config.sourceSlug === "easycep"
        ? parseEasyCepProductPage
        : config.sourceSlug === "getmobil"
          ? parseGetmobilProductPage
          : undefined,
    async fetchListings() {
      if (!integrationReadySlugs.has(config.sourceSlug)) {
        throw new Error(
          `${config.sourceName} için gerçek veri connector'ı henüz uygulanmadı.`,
        );
      }
      if (supportedModes.length === 0) {
        throw new Error(
          `${config.sourceName} için API veya scrape adresi tanımlanmalı.`,
        );
      }

      throw new Error(
        `${config.sourceName} connector iskeleti hazır; sağlayıcı kimlik doğrulaması ve veri eşlemesi henüz yapılandırılmadı.`,
      );
    },
  };
}
