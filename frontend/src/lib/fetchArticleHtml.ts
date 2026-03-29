import * as cheerio from "cheerio";

export async function extractArticleFromUrl(url: string): Promise<{
  url: string;
  title: string;
  description: string;
  body: string;
}> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Invalid URL protocol");
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; PolarityBot/1.0; +https://polarity.local)",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch page (${res.status})`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  $("script, style, nav, footer, iframe, noscript").remove();
  const title =
    $("meta[property='og:title']").attr("content") || $("title").text() || "";
  const description =
    $("meta[property='og:description']").attr("content") ||
    $("meta[name='description']").attr("content") ||
    "";

  const main =
    $("article").first().length > 0
      ? $("article").first()
      : $("main").first().length > 0
        ? $("main").first()
        : $("body");

  const text = main
    .find("p, h1, h2, h3, li")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .join("\n\n");

  const body = text.slice(0, 50000) || $("body").text().slice(0, 50000);

  return {
    url,
    title: title.trim().slice(0, 500),
    description: description.trim().slice(0, 1000),
    body: body.trim().slice(0, 50000),
  };
}
