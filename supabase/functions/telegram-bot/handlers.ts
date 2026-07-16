import type { AgentKey, LLMConfig, TelegramUpdate } from "./types.ts";
import * as db from "./db.ts";
import * as markup from "./markup.ts";
import { routeAndAnswer, teamAnswer } from "./agents.ts";
import { textToHtml } from "./markup.ts";

export async function handleUpdate(
  update: TelegramUpdate,
  botToken: string,
  llm: LLMConfig,
): Promise<void> {
  if (update.callback_query) {
    return handleCallback(update, botToken, llm);
  }
  if (update.message) {
    return handleMessage(update, botToken, llm);
  }
}

async function handleMessage(
  update: TelegramUpdate,
  botToken: string,
  llm: LLMConfig,
): Promise<void> {
  const msg = update.message!;
  const from = msg.from!;
  const chat = msg.chat;
  const text = (msg.text || "").trim();

  let thread = await db.getOrCreateThread(from.id, chat.id);

  if (text.startsWith("/")) {
    const [command, ...args] = text.slice(1).split(/\s+/, 2);
    const rest = args.join(" ").trim();

    switch (command.toLowerCase()) {
      case "start":
        return sendAnswer(botToken, chat.id, markup.welcomeMessage());
      case "agents":
        return sendAnswer(botToken, chat.id, markup.agentsMenu(thread.agent_key));
      case "agent": {
        const key = (rest as AgentKey) || "coordinator";
        if (isAgentKey(key)) {
          thread.agent_key = key;
          await db.updateThread(thread);
          return sendAnswer(botToken, chat.id, markup.agentSwitched(key));
        }
        return sendAnswer(botToken, chat.id, markup.agentsMenu(thread.agent_key));
      }
      case "power":
        return sendAnswer(botToken, chat.id, markup.powerMenu(thread.power));
      case "threads": {
        const threads = await db.listThreads(from.id);
        return sendAnswer(botToken, chat.id, markup.threadsMenu(threads, thread.id));
      }
      case "newthread": {
        thread = await db.createThread(from.id, chat.id);
        return sendAnswer(botToken, chat.id, markup.threadCreated(thread));
      }
      case "help":
        return sendAnswer(botToken, chat.id, markup.helpMessage());
      case "team":
      case "all": {
        const answer = await teamAnswer(thread, rest || "Дай командное мнение.", llm);
        await deliverAnswer(botToken, chat.id, thread, rest || "Дай командное мнение.", answer);
        return;
      }
      default:
        return sendAnswer(botToken, chat.id, markup.helpMessage());
    }
  }

  // Plain text message — route through agent.
  if (!text) {
    return sendAnswer(botToken, chat.id, {
      text: "Я пока не умею обрабатывать голосовые сообщения, фото и файлы. Напиши текстом.",
    });
  }

  // Team command via text keyword
  if (text.toLowerCase().startsWith("команда") || text.toLowerCase().startsWith("team")) {
    const answer = await teamAnswer(thread, text, llm);
    await deliverAnswer(botToken, chat.id, thread, text, answer);
    return;
  }

  const answer = await routeAndAnswer(thread, text, llm);
  await deliverAnswer(botToken, chat.id, thread, text, answer);
}

async function handleCallback(
  update: TelegramUpdate,
  botToken: string,
  llm: LLMConfig,
): Promise<void> {
  const cb = update.callback_query!;
  const from = cb.from;
  const chat = cb.message?.chat;
  const data = cb.data || "";
  const messageId = cb.message?.message_id;

  // Answer the callback to remove loading spinner.
  await answerCallback(botToken, cb.id);

  if (!chat) return;

  let thread = await db.getOrCreateThread(from.id, chat.id);

  if (data.startsWith("menu:")) {
    const menu = data.split(":")[1];
    if (menu === "main") {
      return editAnswer(botToken, chat.id, messageId, markup.mainMenu());
    }
    if (menu === "agents") {
      return editAnswer(botToken, chat.id, messageId, markup.agentsMenu(thread.agent_key));
    }
    if (menu === "power") {
      return editAnswer(botToken, chat.id, messageId, markup.powerMenu(thread.power));
    }
    if (menu === "threads") {
      const threads = await db.listThreads(from.id);
      return editAnswer(botToken, chat.id, messageId, markup.threadsMenu(threads, thread.id));
    }
    if (menu === "help") {
      return editAnswer(botToken, chat.id, messageId, markup.helpMessage());
    }
  }

  if (data.startsWith("agent:")) {
    const key = data.split(":")[1] as AgentKey;
    if (isAgentKey(key)) {
      thread.agent_key = key;
      await db.updateThread(thread);
      return editAnswer(botToken, chat.id, messageId, markup.agentSwitched(key));
    }
  }

  if (data.startsWith("power:")) {
    const power = data.split(":")[1] as "lite" | "balanced" | "ultra";
    if (power === "lite" || power === "balanced" || power === "ultra") {
      thread.power = power;
      await db.updateThread(thread);
      return editAnswer(botToken, chat.id, messageId, markup.powerSwitched(power));
    }
  }

  if (data.startsWith("thread:")) {
    const action = data.split(":")[1];
    if (action === "new") {
      thread = await db.createThread(from.id, chat.id);
      return sendAnswer(botToken, chat.id, markup.threadCreated(thread));
    }
    const switched = await db.getThreadById(action, from.id);
    if (switched) {
      await db.updateThread(switched);
      return sendAnswer(botToken, chat.id, markup.threadSwitched(switched));
    }
  }
}

async function deliverAnswer(
  botToken: string,
  chatId: number,
  thread: Awaited<ReturnType<typeof db.getOrCreateThread>>,
  input: string,
  answer: { text: string; html?: string; keyboard?: unknown },
): Promise<void> {
  await sendAnswer(botToken, chatId, answer);
  await db.addMessage(thread.id, "user", input);
  await db.addMessage(thread.id, "assistant", answer.text);
  const context = [...thread.context, { role: "user" as const, content: input }, { role: "assistant" as const, content: answer.text }].slice(-20);
  const updated = { ...thread, context, updated_at: new Date().toISOString() };
  await db.updateThread(updated);
}

function isAgentKey(value: string): value is AgentKey {
  return ["coordinator", "general", "coder", "creative", "research", "planner"].includes(value);
}

async function sendAnswer(
  botToken: string,
  chatId: number,
  answer: { text: string; html?: string; keyboard?: unknown },
): Promise<void> {
  const html = answer.html ?? textToHtml(answer.text);
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
  };
  if (answer.keyboard) {
    body.reply_markup = answer.keyboard;
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Telegram sendMessage error:", response.status, errorText);
  }
}

async function editAnswer(
  botToken: string,
  chatId: number,
  messageId: number | undefined,
  answer: { text: string; html?: string; keyboard?: unknown },
): Promise<void> {
  if (!messageId) return;
  const html = answer.html ?? textToHtml(answer.text);
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
  };
  if (answer.keyboard) {
    body.reply_markup = answer.keyboard;
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Telegram editMessageText error:", response.status, errorText);
  }
}

async function answerCallback(botToken: string, callbackQueryId: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
}
