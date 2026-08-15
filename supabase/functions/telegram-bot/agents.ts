import type { AgentAnswer, AgentKey, LLMConfig, MessageRecord, PowerProfile, Thread } from "./types.ts";
import * as markup from "./markup.ts";
import { callLLM, powerSystemInstruction } from "./llm.ts";

export const AGENTS: { key: AgentKey; label: string; description: string }[] = [
  { key: "coordinator", label: "Командир", description: "Сам выбирает подходящего агента и координирует команду." },
  { key: "general", label: "Общий", description: "Общие вопросы, помощь и нейтральные ответы." },
  { key: "coder", label: "Кодер", description: "Код, архитектура, отладка, технические задачи." },
  { key: "creative", label: "Творец", description: "Тексты, идеи, креатив, сценарии, маркетинг." },
  { key: "research", label: "Исследователь", description: "Факты, объяснения, поиск, анализ тем." },
  { key: "planner", label: "Планировщик", description: "Планы, шаги, роадмапы, приоритеты." },
];

const CODER_KEYWORDS = [
  "код", "script", "python", "javascript", "typescript", "js", "ts", "react", "node",
  "sql", "docker", "api", "баг", "bug", "error", "функция", "класс", "backend", "frontend",
  "html", "css", "http", "json", "xml", "git", "npm", "express", "fastapi", "django", "flask",
  "csharp", "java", "kotlin", "swift", "go", "rust", "php", "ruby", "perl", "bash",
];

const CREATIVE_KEYWORDS = [
  "напиши", "story", "creative", "реклама", "пост", "стих", "сказка", "идея", "slogan",
  "текст", "описание", "сценарий", "книга", "blog", "статья", "email", "письмо", "придумай",
];

const RESEARCH_KEYWORDS = [
  "найди", "кто такой", "что такое", "explain", "how does", "как работает", "research",
  "summary", "объясни", "расскажи про", "опиши", "википедия", "define", "meaning", "значение",
];

const PLANNER_KEYWORDS = [
  "план", "plan", "шаги", "roadmap", "steps", "todo", "организуй", "список дел", "календарь",
  "priorities", "приоритеты", "расписание", "deadline", "сроки",
];

const TEAM_KEYWORDS = [
  "team", "команда", "все агенты", "multi-agent", "multiagent", "соберитесь", "совещание",
  "мнение команды", "коллективно",
];

export function detectAgent(text: string): AgentKey {
  const lower = text.toLowerCase();
  if (matchesAny(lower, TEAM_KEYWORDS)) return "coordinator";
  if (matchesAny(lower, CODER_KEYWORDS)) return "coder";
  if (matchesAny(lower, PLANNER_KEYWORDS)) return "planner";
  if (matchesAny(lower, CREATIVE_KEYWORDS)) return "creative";
  if (matchesAny(lower, RESEARCH_KEYWORDS)) return "research";
  return "general";
}

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

const AGENT_PROMPTS: Record<AgentKey, string> = {
  coordinator:
    "Ты — командир команды агентов. Определи, какой вопрос задан, и ответь как лучший специалист. Если просят командное мнение, кратко дай взгляды Coder, Creative, Researcher, Planner и общий вывод.",
  general: "Ты — полезный ассистент. Отвечай дружелюбно и по существу.",
  coder:
    "Ты — опытный программист. Помогаешь кодом, архитектурой, отладкой, ревью и объяснением технических концепций. Используй примеры кода на языке, о котором спрашивают.",
  creative:
    "Ты — креативный ассистент. Пишешь тексты, истории, слоганы, маркетинговые посты и генерируешь идеи. Адаптируй стиль под запрос пользователя.",
  research:
    "Ты — исследователь. Даёшь факты, объясняешь концепции, структурируешь знания. Если не уверен — честно говоришь об этом.",
  planner:
    "Ты — планировщик. Разбиваешь задачи на конкретные шаги, расставляешь приоритеты и предлагаешь сроки.",
};

function systemPrompt(agentKey: AgentKey, power: PowerProfile): string {
  const base = AGENT_PROMPTS[agentKey];
  const powerInstruction = powerSystemInstruction(power);
  return `${base}\n\n${powerInstruction}\n\nОтвечай на русском языке, если не просят иное.`;
}

export async function routeAndAnswer(
  thread: Thread,
  input: string,
  llm: LLMConfig,
): Promise<AgentAnswer> {
  const agentKey = thread.agent_key === "coordinator" ? detectAgent(input) : thread.agent_key;
  return answerWithAgent(agentKey, thread, input, llm);
}

async function answerWithAgent(
  agentKey: AgentKey,
  thread: Thread,
  input: string,
  llm: LLMConfig,
): Promise<AgentAnswer> {
  const prompt = systemPrompt(agentKey, thread.power);
  const messages: MessageRecord[] = [
    { role: "system", content: prompt },
    ...thread.context,
    { role: "user", content: input },
  ];

  const llmText = await callLLM(llm, messages, thread.power);
  if (llmText) {
    return { text: llmText };
  }

  return fallbackAnswer(agentKey, thread, input);
}

export async function teamAnswer(
  thread: Thread,
  input: string,
  llm: LLMConfig,
): Promise<AgentAnswer> {
  const prompt =
    `Ты — командир команды агентов. Для запроса пользователя собери мнение специалистов: Кодер (техническая сторона), Исследователь (факты и контекст), Творец (креативная сторона) и Планировщик (шаги и порядок действий).\n\n${powerSystemInstruction(thread.power)}\n\nОтвечай на русском. Формат:\n• Кодер: ...\n• Исследователь: ...\n• Творец: ...\n• Планировщик: ...\n• Общий вывод: ...`;

  const messages: MessageRecord[] = [
    { role: "system", content: prompt },
    ...thread.context,
    { role: "user", content: input },
  ];

  const llmText = await callLLM(llm, messages, thread.power);
  if (llmText) {
    return { text: llmText };
  }

  return fallbackTeamAnswer(input);
}

function fallbackAnswer(agentKey: AgentKey, thread: Thread, input: string): AgentAnswer {
  const powerNote =
    thread.power === "lite"
      ? "\n(режим «Лёгкий» — ответы короткие)"
      : thread.power === "ultra"
      ? "\n(режим «Максимум» — ответы развёрнутые)"
      : "";

  switch (agentKey) {
    case "coder":
      return {
        text:
          `Кодер на связи. Пиши задачу, язык или фрагмент кода — разберём.\n\nКраткая подсказка: начни с языка (Python, JS, TS, SQL...) и того, что должно получиться.${powerNote}`,
      };
    case "creative":
      return {
        text:
          `Творец готов. Опиши, что нужно написать: пост, историю, сценарий, слоган, описание товара или идею для проекта.${powerNote}`,
      };
    case "research":
      return {
        text:
          `Исследователь на связи. Спроси о фактах, технологиях, понятиях или событиях — дам контекст и структуру.${powerNote}`,
      };
    case "planner":
      return {
        text:
          `Планировщик готов. Опиши цель и ограничения (сроки, ресурсы), и я составлю пошаговый план.${powerNote}`,
      };
    case "coordinator":
      return {
        text:
          `Командир на связи. Я сам выберу, к какому агенту обратиться, или соберу команду. Просто напиши задачу.${powerNote}`,
      };
    default:
      return {
        text:
          `Привет! Я команда агентов. Напиши задачу или выбери агента через меню. Сейчас выбран агент «${markup.AGENT_LABELS[thread.agent_key]}» и режим «${markup.POWER_LABELS[thread.power]}».`,
      };
  }
}

function fallbackTeamAnswer(input: string): AgentAnswer {
  return {
    text: `Командир собрал мнение команды:\n\n• Кодер: задача выглядит технической; если это код — уточни язык и фреймворк.\n• Исследователь: нужно больше контекста, чтобы дать точные факты.\n• Творец: можно сделать красивую формулировку, когда поймём цель.\n• Планировщик: как только цель ясна, разобью на шаги.\n\nОбщий вывод: уточни задачу чуть подробнее — и команда выдаст решение.`,
  };
}
