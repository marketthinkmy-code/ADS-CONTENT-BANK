export type ContentFormat = "Video" | "Single Image" | "Carousel" | "Unknown";

export type FunnelStage =
  | "Awareness"
  | "Consideration"
  | "Conversion"
  | "Retention";

export type CompetitorName =
  | "Alex Hormozi"
  | "Dan Henry"
  | "PengJoon"
  | "Reeve Yew";

export type Competitor = {
  name: CompetitorName;
  pageId: string;
  activeStatus: "ACTIVE" | "ALL";
};

export type MetaAd = {
  id: string;
  page_id?: string | number;
  page_name?: string;
  ad_creation_time?: string | number;
  ad_delivery_start_time?: string | number;
  ad_delivery_stop_time?: string | number;
  ad_snapshot_url?: string;
  publisher_platforms?: string[];
  ad_creative_bodies?: string[];
  ad_creative_link_captions?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_titles?: string[];
  currency?: string;
  [key: string]: unknown;
};

export type NormalizedAd = {
  id: string;
  pageId: string;
  pageName: string;
  competitor: CompetitorName;
  title: string;
  body: string;
  description: string;
  caption: string;
  snapshotUrl: string;
  platforms: string[];
  firstSeen: string | null;
  lastSeen: string | null;
  raw: MetaAd;
};

export type GeneratedIdea = {
  sourceAdId: string;
  contentFormat: ContentFormat;
  hook: string;
  coreAngle: string;
  creativeSignal: string;
  microSegment: string;
  funnelStage: FunnelStage;
  contentIdea: string;
  imagePrompt: string;
  signalScore: number;
};

export type IdeaRecord = GeneratedIdea & {
  libraryId: string;
  name: string;
  competitor: CompetitorName;
  pageId: string;
  pageName: string;
  sourceAdUrl: string;
  platforms: string[];
  firstSeen: string | null;
  lastSeen: string | null;
  generatedAt: string;
  rawAdJson: string;
};

export type PipelineResult = {
  ok: boolean;
  dryRun: boolean;
  fetchedAds: number;
  generatedIdeas: number;
  createdPages: number;
  skippedDuplicates: number;
  warnings: string[];
  sample: IdeaRecord[];
};
