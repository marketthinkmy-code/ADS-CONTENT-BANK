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
              "Target Audience must infer who the source ad is speaking to.",
              "Underlying Logic must explain why this creative may be worth scaling.",
              "Winning Framework must name the reusable content framework behind the ad.",
              "Micro Segment must be specific enough to brief a creator.",
              "Video Script must preserve scraped source transcript if present; otherwise create a concise original 30-45 second script for video execution.",
              "Image Prompt must be a complete ChatGPT Image 2 ready-to-build prompt for generating a static ad image. Include aspect ratio, subject, layout, headline placement, visual style, and negative constraints.",
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
              sourceFormat: ad.sourceFormat,
              creativeType: ad.creativeType,
              creativeMediaUrl: ad.creativeMediaUrl,
              ctaButton: ad.ctaButton,
              ctaLink: ad.ctaLink,
              videoScript: ad.videoScript,
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
                    "targetAudience",
                    "underlyingLogic",
                    "winningFramework",
                    "microSegment",
                    "funnelStage",
                    "contentIdea",
                    "imagePrompt",
                    "videoScript",
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
                    targetAudience: { type: "string" },
                    underlyingLogic: { type: "string" },
                    winningFramework: { type: "string" },
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
                    videoScript: { type: "string" },
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
    videoScript: idea.videoScript || "",
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
      targetAudience: makeTargetAudience(ad),
      underlyingLogic: makeUnderlyingLogic(ad),
      winningFramework: makeWinningFramework(ad),
      microSegment: makeMicroSegment(ad),
      funnelStage: detectFunnel(ad),
      contentIdea: makeContentIdea(ad, format),
      imagePrompt: makeImagePrompt(ad),
      videoScript: makeVideoScript(ad, format),
      signalScore: scoreAd(ad)
    }));
  });
}

function allText(ad: NormalizedAd): string {
  return [ad.title, ad.body, ad.description, ad.caption, ad.ctaButton, ad.videoScript]
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

function makeTargetAudience(ad: NormalizedAd): string {
  const text = allText(ad);
  if (ad.competitor === "Alex Hormozi") {
    return "已经有 offer、团队或现金流，但增长仍被创始人亲自执行卡住的老板。";
  }
  if (ad.competitor === "Dan Henry" || text.includes("webinar")) {
    return "卖课程、咨询、coaching 或 high-ticket 服务，但转化流程还不稳定的知识型创业者。";
  }
  if (ad.competitor === "PengJoon") {
    return "想把知识、AI 工具或线上产品变成可规模化收入的 marketer / creator。";
  }
  if (ad.competitor === "Reeve Yew") {
    return "想用 AI 或副业赚第一笔可观收入，但缺具体机制和执行路线的新手创业者。";
  }
  if (text.includes("ai") || text.includes("clone")) {
    return "已经使用 AI 工具，但还没把个人经验变成可复制系统的 solo founder。";
  }
  return "有产品、有内容需求，但需要更清晰 hook 和购买理由的中小型创业者。";
}

function makeUnderlyingLogic(ad: NormalizedAd): string {
  const text = allText(ad);
  if (text.includes("free") || text.includes("免费")) {
    return "先用免费入口降低风险感，再用训练、模板或诊断把用户带进更深的转化链路。";
  }
  if (text.match(/\d/)) {
    return "数字让承诺变得具体，用户更容易判断这个机制是否值得点击或报名。";
  }
  if (text.includes("ai") || text.includes("clone")) {
    return "把复杂劳动包装成杠杆系统，让用户相信同样的结果可以用更少时间复制。";
  }
  if (text.includes("webinar") || text.includes("training")) {
    return "用教学场景建立权威，再把信息差转化成下一步行动。";
  }
  return "用明确痛点打开注意力，再给出一个看起来可执行的机制，让用户从怀疑转到想了解。";
}

function makeWinningFramework(ad: NormalizedAd): string {
  const text = allText(ad);
  if (text.includes("ai") || text.includes("clone")) {
    return "Painful bottleneck -> AI mechanism -> proof/contrast -> low-friction CTA.";
  }
  if (text.includes("webinar") || text.includes("training")) {
    return "Skill gap -> short training promise -> authority proof -> registration CTA.";
  }
  if (text.includes("free") || text.includes("免费")) {
    return "Risk reversal -> specific asset/training -> fast first win -> nurture path.";
  }
  return "Specific pain -> named mechanism -> concrete outcome -> next small action.";
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
    "ChatGPT Image 2 prompt: Create a 4:5 high-converting Facebook/Instagram static ad image.",
    "Subject: Asian entrepreneur at a laptop reviewing a simple growth/AI workflow dashboard.",
    "Layout: bold headline area at the top, three-step mechanism cards in the middle, subtle proof metric strip at the bottom, clear CTA button area.",
    "Style: realistic photography blended with crisp UI overlays, modern direct-response coaching/SaaS aesthetic, high contrast, clean whitespace.",
    "Text placeholders: include readable placeholder zones only; do not invent fake logos or unreadable tiny text.",
    "Negative constraints: no fake brand logos, no distorted hands, no clutter, no excessive gradients."
  ].join(" ");
}

function makeVideoScript(ad: NormalizedAd, format: ContentFormat): string {
  if (ad.videoScript) {
    return ad.videoScript;
  }

  if (format !== "Video") {
    return "";
  }

  return [
    "0-3s Hook: 你现在卡住的增长问题，通常不是流量不够，而是机制还没被拆清楚。",
    "3-12s Pain: 每天亲自救火、改内容、追销售，团队越大你越忙。",
    "12-28s Mechanism: 用一个三步框架把痛点、证明和下一步行动拆出来，先复制判断，再复制执行。",
    "28-40s Proof/CTA: 先测试一个低门槛内容或训练入口，看到用户反应后再放大。"
  ].join("\n");
}

function scoreAd(ad: NormalizedAd): number {
  const text = allText(ad);
  let score = 5;
  if (text.includes("free") || text.includes("免费")) score += 1;
  if (text.includes("ai") || text.includes("clone") || text.includes("claude")) score += 1;
  if (text.match(/\d/)) score += 1;
  if (text.includes("trial") || text.includes("access")) score += 1;
  if (ad.snapshotUrl || ad.creativeMediaUrl) score += 1;
  return Math.min(score, 10);
}
