import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

export const supabase =
  url && key ? createClient(url, key) : null;

export type AnalysisRow = {
  id?: number;
  url: string;
  title: string;
  created_at?: string;
  replies: { agentId: string; name: string; shortName: string; color: string; text: string }[];
};
