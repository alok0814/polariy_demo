import fs from "fs";
import path from "path";

export type AdFontesRow = {
  newsSource: string;
  verticalRank: number;
  horizontalRank: number;
};

let cachedRows: AdFontesRow[] | null = null;

export function loadAdFontesRows(): AdFontesRow[] {
  if (cachedRows) return cachedRows;
  const csvPath = path.join(process.cwd(), "src", "data", "ad-fontes-media.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: AdFontesRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^"([^"]*)","(-?\d+)","(-?\d+)"$/);
    if (!m) continue;
    rows.push({
      newsSource: m[1],
      verticalRank: parseInt(m[2], 10),
      horizontalRank: parseInt(m[3], 10),
    });
  }
  cachedRows = rows;
  return rows;
}

/** Ad Fontes vertical (reliability) 0–64 → 0–100 */
export function verticalToReliability100(vertical: number): number {
  const v = Math.min(64, Math.max(0, vertical));
  return Math.round((v / 64) * 100);
}

/** Horizontal bias roughly −42 … +42 → Left–Right slider 0–100 */
export function horizontalToSliderPercent(horizontal: number): number {
  const h = Math.min(42, Math.max(-42, horizontal));
  return ((h + 42) / 84) * 100;
}

export type BiasCategory5 =
  | "Far Left"
  | "Lean Left"
  | "Center"
  | "Lean Right"
  | "Far Right";

/** Map horizontal rank (−42 … +42) to five-way spectrum */
export function horizontalToBiasCategory(horizontal: number): BiasCategory5 {
  const h = Math.min(42, Math.max(-42, horizontal));
  if (h <= -26) return "Far Left";
  if (h <= -9) return "Lean Left";
  if (h <= 8) return "Center";
  if (h <= 25) return "Lean Right";
  return "Far Right";
}

export function biasCategoryIndex(cat: BiasCategory5): number {
  const order: BiasCategory5[] = [
    "Far Left",
    "Lean Left",
    "Center",
    "Lean Right",
    "Far Right",
  ];
  return order.indexOf(cat);
}

/**
 * Known hostname → exact "News Source" string in CSV (subset; extend as needed).
 */
const DOMAIN_TO_SOURCE: Record<string, string> = {
  "cnn.com": "CNN",
  "edition.cnn.com": "CNN",
  "foxnews.com": "Fox",
  "msnbc.com": "MSNBC",
  "nbcnews.com": "NBC",
  "cbsnews.com": "CBS",
  "abcnews.go.com": "ABC",
  "abc.net.au": "ABC",
  "nytimes.com": "New York Times",
  "washingtonpost.com": "Washington Post",
  "wsj.com": "Wall Street Journal",
  "reuters.com": "Reuters",
  "apnews.com": "AP",
  "bbc.com": "BBC",
  "bbc.co.uk": "BBC",
  "theguardian.com": "The Guardian",
  "politico.com": "Politico",
  "axios.com": "Axios",
  "bloomberg.com": "Bloomberg",
  "npr.org": "NPR",
  "pbs.org": "PBS",
  "breitbart.com": "Breitbart",
  "dailycaller.com": "Daily Caller",
  "nationalreview.com": "National Review",
  "theatlantic.com": "The Atlantic",
  "economist.com": "The Economist",
  "time.com": "Time",
  "usatoday.com": "USA Today",
  "latimes.com": "LA Times",
  "huffpost.com": "Huffington Post",
  "huffingtonpost.com": "Huffington Post",
  "vox.com": "Vox",
  "slate.com": "Slate",
  "motherjones.com": "Mother Jones",
  "thehill.com": "The Hill",
  "newsmax.com": "NewsMax",
  "oann.com": "OAN",
  "theblaze.com": "The Blaze",
  "dailywire.com": "Daily Wire",
  "forbes.com": "Forbes",
  "businessinsider.com": "Business Insider",
  "marketwatch.com": "Marketwatch",
  "ft.com": "Financial Times",
  "reason.com": "Reason",
  "propublica.org": "ProPublica",
  "newyorker.com": "The New Yorker",
  "vanityfair.com": "Vanity Fair",
  "vice.com": "Vice",
  "quartz.com": "Quartz",
  "fivethirtyeight.com": "FiveThirtyEight",
};

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

/** Best-effort match: domain map, then substring match on source name vs hostname. */
export function findOutletByUrl(articleUrl: string): AdFontesRow | null {
  if (/^paste:\/\//i.test(articleUrl.trim())) return null;
  let hostname = "";
  try {
    hostname = normalizeHost(new URL(articleUrl).hostname);
  } catch {
    return null;
  }
  const rows = loadAdFontesRows();
  const byDomain = DOMAIN_TO_SOURCE[hostname];
  if (byDomain) {
    const exact = rows.find((r) => r.newsSource === byDomain);
    if (exact) return exact;
  }
  for (const row of rows) {
    const name = row.newsSource.toLowerCase();
    const alpha = name.replace(/[^a-z0-9]+/g, "");
    if (alpha.length >= 3 && hostname.replace(/[^a-z0-9]/g, "").includes(alpha)) {
      return row;
    }
  }
  const bare = hostname.split(".")[0] ?? "";
  for (const row of rows) {
    const slug = row.newsSource.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (slug.length >= 3 && bare.includes(slug.slice(0, Math.min(6, slug.length)))) {
      return row;
    }
  }
  return null;
}

export function blendReliabilityAndHorizontal(
  csv: AdFontesRow | null,
  aiReliability: number,
  aiHorizontal: number
): { reliability: number; horizontal: number } {
  const aiR = Math.min(100, Math.max(0, aiReliability));
  const aiH = Math.min(42, Math.max(-42, aiHorizontal));
  if (!csv) {
    return { reliability: aiR, horizontal: aiH };
  }
  const csvRel = verticalToReliability100(csv.verticalRank);
  const csvH = csv.horizontalRank;
  return {
    reliability: Math.round(0.45 * csvRel + 0.55 * aiR),
    horizontal: Math.round(0.45 * csvH + 0.55 * aiH),
  };
}
