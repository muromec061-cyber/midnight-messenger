import type { LLMConfig, PowerProfile, MessageRecord } from "./types.ts";

const POWER_INSTRUCTIONS: Record<PowerProfile, string> = {
  lite: "Отвечай максимально кратко — 1-3 предложения, только суть. Без вступлений.",
  balanced: "Отвечай понятно и структурированно. Короткие абзацы, если нужно — списки.",
  ultra:
    "Дай развёрнутый, детальный ответ с примерами, шагами и пояснениями. Не сокращай важные детали.",
};

export function buildLLMConfig(): LLMConfig {
  const minimaxKey = Deno.env.get("MINIMAX_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (minimaxKey) {
    return {
      enabled: true,
      type: "minimax",
      apiKey: minimaxKey,
      baseUrl: "https://api.minimax.io/v1",
      model: Deno.env.get("MINIMAX_MODEL") || "MiniMax-M3",
    };
  }

  if (openaiKey) {
    return {
      enabled: true,
      type: "openai",
      apiKey: openaiKey,
      baseUrl: "https://api.openai.com/v1",
      model: Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
    };
  }

  return { enabled: false, type: "none" };
}

export function powerSystemInstruction(power: PowerProfile): string {
  return POWER_INSTRUCTIONS[power];
}

const MAX_TOKENS: Record<PowerProfile, number> = {
  lite: 256,
  balanced: 1024,
  ultra: 2048,
};

export async function callLLM(
  config: LLMConfig,
  messages: MessageRecord[],
  power: PowerProfile,
): Promise<string | null> {
  if (!config.enabled || !config.apiKey || !config.baseUrl || !config.model) {
    return null;
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: 0.7,
    max_tokens: MAX_TOKENS[power],
  };

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error("LLM HTTP error:", response.status, await response.text());
      return null;
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error("LLM empty content", data);
      return null;
    }
    return content.trim();
  } catch (err) {
    console.error("LLM fetch error:", err);
    return null;
  }
}
