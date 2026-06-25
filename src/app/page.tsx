"use client";

import {
  CheckCircle2,
  Cloud,
  Database,
  KeyRound,
  Loader2,
  Play,
  RefreshCcw,
  Smartphone
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SyncResult = {
  ok?: boolean;
  dryRun?: boolean;
  fetchedAds?: number;
  generatedIdeas?: number;
  createdPages?: number;
  skippedDuplicates?: number;
  warnings?: string[];
  error?: string;
};

const CLOUD_VARIABLES = [
  { name: "CRON_SECRET", badge: "required" },
  { name: "SCRAPER_API_URL", badge: "required" },
  { name: "SCRAPER_API_KEY", badge: "if needed" },
  { name: "NOTION_API_KEY", badge: "required" },
  { name: "OPENAI_API_KEY", badge: "required" }
];

export default function Home() {
  const [secret, setSecret] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [limit, setLimit] = useState(2);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    setSecret(window.localStorage.getItem("ads-cron-secret") ?? "");
  }, []);

  useEffect(() => {
    if (secret) {
      window.localStorage.setItem("ads-cron-secret", secret);
    }
  }, [secret]);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({
      dryRun: String(dryRun),
      limit: String(limit)
    });
    return `/api/cron/ads-to-notion?${params.toString()}`;
  }, [dryRun, limit]);

  async function runSync() {
    setIsRunning(true);
    setResult(null);

    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${secret}`
        }
      });
      const payload = (await response.json()) as SyncResult;
      setResult(payload);
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="shell">
      <section className="top-band">
        <div className="brand-block">
          <img alt="" className="app-icon" src="/icon.svg" />
          <div>
            <div className="eyebrow">
            <Cloud size={16} />
            Vercel Cloud Cron · Ads Library Scraper · Notion
            </div>
            <h1>ADS Content Bank 自动化控制台</h1>
            <p>
              云端读取公开 Ads Library 页面，生成 micro-segment angle、hook、视频/单图
              idea、target audience 和底层框架，然后写入 Notion。
            </p>
          </div>
        </div>
        <div className="status-grid" aria-label="Automation status">
          <StatusTile icon={<Cloud />} label="Cloud Cron" value="09:00 MYT" />
          <StatusTile icon={<Database />} label="Notion DB" value="Connected by env" />
          <StatusTile icon={<Smartphone />} label="Mobile" value="PWA ready" />
        </div>
      </section>

      <section className="work-surface">
        <div className="panel primary-panel">
          <div className="panel-heading">
            <div>
              <h2>Run Sync</h2>
              <p>手机上也能手动触发；默认 dry run，不会写入 Notion。</p>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setResult(null)}
              aria-label="Clear result"
              title="Clear result"
            >
              <RefreshCcw size={18} />
            </button>
          </div>

          <label className="field">
            <span>
              <KeyRound size={16} />
              CRON_SECRET
            </span>
            <input
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="Paste your Vercel CRON_SECRET"
              type="password"
            />
          </label>

          <div className="controls-row">
            <label className="toggle">
              <input
                checked={dryRun}
                onChange={(event) => setDryRun(event.target.checked)}
                type="checkbox"
              />
              <span>Dry run</span>
            </label>
            <label className="stepper">
              Ads/page
              <input
                max={10}
                min={1}
                onChange={(event) => setLimit(Number(event.target.value))}
                type="number"
                value={limit}
              />
            </label>
          </div>

          <button
            className="run-button"
            disabled={!secret || isRunning}
            onClick={runSync}
            type="button"
          >
            {isRunning ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
            {isRunning ? "Running..." : "Run sync"}
          </button>

          {result && (
            <div className={result.ok ? "result ok" : "result warn"}>
              <div className="result-title">
                <CheckCircle2 size={18} />
                {result.ok ? "Sync completed" : "Sync returned warnings"}
              </div>
              <dl>
                <div>
                  <dt>Fetched ads</dt>
                  <dd>{result.fetchedAds ?? 0}</dd>
                </div>
                <div>
                  <dt>Ideas</dt>
                  <dd>{result.generatedIdeas ?? 0}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{result.createdPages ?? 0}</dd>
                </div>
                <div>
                  <dt>Skipped</dt>
                  <dd>{result.skippedDuplicates ?? 0}</dd>
                </div>
              </dl>
              {(result.error || Boolean(result.warnings?.length)) && (
                <pre>{result.error ?? result.warnings?.join("\n")}</pre>
              )}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>Cloud Setup</h2>
              <p>这些 secrets 要放在 Vercel，不放在手机或前端代码里。</p>
            </div>
          </div>
          <div className="secret-list">
            {CLOUD_VARIABLES.map((item) => (
              <div className="secret-item" key={item.name}>
                <span>{item.name}</span>
                <code>{item.badge}</code>
              </div>
            ))}
          </div>
          <div className="deploy-note">
            <strong>Schedule</strong>
            <span>Vercel Cron: 0 1 * * * / 09:00 Malaysia time</span>
          </div>
          <div className="deploy-note">
            <strong>Scraper contract</strong>
            <span>POST Ads Library URL, page ID, page name, active status, and limit. Return ads with headline, captions, CTA, media URL, and video script/transcript when available.</span>
          </div>
          <div className="deploy-note">
            <strong>Notion output</strong>
            <span>Creative media, headline, captions, hook, CTA, target audience, framework logic, video script, single-image prompt.</span>
          </div>
          <div className="deploy-note">
            <strong>Notion target</strong>
            <span>5dbd19dce74e48e6912f389d93b952af</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function StatusTile({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="status-tile">
      <div className="status-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
