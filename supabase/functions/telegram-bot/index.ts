import { handleUpdate } from "./handlers.ts";
import { buildLLMConfig } from "./llm.ts";
import type { TelegramUpdate } from "./types.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return new Response("AgentTeam Bot is up", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
  if (expectedSecret) {
    const header = req.headers.get("x-telegram-bot-api-secret-token");
    if (header !== expectedSecret) {
      console.warn("Invalid webhook secret token");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let update: TelegramUpdate | null = null;
  try {
    update = await req.json() as TelegramUpdate;
  } catch (err) {
    console.error("JSON parse error", err);
    return new Response("Bad request", { status: 400 });
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    console.error("TELEGRAM_BOT_TOKEN is not set");
    return new Response("Server error", { status: 500 });
  }

  const llm = buildLLMConfig();

  try {
    await handleUpdate(update, botToken, llm);
  } catch (err) {
    console.error("Handler error:", err);
  }

  return new Response("ok", { status: 200 });
});
