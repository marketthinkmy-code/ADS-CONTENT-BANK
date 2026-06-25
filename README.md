# ADS Content Bank Cloud Cron

This is a cloud-hosted automation for:

1. Reading competitor ads from Meta Ad Library by Page ID.
2. Turning creative signals into micro-segmented video and single-image ideas.
3. Writing the generated ideas into Notion database `ADS Content Bank - Competitor Ideas`.
4. Running on Vercel Cron every day at `01:00 UTC` / `09:00 Asia/Kuala_Lumpur`.

## Deploy

1. Push this folder to GitHub.
2. Import the repo into Vercel.
3. Add the environment variables from `.env.example`.
4. Share the Notion database with your Notion integration.
5. Deploy production. Vercel creates the cloud cron from `vercel.json`.

Vercel Cron invokes production deployments with a GET request to the configured path and can secure the request by sending `CRON_SECRET` as a bearer token.

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

Meta's public Ad Library API returns transparency and creative text fields plus snapshot URLs. It does not expose every competitor media asset as raw downloadable files, so this automation derives the creative signal from the available API fields and links each Notion row back to the snapshot for visual review.
