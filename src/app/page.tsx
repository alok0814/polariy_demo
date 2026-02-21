"use client";

import { useState } from "react";
import { PANEL_ORDER } from "@/lib/agents";

type Reply = {
  agentId: string;
  name: string;
  shortName: string;
  color: string;
  text: string;
  summary: string;
  score: number | null;
};

type Result = {
  url: string;
  title: string;
  replies: Reply[];
  finalSummary?: string;
  credibilityScore?: number;
  biasPosition?: string;
  biasConfidence?: number;
};

const BIAS_POSITIONS = ["Far Left", "Left", "Center-Left", "Center", "Center-Right", "Right", "Far Right"] as const;
function biasPositionToPercent(position: string): number {
  const i = BIAS_POSITIONS.indexOf(position as (typeof BIAS_POSITIONS)[number]);
  if (i >= 0) return (i / (BIAS_POSITIONS.length - 1)) * 100;
  if (/far left/i.test(position)) return 0;
  if (/left/i.test(position) && !/center/i.test(position)) return 20;
  if (/center-left/i.test(position)) return 35;
  if (/center-right/i.test(position)) return 65;
  if (/right/i.test(position) && !/center/i.test(position)) return 80;
  if (/far right/i.test(position)) return 100;
  return 50;
}

function CredibilityGauge({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const color = clamped <= 40 ? "#ef4444" : clamped <= 70 ? "#eab308" : "#22c55e";
  const strokeDasharray = 2 * Math.PI * 45;
  const strokeDashoffset = strokeDasharray - (clamped / 100) * strokeDasharray;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center">
        <svg width="120" height="120" className="-rotate-90">
          <circle cx="60" cy="60" r="45" fill="none" stroke="var(--border)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700"
          />
        </svg>
        <span className="absolute text-2xl font-bold tabular-nums" style={{ color }}>
          {Math.round(clamped)}
        </span>
      </div>
      <span className="text-sm font-medium text-[var(--muted)]">Credibility Score</span>
    </div>
  );
}

function BiasMeter({ position, confidence }: { position: string; confidence: number }) {
  const percent = biasPositionToPercent(position);
  return (
    <div className="w-full space-y-2">
      <div className="text-sm font-medium text-[var(--muted)]">Bias Meter</div>
      <div
        className="relative h-6 w-full rounded-full"
        style={{
          background: "linear-gradient(to right, #1B4FCC 0%, #5B7DD6 25%, #888888 50%, #C75B6B 75%, #D72638 100%)",
        }}
      >
        <div
          className="absolute top-1/2 h-8 w-1 rounded-full bg-white shadow-md"
          style={{ left: `${Math.min(100, Math.max(0, percent))}%`, transform: "translate(-50%, -50%)" }}
        />
      </div>
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>Far Left</span>
        <span>Left</span>
        <span>Center</span>
        <span>Right</span>
        <span>Far Right</span>
      </div>
      <p className="text-center text-sm">
        <span className="font-medium text-[var(--text)]">{position}</span>
        <span className="text-[var(--muted)]"> — {confidence}% confident</span>
      </p>
    </div>
  );
}

type PanelMember = (typeof PANEL_ORDER)[number];
function getCharacter(m: PanelMember) {
  const x = m as PanelMember & { characterName?: string; characterTagline?: string; icon?: string };
  return {
    name: x.characterName ?? m.shortName,
    tagline: x.characterTagline ?? "",
    icon: x.icon ?? "•",
  };
}

function AnalysisOrderIcons({ done }: { done: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
      {PANEL_ORDER.map((member) => {
        const { name, tagline, icon } = getCharacter(member);
        return (
          <div
            key={member.id}
            className="flex min-w-[5rem] flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            style={{ borderLeftWidth: 4, borderLeftColor: member.color }}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--border)] text-lg">
              {done ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                icon
              )}
            </div>
            <span className="text-center text-sm font-medium text-[var(--text)]">{name}</span>
            {tagline && (
              <span className="max-w-[5.5rem] truncate text-center text-xs text-[var(--muted)]" title={tagline}>
                {tagline}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!url.trim()) return;

    setLoading(true);
    try {
      const fetchRes = await fetch("/api/fetch-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const fetchData = await fetchRes.json();
      if (!fetchRes.ok) {
        setError(fetchData.error || "Failed to fetch news.");
        setLoading(false);
        return;
      }

      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: fetchData.url,
          title: fetchData.title,
          description: fetchData.description,
          body: fetchData.body,
        }),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) {
        setError(analyzeData.error || "Analysis failed.");
        setLoading(false);
        return;
      }

      setResult(analyzeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight">FactCheck Debate</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Enter a political news URL and multiple perspective agents will debate and analyze it.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/news/..."
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text)] placeholder:text-[var(--muted)] focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-cyan-600 px-6 py-3 font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>
          {error && (
            <p className="rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">{error}</p>
          )}
        </form>

        {loading && (
          <div className="mt-10 space-y-4">
            <p className="text-center text-[var(--muted)]">Panel order: Host sets the focus, then each analyst speaks in turn</p>
            <AnalysisOrderIcons done={false} />
            <p className="text-center text-sm text-[var(--muted)]">Fetching news → Host → Morgan → Victor → Skeptica → Lens → Verify → Bridge → Terra</p>
            <div className="h-2 w-full animate-pulse rounded-full bg-[var(--border)]" />
          </div>
        )}

        {result && !loading && (
          <section className="mt-10 space-y-8">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="font-semibold">{result.title || "(No title)"}</h2>
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm text-cyan-400 hover:underline"
              >
                {result.url}
              </a>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-[var(--muted)]">Panel (order of analysis)</p>
              <AnalysisOrderIcons done={true} />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <CredibilityGauge score={result.credibilityScore ?? 50} />
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <BiasMeter
                  position={result.biasPosition ?? "Center"}
                  confidence={result.biasConfidence ?? 50}
                />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="mb-3 text-lg font-semibold">Final summary</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">
                {result.finalSummary || "No summary available."}
              </p>
            </div>
          </section>
        )}
      </main>

      <footer className="mt-16 border-t border-[var(--border)] py-6 text-center text-sm text-[var(--muted)]">
        FactCheck Debate — Multi-perspective news analysis
      </footer>
    </div>
  );
}
