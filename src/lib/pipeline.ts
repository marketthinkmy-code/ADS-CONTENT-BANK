import { COMPETITORS } from "./competitors";
import { todayIso } from "./date";
import { getBooleanEnv, getNumberEnv } from "./env";
import { fetchCompetitorAds } from "./ad-library-scraper";
import { createIdeaPage, ideaExists } from "./notion";
import { generateIdeasForAds } from "./openai-ideas";
import type {
  GeneratedIdea,
  IdeaRecord,
  NormalizedAd,
  PipelineResult
} from "./types";

type RunOptions = {
  dryRun?: boolean;
  limit?: number;
};

export async function runAdsToNotionPipeline(
  options: RunOptions = {}
): Promise<PipelineResult> {
  const warnings: string[] = [];
  const dryRun = options.dryRun ?? getBooleanEnv("DRY_RUN", false);
  const limit = options.limit ?? getNumberEnv("MAX_ADS_PER_COMPETITOR", 3);
  const ideasPerAd = getNumberEnv("IDEAS_PER_AD", 2);
  const generatedAt = todayIso();

  let fetchedAds = 0;
  let createdPages = 0;
  let skippedDuplicates = 0;
  const records: IdeaRecord[] = [];

  for (const competitor of COMPETITORS) {
    let ads: NormalizedAd[] = [];

    try {
      ads = await fetchCompetitorAds(competitor, limit);
      fetchedAds += ads.length;
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? error.message
          : `Ads Library fetch failed: ${error}`
      );
      continue;
    }

    const generation = await generateIdeasForAds(ads, ideasPerAd);
    if (generation.warning) {
      warnings.push(`${competitor.name}: ${generation.warning}`);
    }

    const byAdId = new Map(ads.map((ad) => [ad.id, ad]));
    const competitorRecords = generation.ideas
      .map((idea) => {
        const ad = byAdId.get(idea.sourceAdId);
        return ad ? toRecord(ad, idea, generatedAt) : null;
      })
      .filter((record): record is IdeaRecord => Boolean(record));

    for (const record of competitorRecords) {
      records.push(record);

      if (dryRun) {
        continue;
      }

      if (await ideaExists(record.libraryId)) {
        skippedDuplicates += 1;
        continue;
      }

      await createIdeaPage(record);
      createdPages += 1;
    }
  }

  return {
    ok: warnings.length === 0,
    dryRun,
    fetchedAds,
    generatedIdeas: records.length,
    createdPages,
    skippedDuplicates,
    warnings,
    sample: records.slice(0, 6)
  };
}

function toRecord(
  ad: NormalizedAd,
  idea: GeneratedIdea,
  generatedAt: string
): IdeaRecord {
  const formatKey = idea.contentFormat.toLowerCase().replace(/\s+/g, "-");
  const segmentKey = slug(idea.microSegment).slice(0, 48);

  return {
    ...idea,
    libraryId: `${ad.id}:${formatKey}:${segmentKey}`,
    name: `${ad.competitor} - ${idea.contentFormat} - ${idea.hook.slice(
      0,
      64
    )}`,
    competitor: ad.competitor,
    pageId: ad.pageId,
    pageName: ad.pageName,
    sourceAdUrl: ad.snapshotUrl,
    sourceHeadline: ad.title,
    sourceCaptions: sourceCaptions(ad),
    creativeType: ad.creativeType,
    creativeMediaUrl: ad.creativeMediaUrl,
    ctaButton: ad.ctaButton,
    ctaLink: ad.ctaLink,
    videoScript: ad.videoScript || idea.videoScript,
    useThisCreativeAndText: Boolean(
      (ad.creativeMediaUrl || ad.videoScript) &&
        (ad.title || ad.body || ad.caption || ad.description)
    ),
    platforms: ad.platforms,
    firstSeen: ad.firstSeen,
    generatedAt
  };
}

function sourceCaptions(ad: NormalizedAd): string {
  return [ad.body, ad.caption, ad.description].filter(Boolean).join("\n\n");
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}
