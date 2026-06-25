# ADS Content Bank Cloud Cron

This is a cloud-hosted automation for:

1. Reading public competitor ads from the Ads Library URLs by cloud scraper.
2. Turning creative signals into micro-segmented video and single-image ideas.
3. Writing creative analysis, content angle, target audience, hook, framework logic, and generated ideas into Notion database `ADS Content Bank - Competitor Ideas`.
4. Running on Vercel Cron every day at `01:00 UTC` / `09:00 Asia/Kuala_Lumpur`.

## Deploy

1. Push this folder to GitHub.
2. Import the repo into Vercel.
3. Add the environment variables from `.env.example`.
4. Share the Notion database with your Notion integration.
5. Deploy production. Vercel creates the cloud cron from `vercel.json`.

Vercel Cron invokes production deployments with a GET request to the configured path and can secure the request by sending `CRON_SECRET` as a bearer token.

## Ads Library scraper

This app does not use Meta's official `/ads_archive` endpoint for competitor commercial ads because that endpoint can require identity and permission flows that are separate from the public Ads Library website.

Instead, connect any cloud scraper endpoint with:

- `SCRAPER_API_URL`: the endpoint this app calls.
- `SCRAPER_API_KEY`: optional bearer/API key for that endpoint.
- `SCRAPER_PROVIDER`: optional label, defaults to `generic`.

The scraper receives:

```json
{
  "provider": "generic",
  "url": "https://www.facebook.com/ads/library/?...",
  "pageId": "116482854782233",
  "pageName": "Alex Hormozi",
  "activeStatus": "ACTIVE",
  "limit": 3
}
```

Return an array of ads directly, or put the array under `ads`, `data`, `results`, or `items`. The normalizer reads common fields such as:

- Ad identity: `id`, `libraryId`, `archiveId`, `ad_snapshot_url`, `adSnapshotUrl`.
- Creative text: `headline`, `title`, `body`, `primaryText`, `caption`, `description`.
- Creative media: `videoUrl`, `video_url`, `imageUrl`, `image_url`, `creativeMediaUrl`, `downloadedMediaUrl`.
- Video script: `videoScript`, `transcript`, `videoTranscript`, `spokenText`, `subtitles`.
- CTA: `ctaText`, `ctaButton`, `callToActionText`, `ctaLink`, `callToActionUrl`, `linkUrl`.
- Metadata: `page_name`, `publisher_platforms`, `media_type`, `startDate`, `firstSeen`.

Each Notion page includes:

- Source creative reference and original ad text.
- Source creative media, headline, captions, CTA button, CTA link, and video script/transcript when available.
- Detected hook, content angle, creative signal, and target audience.
- Underlying logic and reusable winning framework.
- New video and single-image content ideas, including ChatGPT Image 2 ready-to-build image prompts.

## Mobile access

Open the deployed Vercel URL on your phone. The dashboard is responsive and includes a manual trigger. Add it to your phone home screen as a PWA-style app from the browser share menu.

## Manual run

From the dashboard, paste `CRON_SECRET` and tap **Run sync**.

Or call:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-project.vercel.app/api/cron/ads-to-notion?limit=3"
```

Use `?dryRun=true` to test without writing Notion pages.

## Important constraints

The public Ads Library website and Meta's official Ad Library API are not the same access path. Seeing ads in the browser does not guarantee the official API token can read them. For commercial competitor tracking, use a cloud browser/scraper service and keep that service's key in Vercel.
