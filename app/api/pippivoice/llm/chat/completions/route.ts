import { NextRequest } from "next/server";
import { handleChatCompletions } from "@/lib/pippivoice/llm-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return handleChatCompletions(req);
}
