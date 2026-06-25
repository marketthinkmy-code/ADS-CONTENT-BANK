import type {
  ContentFormat,
  FunnelStage,
  GeneratedIdea,
  NormalizedAd
} from "./types";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

type IdeaSchema = {
  ideas: GeneratedIdea[];
};

const FORMATS: ContentFormat[] = ["Video", "Single Image"];
const FUNNELS: FunnelStage[] = [
  "Awareness",
  "Consideration",
  "Conversion",
  "Retention"
];

export async function generateIdeasForAds(
  ads: NormalizedAd[],
  ideasPerAd: number
): Promise<{ ideas: GeneratedIdea[]; warning?: string }> {
  if (!ads.length) {
    return { ideas: [] };
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      ideas: generateHeuristicIdeas(ads, ideasPerAd),
      warning: "OPENAI_API_KEY is missing; used heuristic fallback ideas."
    };
  }

  try {
    const ideas = await generateWithOpenAI(ads, ideasPerAd);
    return { ideas };
  } catch (error) {
    return {
      ideas: generateHeuristicIdeas(ads, ideasPerAd),
      warning: `OpenAI generation failed; used heuristic fallback. ${
        error instanceof Error ? error.message : String(error)
      }`
    };
  }
}

async function generateWithOpenAI(
  ads: NormalizedAd[],
  ideasPerAd: number
): Promise<GeneratedIdea[]> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are a senior direct-response creative strategist. Generate original ad content ideas in Chinese. Do not copy competitor wording. Use a direct, quantified, proof-driven Alex Hormozi-style framework: painful bottleneck, clear mechanism, proof/contrast, low-friction next step."
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "For each source ad, produce micro-segmented content ideas for video and single-image formats.",
            rules: [
              `Create ${ideasPerAd} ideas per source ad.`,
              "Prefer Video and Single Image formats.",
              "Creative Signal must explain what signal was detected from the source ad.",
              "Micro Segment must be specific enough to brief a creator.",
              "Image Prompt must be a prompt for generating a static ad image, not a video prompt.",
              "Use only these funnel stages: Awareness, Consideration, Conversion, Retention.",
              "Use only these content formats: Video, Single Image, Carousel, Unknown."
            ],
            sourceAds: ads.map((ad) => ({
              sourceAdId: ad.id,
              competitor: ad.competitor,
              pageName: ad.pageName,
              title: ad.title,
              body: ad.body,
              description: ad.description,
              caption: ad.caption,
              platforms: ad.platforms,
              firstSeen: ad.firstSeen,
              snapshotUrl: ad.snapshotUrl
            }))
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "ad_content_ideas",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["ideas"],
            properties: {
              ideas: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "sourceAdId",
                    "contentFormat",
                    "hook",
                    "coreAngle",
                    "creativeSignal",
                    "microSegment",
                    "funnelStage",
                    "contentIdea",
                    "imagePrompt",
                    "signalScore"
                  ],
                  properties: {
                    sourceAdId: { type: "string" },
                    contentFormat: {
                      type: "string",
                      enum: ["Video", "Single Image", "Carousel", "Unknown"]
                    },
                    hook: { type: "string" },
                    coreAngle: { type: "string" },
                    creativeSignal: { type: "string" },
                    microSegment: { type: "string" },
                    funnelStage: {
                      type: "string",
                      enum: [
                        "Awareness",
                        "Consideration",
                        "Conversion",
                        "Retention"
                      ]
                    },
                    contentIdea: { type: "string" },
                    imagePrompt: { type: "string" },
                    signalScore: { type: "number", minimum: 1, maximum: 10 }
                  }
                }
              }
            }
          }
        }
      }
    })
  });

  const payload = (await response.json()) as OpenAIResponse;

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? response.statusText);
  }

  const text = extractOutputText(payload);
  const parsed = JSON.parse(text) as IdeaSchema;

  return parsed.ideas
    .filter((idea) => ads.some((ad) => ad.id === idea.sourceAdId))
    .map(sanitizeIdea);
}

function extractOutputText(payload: OpenAIResponse): string {
  if (payload.output_text) {
    return payload.output_text;
  }

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .find(Boolean);

  if (!text) {
    throw new Error("OpenAI response did not include output text.");
  }

  return text;
}

function sanitizeIdea(idea: GeneratedIdea): GeneratedIdea {
  return {
    ...idea,
    contentFormat: FORMATS.includes(idea.contentFormat)
      ? idea.contentFormat
      : "Unknown",
    funnelStage: FUNNELS.includes(idea.funnelStage)
      ? idea.funnelStage
      : "Consideration",
    signalScore: Math.max(1, Math.min(10, Number(idea.signalScore) || 5))
  };
}

function generateHeuristicIdeas(
  ads: NormalizedAd[],
  ideasPerAd: number
): GeneratedIdea[] {
  return ads.flatMap((ad) => {
    const baseSignal = detectSignal(ad);
    const formats = FORMATS.slice(0, Math.max(1, Math.min(ideasPerAd, 2)));

    return formats.map((format) => ({
      sourceAdId: ad.id,
      contentFormat: format,
      hook: makeHook(ad, format),
      coreAngle: makeCoreAngle(ad),
      creativeSignal: baseSignal,
      microSegment: makeMicroSegment(ad),
      funnelStage: detectFunnel(ad),
      contentIdea: makeContentIdea(ad, format),
      imagePrompt: makeImagePrompt(ad),
      signalScore: scoreAd(ad)
    }));
  });
}

function allText(ad: NormalizedAd): string {
  return [ad.title, ad.body, ad.description, ad.caption]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function detectSignal(ad: NormalizedAd): string {
  const text = allText(ad);
  if (text.includes("free") || text.includes("免费")) {
    return "低门槛免费入口，先降低行动阻力，再用训练/模板承接需求。";
  }
  if (text.includes("ai") || text.includes("clone") || text.includes("claude")) {
    return "AI/分身机制被包装成省时杠杆，主打从人力瓶颈切到系统复制。";
  }
  if (text.includes("trial") || text.includes("7 days")) {
    return "短周期试用承诺，强调先体验结果再做购买决定。";
  }
  if (text.includes("webinar") || text.includes("training")) {
    return "教学型入口，利用具体技能缺口引导用户进入长内容转化。";
  }
  return "直接结果承诺搭配具体机制，适合拆成痛点、对比、步骤和证明。";
}

function makeHook(ad: NormalizedAd, format: ContentFormat): string {
  const text = allText(ad);
  if (text.includes("ai") || text.includes("clone")) {
    return format === "Video"
      ? "如果你每天还在亲自做重复工作，你缺的不是更努力，而是一个能复制你的 AI 系统。"
      : "别再雇第 2 个你，先复制第 1 个你。";
  }
  if (text.includes("webinar") || text.includes("slide")) {
    return format === "Video"
      ? "你的 webinar 没转化，可能不是 offer 问题，是前 5 张 slide 没有把痛点钉住。"
      : "5 分钟改掉一套不成交的 webinar slide。";
  }
  if (text.includes("free") || text.includes("免费")) {
    return format === "Video"
      ? "多数人不是不想开始，是第一步太贵、太复杂、太没有确定性。"
      : "免费训练不是福利，是你验证机会成本的最快入口。";
  }
  return format === "Video"
    ? "你现在卡住的增长问题，通常不是流量不够，而是机制还没有被拆清楚。"
    : "增长不是多做，是把正确机制重复做。";
}

function makeCoreAngle(ad: NormalizedAd): string {
  const text = allText(ad);
  if (text.includes("ai") || text.includes("clone") || text.includes("claude")) {
    return "把创始人的重复决策、销售话术和内容生产 SOP 化，再交给 AI 放大。";
  }
  if (text.includes("webinar") || text.includes("slide")) {
    return "用 AI 把 webinar 从空白页变成可成交结构，减少准备时间。";
  }
  if (text.includes("trial") || text.includes("7 days")) {
    return "用短周期试用降低怀疑，让用户先看到系统价值。";
  }
  return "用清晰机制替代泛泛努力，把痛点变成一个可执行的下一步。";
}

function makeMicroSegment(ad: NormalizedAd): string {
  const text = allText(ad);
  if (ad.competitor === "Reeve Yew") {
    return "想用 AI 副业多赚 USD 2k-3k、但还缺系统和案例的新手创业者。";
  }
  if (text.includes("webinar")) {
    return "有课程或咨询产品、但 webinar 到报名页转化偏低的知识型创业者。";
  }
  if (text.includes("founder") || text.includes("scale")) {
    return "营收在增长但创始人仍被销售、招聘、内容亲自绑定的老板。";
  }
  if (text.includes("ai") || text.includes("clone")) {
    return "已经在用 ChatGPT，但还没有把个人经验训练成业务资产的 solo founder。";
  }
  return "有明确产品但内容角度重复、需要新 hook 来测试的中小型创业者。";
}

function detectFunnel(ad: NormalizedAd): FunnelStage {
  const text = allText(ad);
  if (text.includes("trial") || text.includes("vip") || text.includes("access")) {
    return "Conversion";
  }
  if (text.includes("framework") || text.includes("training") || text.includes("webinar")) {
    return "Consideration";
  }
  return "Awareness";
}

function makeContentIdea(ad: NormalizedAd, format: ContentFormat): string {
  if (format === "Video") {
    return "拍一个 35-45 秒直面镜头短片：先点出目标用户每天重复救火的成本，再展示一个三步机制，最后用一个低门槛 CTA 引导领取框架/训练。";
  }

  return "做一张强对比单图：左边是“亲自做一切”的混乱清单，右边是“系统复制你”的三格流程，中间放一句量化结果承诺。";
}

function makeImagePrompt(ad: NormalizedAd): string {
  return [
    "Create a high-converting static Facebook/Instagram ad image, clean direct-response layout,",
    "Asian entrepreneur at a laptop reviewing an AI workflow dashboard,",
    "bold headline space at top, three-step mechanism cards in the middle,",
    "subtle proof metric area at bottom, modern SaaS/coaching aesthetic,",
    "high contrast, realistic photography blended with crisp UI overlays, no fake logos."
  ].join(" ");
}

function scoreAd(ad: NormalizedAd): number {
  const text = allText(ad);
  let score = 5;
  if (text.includes("free") || text.includes("免费")) score += 1;
  if (text.includes("ai") || text.includes("clone") || text.includes("claude")) score += 1;
  if (text.match(/\d/)) score += 1;
  if (text.includes("trial") || text.includes("access")) score += 1;
  if (ad.snapshotUrl) score += 1;
  return Math.min(score, 10);
}
