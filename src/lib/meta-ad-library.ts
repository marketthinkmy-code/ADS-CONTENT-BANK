import type { Competitor, MetaAd, NormalizedAd } from "./types";
import { getCountries, getRequiredEnv } from "./env";
import { toIsoDate } from "./date";

const META_FIELDS = [
  "id",
  "page_id",
  "page_name",
  "ad_creation_time",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "ad_snapshot_url",
  "publisher_platforms",
  "ad_creative_bodies",
  "ad_creative_link_captions",
  "ad_creative_link_descriptions",
  "ad_creative_link_titles",
  "currency"
].join(",");

type MetaArchiveResponse = {
  data?: MetaAd[];
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

export async function fetchCompetitorAds(
  competitor: Competitor,
  limit: number
): Promise<NormalizedAd[]> {
  const accessToken = getRequiredEnv("META_ACCESS_TOKEN");
  const graphVersion = process.env.META_GRAPH_VERSION ?? "v23.0";
  const countries = getCountries();
  const url = new URL(`https://graph.facebook.com/${graphVersion}/ads_archive`);

  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("ad_type", "ALL");
  url.searchParams.set("ad_active_status", competitor.activeStatus);
  url.searchParams.set("ad_reached_countries", JSON.stringify(countries));
  url.searchParams.set("search_page_ids", JSON.stringify([competitor.pageId]));
  url.searchParams.set("fields", META_FIELDS);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as MetaArchiveResponse;

  if (!response.ok || payload.error) {
    throw new Error(
      `Meta Ad Library error for ${competitor.name}: ${
        payload.error?.message ?? response.statusText
      }`
    );
  }

  return (payload.data ?? []).map((ad) => normalizeAd(ad, competitor));
}

function normalizeAd(ad: MetaAd, competitor: Competitor): NormalizedAd {
  const title = firstText(ad.ad_creative_link_titles);
  const body = firstText(ad.ad_creative_bodies);
  const description = firstText(ad.ad_creative_link_descriptions);
  const caption = firstText(ad.ad_creative_link_captions);

  return {
    id: ad.id,
    pageId: String(ad.page_id ?? competitor.pageId),
    pageName: ad.page_name ?? competitor.name,
    competitor: competitor.name,
    title,
    body,
    description,
    caption,
    snapshotUrl: ad.ad_snapshot_url ?? "",
    platforms: mapPlatforms(ad.publisher_platforms),
    firstSeen: toIsoDate(ad.ad_delivery_start_time ?? ad.ad_creation_time),
    lastSeen: toIsoDate(ad.ad_delivery_stop_time) ?? null,
    raw: ad
  };
}

function firstText(values?: string[]): string {
  return values?.find((value) => value.trim().length > 0)?.trim() ?? "";
}

function mapPlatforms(values?: string[]): string[] {
  if (!values?.length) {
    return ["Unknown"];
  }

  const mapped = values.map((value) => {
    const normalized = value.toLowerCase();
    if (normalized.includes("facebook")) return "Facebook";
    if (normalized.includes("instagram")) return "Instagram";
    if (normalized.includes("messenger")) return "Messenger";
    if (normalized.includes("audience")) return "Audience Network";
    return "Unknown";
  });

  return Array.from(new Set(mapped));
}
