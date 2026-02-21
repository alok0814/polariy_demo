import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { AGENTS, FACILITATOR } from "@/lib/agents";
import { supabase } from "@/lib/supabase";

const MODEL = "gpt-4o-mini";

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

function get429RetryDelayMs(err: unknown): number | null {
  const errAny = err as { status?: number; response?: { status?: number } };
  if (errAny?.status === 429 || errAny?.response?.status === 429) return 60000;
  return null;
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
    if (!url || !newsBody) {
      return NextResponse.json(
        { error: "URL と本文が必要です" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const news = { url, title: title || "", description: description || "", body: newsBody };
    const replies: { agentId: string; name: string; shortName: string; color: string; text: string; summary: string; score: number | null }[] = [];
    const previousReplies: { name: string; text: string }[] = [];

    let facilitatorReminder = `Focus on the article's claims, evidence, and fairness. No tangents.`;
    try {
      const facCompletion = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: buildFacilitatorPrompt(news) }],
      });
      const facText = facCompletion.choices[0]?.message?.content?.trim() ?? "";
      if (facText.length > 0) facilitatorReminder = facText.slice(0, 400);
    } catch {
      // keep default reminder
    }

    for (let i = 0; i < AGENTS.length; i++) {
      const agent = AGENTS[i];
      const prompt = buildPrompt(i, news, previousReplies, facilitatorReminder);

      const maxRetries = 3;
      let lastError: unknown;
      let text = "";

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const completion = await openai.chat.completions.create({
            model: MODEL,
            messages: [{ role: "user", content: prompt }],
          });
          text = completion.choices[0]?.message?.content?.trim() ?? "";
          break;
        } catch (err: unknown) {
          lastError = err;
          const delayMs = get429RetryDelayMs(err);
          if (delayMs !== null && attempt < maxRetries - 1) {
            await new Promise((r) => setTimeout(r, delayMs));
            continue;
          }
          throw err;
        }
      }

      const displayText =
        text || (lastError instanceof Error ? `(Error: ${lastError.message})` : "(Failed to get analysis.)");
      const { text: bodyText, summary, score } = parseSummaryAndScore(displayText);

      replies.push({
        agentId: agent.id,
        name: agent.name,
        shortName: agent.shortName,
        color: agent.color,
        text: bodyText,
        summary: summary || bodyText.slice(0, 200),
        score,
      });
      previousReplies.push({ name: agent.name, text: displayText });
    }

    const finalPrompt = `You are summarizing a multi-perspective debate on a news article and producing metrics.

Each analyst's position:
${replies.map((r) => `- ${r.name}: ${r.summary} | Score: ${r.score ?? "—"}/10`).join("\n")}

Output the following in English, using EXACTLY this format (one value per line):

CREDIBILITY_SCORE: (integer 0-100; how trustworthy/credible is this news overall based on the debate? 100 = very credible, 0 = not credible)
BIAS_POSITION: (exactly one of: Far Left | Left | Center-Left | Center | Center-Right | Right | Far Right)
BIAS_CONFIDENCE: (integer 0-100; how confident is this bias assessment in percent)
FINAL_SUMMARY:
(2-4 sentences in English summarizing the debate outcome and whether the news is reliable, balanced, and what the main takeaways are)`;

    let finalSummary = "";
    let credibilityScore: number | null = null;
    let biasPosition = "Center";
    let biasConfidence: number | null = null;
    try {
      const finalCompletion = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: finalPrompt }],
      });
      const finalText = finalCompletion.choices[0]?.message?.content?.trim() ?? "";
      const credMatch = finalText.match(/CREDIBILITY_SCORE:\s*(\d+)/i);
      const posMatch = finalText.match(/BIAS_POSITION:\s*(Far Left|Left|Center-Left|Center|Center-Right|Right|Far Right)/i);
      const confMatch = finalText.match(/BIAS_CONFIDENCE:\s*(\d+)/i);
      const summaryMatch = finalText.match(/FINAL_SUMMARY:\s*([\s\S]+?)(?=\n\n|$)/i);
      if (credMatch) credibilityScore = Math.min(100, Math.max(0, parseInt(credMatch[1], 10)));
      if (posMatch) biasPosition = posMatch[1].trim();
      if (confMatch) biasConfidence = Math.min(100, Math.max(0, parseInt(confMatch[1], 10)));
      finalSummary = summaryMatch ? summaryMatch[1].trim() : finalText.slice(0, 600);
    } catch {
      finalSummary = replies.map((r) => `${r.name}: ${r.summary}`).join(". ");
    }

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
      credibilityScore: credibilityScore ?? 50,
      biasPosition,
      biasConfidence: biasConfidence ?? 50,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("analyze error", e);
    return NextResponse.json(
      { error: `分析に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
