import { GoogleGenerativeAI } from "@google/generative-ai";

export const DEFAULT_GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-2.0-flash";

export function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: DEFAULT_GEMINI_MODEL });
}

export async function generateGeminiText(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const maxRetries = 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return text.trim();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = /429|RESOURCE_EXHAUSTED|quota/i.test(msg);
      if (is429 && attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 45000 + attempt * 10000));
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
