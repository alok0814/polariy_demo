import { NextRequest, NextResponse } from "next/server";
import { AGENTS, FACILITATOR } from "@/lib/agents";
import { supabase } from "@/lib/supabase";
import { generateGeminiText } from "@/lib/gemini";
import {
  blendReliabilityAndHorizontal,
  findOutletByUrl,
  horizontalToBiasCategory,
  type AdFontesRow,
} from "@/lib/adFontesCsv";

function buildFacilitatorPrompt(news: { title: string; url: string }) {
  return `${FACILITATOR.systemPrompt}

[Article title] ${news.title}
[Article URL] ${news.url}`;
}

function buildPrompt(
  agentIndex: number,
  news: { url: string; title: string; description: string; body: string },
  previousReplies: { name: string; text: string }[],
  facilitatorReminder: string
) {
  const agent = AGENTS[agentIndex];
  const newsBlock = `
[News URL] ${news.url}
[Title] ${news.title}
[Description] ${news.description}

[Body]
${news.body.slice(0, 25000)}
`;

  const discussionBlock =
    previousReplies.length > 0
      ? `
[Previous discussion]
${previousReplies.map((r) => `■ ${r.name}:\n${r.text}`).join("\n\n")}
`
      : "";

  return `${agent.systemPrompt}

FACILITATOR'S REMINDER (stay on topic): ${facilitatorReminder}

Here is the news to analyze.${previousReplies.length > 0 ? " Consider the discussion above and" : ""} give your analysis. Do not digress from the article's claims, evidence, and fairness.

${newsBlock}
${discussionBlock}
`;
}

function parseSummaryAndScore(rawText: string): { text: string; summary: string; score: number | null } {
  let text = rawText.trim();
  const summaryMatch = text.match(/\nSUMMARY:\s*(.+?)(?=\n|$)/i);
  const scoreMatch = text.match(/\nSCORE:\s*(\d+(?:\.\d+)?)\s*(?:\/10)?(?=\n|$)/i);
  const summary = summaryMatch ? summaryMatch[1].trim() : "";
  const score = scoreMatch ? Math.min(10, Math.max(1, parseFloat(scoreMatch[1]))) : null;
  if (summaryMatch) text = text.replace(/\nSUMMARY:\s*.+?(?=\n|$)/i, "").trim();
  if (scoreMatch) text = text.replace(/\nSCORE:\s*\d+(?:\.\d+)?\s*(?:\/10)?(?=\n|$)/i, "").trim();
  return { text, summary, score };
}

function parseHorizontalEstimate(text: string): number | null {
  const m = text.match(/HORIZONTAL_ESTIMATE:\s*(-?\d+)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Math.min(42, Math.max(-42, n));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      url: string;
      title: string;
      description: string;
      body: string;
    };
    const { url, title, description, body: newsBody } = body;
    if (!newsBody?.trim()) {
      return NextResponse.json({ error: "Article body is required" }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });
    }

    const articleUrl = (url && url.trim()) || "paste://article";
    const outletRow: AdFontesRow | null = findOutletByUrl(articleUrl);

    const news = {
      url: articleUrl,
      title: title || "",
      description: description || "",
      body: newsBody,
    };
    const replies: {
      agentId: string;
      name: string;
      shortName: string;
      color: string;
      text: string;
      summary: string;
      score: number | null;
    }[] = [];
    const previousReplies: { name: string; text: string }[] = [];

    let facilitatorReminder = `Focus on the article's claims, evidence, and fairness. No tangents.`;
    try {
      const facText = await generateGeminiText(buildFacilitatorPrompt(news));
      if (facText.length > 0) facilitatorReminder = facText.slice(0, 400);
    } catch {
      // keep default reminder
    }

    for (let i = 0; i < AGENTS.length; i++) {
      const agent = AGENTS[i];
      const prompt = buildPrompt(i, news, previousReplies, facilitatorReminder);
      let text = "";
      try {
        text = await generateGeminiText(prompt);
      } catch (e) {
        text = e instanceof Error ? `(Error: ${e.message})` : "(Failed to get analysis.)";
      }

      const { text: bodyText, summary, score } = parseSummaryAndScore(text);

      replies.push({
        agentId: agent.id,
        name: agent.name,
        shortName: agent.shortName,
        color: agent.color,
        text: bodyText,
        summary: summary || bodyText.slice(0, 200),
        score,
      });
      previousReplies.push({ name: agent.name, text });
    }

    const baselineNote = outletRow
      ? `Ad Fontes chart baseline for outlet "${outletRow.newsSource}": vertical (reliability) rank ${outletRow.verticalRank}/64, horizontal (bias) rank ${outletRow.horizontalRank} (negative = left, positive = right). Use this as a strong prior but adjust for this specific article.`
      : "No matching outlet in the Ad Fontes chart — infer bias and credibility from the article text and panel discussion only.";

    const finalPrompt = `You are summarizing a multi-perspective debate on a news article and producing metrics.

${baselineNote}

Each analyst's position:
${replies.map((r) => `- ${r.name}: ${r.summary} | Score: ${r.score ?? "—"}/10`).join("\n")}

Output the following in English, using EXACTLY this format (one value per line):

CREDIBILITY_SCORE: (integer 0-100; how trustworthy/credible is this news overall based on the debate? 100 = very credible, 0 = not credible)
HORIZONTAL_ESTIMATE: (integer from -42 to +42 only; negative = left bias, positive = right bias, 0 = center)
BIAS_CONFIDENCE: (integer 0-100; confidence in the bias estimate)
FINAL_SUMMARY:
(2-4 sentences in English summarizing the debate outcome and whether the news is reliable, balanced, and what the main takeaways are)`;

    let finalSummary = "";
    let aiCredibility: number | null = null;
    let aiHorizontal: number | null = null;
    let biasConfidence: number | null = null;
    try {
      const finalText = await generateGeminiText(finalPrompt);
      const credMatch = finalText.match(/CREDIBILITY_SCORE:\s*(\d+)/i);
      const confMatch = finalText.match(/BIAS_CONFIDENCE:\s*(\d+)/i);
      const summaryMatch = finalText.match(/FINAL_SUMMARY:\s*([\s\S]+?)(?=\n\n|$)/i);
      if (credMatch) aiCredibility = Math.min(100, Math.max(0, parseInt(credMatch[1], 10)));
      const hEst = parseHorizontalEstimate(finalText);
      if (hEst !== null) aiHorizontal = hEst;
      if (confMatch) biasConfidence = Math.min(100, Math.max(0, parseInt(confMatch[1], 10)));
      finalSummary = summaryMatch ? summaryMatch[1].trim() : finalText.slice(0, 600);
    } catch {
      finalSummary = replies.map((r) => `${r.name}: ${r.summary}`).join(". ");
    }

    const credAi = aiCredibility ?? 50;
    const horizAi = aiHorizontal ?? 0;
    const blended = blendReliabilityAndHorizontal(outletRow, credAi, horizAi);
    const biasCategory = horizontalToBiasCategory(blended.horizontal);

    if (supabase) {
      await supabase.from("analyses").insert({
        url: news.url,
        title: news.title,
        replies,
      });
    }

    return NextResponse.json({
      url: news.url,
      title: news.title,
      replies,
      finalSummary,
      credibilityScore: blended.reliability,
      horizontalRank: blended.horizontal,
      biasCategory,
      biasPosition: biasCategory,
      biasConfidence: biasConfidence ?? 50,
      outletBaseline: outletRow
        ? {
            name: outletRow.newsSource,
            verticalRank: outletRow.verticalRank,
            horizontalRank: outletRow.horizontalRank,
          }
        : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("analyze error", e);
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 });
  }
}
