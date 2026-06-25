import type { IdeaRecord } from "./types";
import { getRequiredEnv } from "./env";

type NotionQueryResponse = {
  results?: Array<{ id: string }>;
  error?: {
    message?: string;
  };
};

type NotionCreateResponse = {
  id?: string;
  url?: string;
  error?: {
    message?: string;
  };
};

export async function ideaExists(libraryId: string): Promise<boolean> {
  const databaseId = getRequiredEnv("NOTION_DATABASE_ID");
  const payload = await notionFetch<NotionQueryResponse>(
    `/databases/${databaseId}/query`,
    {
      method: "POST",
      body: JSON.stringify({
        filter: {
          property: "Library ID",
          rich_text: {
            equals: libraryId
          }
        },
        page_size: 1
      })
    }
  );

  return Boolean(payload.results?.length);
}

export async function createIdeaPage(record: IdeaRecord): Promise<string> {
  const databaseId = getRequiredEnv("NOTION_DATABASE_ID");
  const payload = await notionFetch<NotionCreateResponse>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: toNotionProperties(record),
      children: [
        paragraph(`Source ad: ${record.sourceAdUrl}`),
        paragraph(`Headline: ${record.sourceHeadline}`),
        paragraph(`Captions: ${record.sourceCaptions}`),
        paragraph(`Creative media: ${record.creativeMediaUrl || "Not provided by scraper."}`),
        paragraph(`CTA: ${record.ctaButton || "Unknown"} ${record.ctaLink || ""}`),
        paragraph(`Video script: ${record.videoScript || "Not provided by scraper or generator."}`),
        paragraph(`Target audience: ${record.targetAudience}`),
        paragraph(`Content angle: ${record.coreAngle}`),
        paragraph(`Hook: ${record.hook}`),
        paragraph(`Creative signal: ${record.creativeSignal}`),
        paragraph(`Underlying logic: ${record.underlyingLogic}`),
        paragraph(`Reusable framework: ${record.winningFramework}`),
        paragraph(`Execution idea: ${record.contentIdea}`),
        paragraph(`Image prompt: ${record.imagePrompt}`)
      ]
    })
  });

  return payload.url ?? payload.id ?? record.libraryId;
}

async function notionFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getRequiredEnv("NOTION_API_KEY")}`,
      "Content-Type": "application/json",
      "Notion-Version": process.env.NOTION_VERSION ?? "2022-06-28",
      ...(init.headers ?? {})
    }
  });

  const payload = (await response.json()) as T & {
    error?: { message?: string };
  };

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? response.statusText);
  }

  return payload;
}

function toNotionProperties(record: IdeaRecord) {
  return {
    Name: title(record.name),
    Status: select("New"),
    Competitor: select(record.competitor),
    "Content Format": select(record.contentFormat),
    "Creative Type": select(record.creativeType),
    Headline: richText(record.sourceHeadline),
    Captions: richText(record.sourceCaptions),
    "CTA Button": richText(record.ctaButton),
    "CTA Link": { url: record.ctaLink || null },
    "Creative Media URL": { url: record.creativeMediaUrl || null },
    "Creative Media": creativeFile(record),
    "Video Script": richText(record.videoScript, 5),
    "Use This Creative And Text": checkbox(record.useThisCreativeAndText),
    "Content Idea": richText(record.contentIdea),
    "Core Angle": richText(record.coreAngle),
    "Creative Signal": richText(record.creativeSignal),
    "Target Audience": richText(record.targetAudience),
    "Underlying Logic": richText(record.underlyingLogic),
    "Winning Framework": richText(record.winningFramework),
    "Funnel Stage": select(record.funnelStage),
    Hook: richText(record.hook),
    "Image Prompt": richText(record.imagePrompt),
    "Library ID": richText(record.libraryId),
    "Micro Segment": richText(record.microSegment),
    "Page ID": richText(record.pageId),
    "Page Name": richText(record.pageName),
    Platforms: {
      multi_select: record.platforms.map((name) => ({ name }))
    },
    "Signal Score": { number: record.signalScore },
    "Source Ad URL": { url: record.sourceAdUrl || null },
    "First Seen": record.firstSeen ? date(record.firstSeen) : emptyDate(),
    "Generated At": date(record.generatedAt)
  };
}

function title(content: string) {
  return {
    title: [{ type: "text", text: { content: truncate(content, 180) } }]
  };
}

function richText(content: string, maxChunks = 3) {
  return {
    rich_text: chunkText(content, 1900)
      .slice(0, maxChunks)
      .map((chunk) => ({ type: "text", text: { content: chunk } }))
  };
}

function select(name: string) {
  return { select: { name } };
}

function checkbox(checked: boolean) {
  return { checkbox: checked };
}

function creativeFile(record: IdeaRecord) {
  if (!record.creativeMediaUrl) {
    return { files: [] };
  }

  return {
    files: [
      {
        name: `${record.competitor} ${record.creativeType} creative`,
        type: "external",
        external: {
          url: record.creativeMediaUrl
        }
      }
    ]
  };
}

function date(start: string) {
  return { date: { start } };
}

function emptyDate() {
  return { date: null };
}

function paragraph(content: string) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [{ type: "text", text: { content: truncate(content, 1900) } }]
    }
  };
}

function chunkText(content: string, size: number): string[] {
  const clean = content || "";
  const chunks: string[] = [];

  for (let index = 0; index < clean.length; index += size) {
    chunks.push(clean.slice(index, index + size));
  }

  return chunks.length ? chunks : [""];
}

function truncate(content: string, size: number): string {
  return content.length > size ? `${content.slice(0, size - 1)}…` : content;
}
