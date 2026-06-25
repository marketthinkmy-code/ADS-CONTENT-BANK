import type {
  Competitor,
  ContentFormat,
  CreativeType,
  NormalizedAd,
  RawAd
} from "./types";
import { getBooleanEnv } from "./env";
import { toIsoDate } from "./date";

type ScraperRequest = {
  provider: string;
  url: string;
  pageId: string;
  pageName: string;
  activeStatus: "ACTIVE" | "ALL";
  limit: number;
};

const ARRAY_KEYS = [
  "ads",
  "data",
  "results",
  "items",
  "adLibraryResults",
  "ad_library_results"
];

export async function fetchCompetitorAds(
  competitor: Competitor,
  limit: number
): Promise<NormalizedAd[]> {
  const provider = process.env.SCRAPER_PROVIDER ?? "generic";

  if (provider === "fixture" || getBooleanEnv("USE_FIXTURE_ADS", false)) {
    return fixtureAds(competitor, limit).map((ad, index) =>
      normalizeAd(ad, competitor, index)
    );
  }

  const scraperUrl = process.env.SCRAPER_API_URL;
  if (!scraperUrl) {
    throw new Error(
      [
        `Ads Library scraper is not configured for ${competitor.name}.`,
        "Add SCRAPER_API_URL in Vercel",
        "and SCRAPER_API_KEY if your scraper service requires one."
      ].join(" ")
    );
  }

  const payload = await callScraper(scraperUrl, {
    provider,
    url: competitor.libraryUrl,
    pageId: competitor.pageId,
    pageName: competitor.name,
    activeStatus: competitor.activeStatus,
    limit
  });
  const rawAds = extractAds(payload).slice(0, limit);

  return rawAds.map((ad, index) => normalizeAd(ad, competitor, index));
}

async function callScraper(
  scraperUrl: string,
  request: ScraperRequest
): Promise<unknown> {
  const headers: HeadersInit = {
    "Content-Type": "application/json"
  };
  const apiKey = process.env.SCRAPER_API_KEY;

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["x-api-key"] = apiKey;
  }

  const response = await fetch(scraperUrl, {
    method: "POST",
    cache: "no-store",
    headers,
    body: JSON.stringify(request)
  });
  const text = await response.text();
  const payload = parseJson(text);

  if (!response.ok) {
    const message =
      readText(payload, ["error", "message", "detail"]) || response.statusText;
    throw new Error(`Ads Library scraper failed: ${message}`);
  }

  return payload;
}

function extractAds(payload: unknown, depth = 0): RawAd[] {
  if (depth > 4) {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  for (const key of ARRAY_KEYS) {
    const value = payload[key];
    const ads = extractAds(value, depth + 1);
    if (ads.length) {
      return ads;
    }
  }

  for (const value of Object.values(payload)) {
    const ads = extractAds(value, depth + 1);
    if (ads.length) {
      return ads;
    }
  }

  return [];
}

function normalizeAd(
  ad: RawAd,
  competitor: Competitor,
  index: number
): NormalizedAd {
  const title = readText(ad, [
    "title",
    "headline",
    "ad_creative_link_titles",
    "ad_creative_link_title",
    "adCreativeLinkTitles",
    "adCreativeLinkTitle"
  ]);
  const body = readText(ad, [
    "body",
    "text",
    "copy",
    "message",
    "primaryText",
    "ad_creative_bodies",
    "ad_creative_body",
    "adCreativeBodies",
    "adCreativeBody"
  ]);
  const description = readText(ad, [
    "description",
    "ad_creative_link_descriptions",
    "ad_creative_link_description",
    "adCreativeLinkDescriptions",
    "adCreativeLinkDescription"
  ]);
  const caption = readText(ad, [
    "caption",
    "linkCaption",
    "ad_creative_link_captions",
    "ad_creative_link_caption",
    "adCreativeLinkCaptions",
    "adCreativeLinkCaption"
  ]);
  const id =
    readText(ad, [
      "id",
      "library_id",
      "libraryId",
      "archive_id",
      "archiveId",
      "adArchiveId"
    ]) || fallbackId(competitor, ad, index);
  const sourceFormat = readSourceFormat(ad);
  const snapshotUrl =
    readUrl(ad, [
      "ad_snapshot_url",
      "adSnapshotUrl",
      "snapshotUrl",
      "sourceAdUrl",
      "source_ad_url",
      "libraryAdUrl",
      "library_ad_url",
      "adLibraryUrl",
      "ad_library_url"
    ]) ||
    adLibraryUrlFromId(id) ||
    competitor.libraryUrl;

  return {
    id,
    pageId:
      readText(ad, ["page_id", "pageId", "pageID"]) || competitor.pageId,
    pageName:
      readText(ad, ["page_name", "pageName", "pageTitle"]) || competitor.name,
    competitor: competitor.name,
    sourceFormat,
    creativeType: toCreativeType(sourceFormat),
    title,
    body,
    description,
    caption,
    snapshotUrl,
    creativeMediaUrl: readCreativeMediaUrl(ad),
    ctaButton: humanizeCta(
      readText(ad, [
        "cta_text",
        "ctaText",
        "ctaButton",
        "buttonText",
        "callToActionText",
        "call_to_action_text",
        "cta",
        "call_to_action",
        "callToAction"
      ])
    ),
    ctaLink: readUrl(ad, [
      "cta_link",
      "ctaLink",
      "callToActionUrl",
      "call_to_action_url",
      "link_url",
      "linkUrl",
      "destination_url",
      "destinationUrl",
      "landingPageUrl",
      "website_url",
      "websiteUrl"
    ]),
    videoScript: readText(ad, [
      "videoScript",
      "video_script",
      "transcript",
      "videoTranscript",
      "video_transcript",
      "transcription",
      "spokenText",
      "spoken_text",
      "voiceover",
      "subtitles",
      "video_captions"
    ]),
    platforms: readPlatforms(ad),
    firstSeen: readDate(ad, [
      "ad_delivery_start_time",
      "adDeliveryStartTime",
      "startDate",
      "startedAt",
      "firstSeen",
      "createdAt",
      "ad_creation_time"
    ]),
    raw: {
      ...ad,
      source_ad_library_url: competitor.libraryUrl,
      normalized_by: "ads-content-bank-scraper-v1"
    }
  };
}

function readText(payload: unknown, keys: string[]): string {
  if (!isRecord(payload)) {
    return "";
  }

  for (const key of keys) {
    const value = payload[key];
    const text = valueToText(value);
    if (text) {
      return text;
    }
  }

  return "";
}

function readUrl(payload: unknown, keys: string[]): string {
  if (!isRecord(payload)) {
    return "";
  }

  for (const key of keys) {
    const url = valueToUrl(payload[key]);
    if (url) {
      return url;
    }
  }

  return "";
}

function valueToText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = valueToText(item);
      if (text) {
        return text;
      }
    }
  }
  if (isRecord(value)) {
    return readText(value, [
      "text",
      "content",
      "value",
      "name",
      "label",
      "title",
      "type"
    ]);
  }

  return "";
}

function valueToUrl(value: unknown): string {
  if (typeof value === "string") {
    return normalizeUrl(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = valueToUrl(item);
      if (url) {
        return url;
      }
    }
  }
  if (isRecord(value)) {
    return readUrl(value, [
      "url",
      "src",
      "source",
      "href",
      "downloadUrl",
      "download_url",
      "mediaUrl",
      "media_url",
      "videoUrl",
      "video_url",
      "imageUrl",
      "image_url"
    ]);
  }

  return "";
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : "";
}

function readDate(payload: RawAd, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" || typeof value === "number") {
      const date = toIsoDate(value);
      if (date) {
        return date;
      }
    }
  }

  return null;
}

function readPlatforms(payload: RawAd): string[] {
  const value =
    payload.publisher_platforms ??
    payload.publisherPlatforms ??
    payload.platforms ??
    payload.publisher_platform ??
    payload.platform;

  if (Array.isArray(value)) {
    const platforms = value.map(valueToText).map(mapPlatform).filter(Boolean);
    return Array.from(new Set(platforms));
  }

  const text = valueToText(value);
  if (!text) {
    return ["Unknown"];
  }

  return Array.from(
    new Set(
      text
        .split(/[,|/]/)
        .map((item) => mapPlatform(item))
        .filter(Boolean)
    )
  );
}

function readSourceFormat(payload: RawAd): ContentFormat {
  const explicit = readText(payload, [
    "media_type",
    "mediaType",
    "format",
    "type",
    "adFormat",
    "creativeFormat"
  ]).toLowerCase();

  if (explicit.includes("carousel")) {
    return "Carousel";
  }
  if (explicit.includes("video")) {
    return "Video";
  }
  if (
    explicit.includes("image") ||
    explicit.includes("photo") ||
    explicit.includes("picture")
  ) {
    return "Single Image";
  }

  if (
    payload.video_url ||
    payload.videoUrl ||
    payload.videos ||
    payload.video
  ) {
    return "Video";
  }
  if (
    payload.image_url ||
    payload.imageUrl ||
    payload.images ||
    payload.image
  ) {
    return "Single Image";
  }

  const mediaUrl = readCreativeMediaUrl(payload).toLowerCase();
  if (mediaUrl.match(/\.(mp4|mov|webm|m3u8)(\?|$)/)) {
    return "Video";
  }
  if (mediaUrl.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/)) {
    return "Single Image";
  }

  return "Unknown";
}

function readCreativeMediaUrl(payload: RawAd): string {
  return readUrl(payload, [
    "downloadedMediaUrl",
    "downloaded_media_url",
    "creativeMediaUrl",
    "creative_media_url",
    "video_url",
    "videoUrl",
    "videoHdUrl",
    "video_hd_url",
    "videoSdUrl",
    "video_sd_url",
    "video",
    "videos",
    "mediaUrl",
    "media_url",
    "media",
    "image_url",
    "imageUrl",
    "image",
    "images",
    "thumbnail_url",
    "thumbnailUrl"
  ]);
}

function toCreativeType(format: ContentFormat): CreativeType {
  if (format === "Video") return "Video";
  if (format === "Single Image") return "Image";
  if (format === "Carousel") return "Carousel";
  return "Unknown";
}

function adLibraryUrlFromId(id: string): string {
  if (!id || id.includes(":")) {
    return "";
  }

  return `https://www.facebook.com/ads/library/?id=${encodeURIComponent(id)}`;
}

function humanizeCta(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function mapPlatform(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("facebook")) return "Facebook";
  if (normalized.includes("instagram")) return "Instagram";
  if (normalized.includes("messenger")) return "Messenger";
  if (normalized.includes("audience")) return "Audience Network";
  if (normalized.includes("threads")) return "Threads";
  return value.trim() || "Unknown";
}

function parseJson(text: string): unknown {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function fallbackId(
  competitor: Competitor,
  ad: RawAd,
  index: number
): string {
  const seed = JSON.stringify([competitor.pageId, index, ad]).slice(0, 5000);
  let hash = 0;

  for (let cursor = 0; cursor < seed.length; cursor += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(cursor);
    hash |= 0;
  }

  return `${competitor.pageId}:${Math.abs(hash).toString(36)}:${index}`;
}

function fixtureAds(competitor: Competitor, limit: number): RawAd[] {
  return Array.from({ length: limit }, (_, index) => ({
    id: `${competitor.pageId}:fixture:${index + 1}`,
    page_id: competitor.pageId,
    page_name: competitor.name,
    ad_snapshot_url: competitor.libraryUrl,
    image_url: "https://placehold.co/1200x628/png?text=Fixture+Creative",
    publisher_platforms: ["facebook", "instagram"],
    ad_delivery_start_time: new Date().toISOString(),
    cta_text: "Learn More",
    cta_link: competitor.libraryUrl,
    video_script:
      "Fixture script only. Connect the cloud scraper to capture the real video script or transcript.",
    ad_creative_link_titles: [
      `${competitor.name} scaled angle sample ${index + 1}`
    ],
    ad_creative_bodies: [
      "Fixture ad used only for pipeline testing when USE_FIXTURE_ADS=true."
    ],
    ad_creative_link_descriptions: [
      "Connect a cloud scraper to replace this fixture with live Ads Library creatives."
    ]
  }));
}

function isRecord(value: unknown): value is RawAd {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
