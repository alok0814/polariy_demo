import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) as { url?: string };
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URLが必要です" },
        { status: 400 }
      );
    }

    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json(
        { error: "無効なURLです" },
        { status: 400 }
      );
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FactCheckBot/1.0; +https://factcheck.local)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `ページの取得に失敗しました (${res.status})` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    $("script, style, nav, footer, iframe, noscript").remove();
    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text() ||
      "";
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

    return NextResponse.json({
      url,
      title: title.trim().slice(0, 500),
      description: description.trim().slice(0, 1000),
      body: body.trim().slice(0, 50000),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `ニュースの取得に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
