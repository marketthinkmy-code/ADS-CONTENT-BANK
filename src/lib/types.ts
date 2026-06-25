export type ContentFormat = "Video" | "Single Image" | "Carousel" | "Unknown";

export type CreativeType = "Video" | "Image" | "Carousel" | "Unknown";

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
  libraryUrl: string;
};

export type RawAd = Record<string, unknown>;

export type NormalizedAd = {
  id: string;
  pageId: string;
  pageName: string;
  competitor: CompetitorName;
  sourceFormat: ContentFormat;
  creativeType: CreativeType;
  title: string;
  body: string;
  description: string;
  caption: string;
  snapshotUrl: string;
  creativeMediaUrl: string;
  ctaButton: string;
  ctaLink: string;
  videoScript: string;
  platforms: string[];
  firstSeen: string | null;
  raw: RawAd;
};

export type GeneratedIdea = {
  sourceAdId: string;
  contentFormat: ContentFormat;
  hook: string;
  coreAngle: string;
  creativeSignal: string;
  targetAudience: string;
  underlyingLogic: string;
  winningFramework: string;
  microSegment: string;
  funnelStage: FunnelStage;
  contentIdea: string;
  imagePrompt: string;
  videoScript: string;
  signalScore: number;
};

export type IdeaRecord = GeneratedIdea & {
  libraryId: string;
  name: string;
  competitor: CompetitorName;
  pageId: string;
  pageName: string;
  sourceAdUrl: string;
  sourceHeadline: string;
  sourceCaptions: string;
  creativeType: CreativeType;
  creativeMediaUrl: string;
  ctaButton: string;
  ctaLink: string;
  videoScript: string;
  useThisCreativeAndText: boolean;
  platforms: string[];
  firstSeen: string | null;
  generatedAt: string;
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
