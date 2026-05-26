import { NextRequest } from "next/server";
import { handleChatCompletions, healthResponse } from "@/lib/pippivoice/llm-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return healthResponse();
}

// Some clients call the base URL with POST instead of /chat/completions.
// Handle it transparently for compatibility.
export async function POST(req: NextRequest) {
  return handleChatCompletions(req);
}
