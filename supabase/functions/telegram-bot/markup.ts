import type { AgentAnswer, AgentKey, InlineButton, PowerProfile, Thread } from "./types.ts";

export const AGENT_LABELS: Record<AgentKey, string> = {
  coordinator: "Командир",
  general: "Общий",
  coder: "Кодер",
  creative: "Творец",
  research: "Исследователь",
  planner: "Планировщик",
};

export const POWER_LABELS: Record<PowerProfile, string> = {
  lite: "Лёгкий",
  balanced: "Сбалансированный",
  ultra: "Максимум",
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function textToHtml(text: string): string {
  // Split into code blocks and inline code first to avoid escaping them.
  const parts: string[] = [];
  let cursor = 0;
  const blockRegex = /```([\s\S]*?)```/g;
  const inlineRegex = /`([^`]+)`/g;
  let match: RegExpExecArray | null;

  // Process fenced code blocks
  const blocks: Array<{ start: number; end: number; replacement: string }> = [];
  while ((match = blockRegex.exec(text)) !== null) {
    const raw = match[1];
    const lines = raw.split("\n");
    const code = lines[0].match(/^\s*\w+\s*$/) ? lines.slice(1).join("\n") : raw;
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      replacement: `<pre><code>${escapeHtml(code)}</code></pre>`,
    });
  }

  // Process inline code
  const inlines: Array<{ start: number; end: number; replacement: string }> = [];
  while ((match = inlineRegex.exec(text)) !== null) {
    // Skip inline codes that are inside fenced blocks
    if (blocks.some((b) => b.start <= match!.index && match!.index < b.end)) continue;
    inlines.push({
      start: match.index,
      end: match.index + match[0].length,
      replacement: `<code>${escapeHtml(match[1])}</code>`,
    });
  }

  const segments = [...blocks, ...inlines].sort((a, b) => a.start - b.start);

  for (const seg of segments) {
    if (seg.start > cursor) {
      parts.push(formatPlain(text.slice(cursor, seg.start)));
    }
    parts.push(seg.replacement);
    cursor = seg.end;
  }
  if (cursor < text.length) {
    parts.push(formatPlain(text.slice(cursor)));
  }

  return parts.join("");
}

function formatPlain(chunk: string): string {
  return escapeHtml(chunk);
}

function kb(rows: InlineButton[][]): object {
  return { inline_keyboard: rows.map((row) => row) };
}

export function mainMenu(): AgentAnswer {
  return {
    text: "Главное меню",
    html: `<b>Главное меню</b>\n\nВыбери раздел:`,
    keyboard: kb([
      [
        { text: "Агенты", callback_data: "menu:agents" },
        { text: "Потоки", callback_data: "menu:threads" },
        { text: "Мощность", callback_data: "menu:power" },
      ],
      [{ text: "Помощь", callback_data: "menu:help" }],
    ]),
  };
}

export function welcomeMessage(): AgentAnswer {
  return {
    text:
      "Добро пожаловать в AgentTeam Bot. Я команда специализированных агентов. Пиши вопросы, переключай режимы мощности и веди несколько потоков.",
    html: `<b>Добро пожаловать в AgentTeam Bot</b>\n\nЯ — команда специализированных агентов. Можешь писать мне вопросы, переключать режимы «мощности» и вести несколько разных потоков-чатов.\n\n<i>Выбери агента, мощность или просто напиши задачу — я сам пойму, к кому обратиться.</i>`,
    keyboard: mainMenu().keyboard,
  };
}

export function agentsMenu(current: AgentKey): AgentAnswer {
  const order: AgentKey[] = ["coordinator", "general", "coder", "creative", "research", "planner"];
  const rows: InlineButton[][] = [];
  for (let i = 0; i < order.length; i += 2) {
    const row: InlineButton[] = [];
    for (const key of order.slice(i, i + 2)) {
      const label = AGENT_LABELS[key] + (key === current ? " ✓" : "");
      row.push({ text: label, callback_data: `agent:${key}` });
    }
    rows.push(row);
  }
  rows.push([{ text: "Назад", callback_data: "menu:main" }]);
  return {
    text: "Выбор агента",
    html: `<b>Выбор агента</b>\n\nСейчас выбран: <code>${AGENT_LABELS[current]}</code>`,
    keyboard: kb(rows),
  };
}

export function powerMenu(current: PowerProfile): AgentAnswer {
  const order: PowerProfile[] = ["lite", "balanced", "ultra"];
  const rows: InlineButton[][] = [];
  for (const p of order) {
    rows.push([
      {
        text: POWER_LABELS[p] + (p === current ? " ✓" : ""),
        callback_data: `power:${p}`,
      },
    ]);
  }
  rows.push([{ text: "Назад", callback_data: "menu:main" }]);
  return {
    text: "Настройка мощности",
    html: `<b>Мощность</b>\n\nСейчас: <code>${POWER_LABELS[current]}</code>\n\n• <b>Лёгкий</b> — короткие ответы, экономно.\n• <b>Сбалансированный</b> — понятно и по делу.\n• <b>Максимум</b> — развёрнуто, с примерами и деталями.`,
    keyboard: kb(rows),
  };
}

export function threadsMenu(threads: Thread[], currentId: string): AgentAnswer {
  const rows: InlineButton[][] = [];
  for (const t of threads.slice(0, 8)) {
    const label = `${t.id === currentId ? "✓ " : ""}${t.title}`;
    rows.push([{ text: label, callback_data: `thread:${t.id}` }]);
  }
  rows.push([
    { text: "+ Новый поток", callback_data: "thread:new" },
    { text: "Назад", callback_data: "menu:main" },
  ]);
  return {
    text: "Мои потоки",
    html: `<b>Мои потоки</b>\n\nВыбери поток или создай новый. Каждый поток живёт независимо со своим контекстом.`,
    keyboard: kb(rows),
  };
}

export function helpMessage(): AgentAnswer {
  return {
    text: "Помощь по командам",
    html: `<b>Помощь</b>\n\n/start — начать\n/agents — выбрать агента\n/power — мощность ответа\n/threads — мои потоки\n/newthread — новый поток\n/help — это сообщение\n\n<b>Агенты:</b>\n• Командир — сам выбирает, какой агент подходит.\n• Кодер — код, архитектура, отладка.\n• Творец — тексты, идеи, реклама.\n• Исследователь — факты, объяснения, поиск.\n• Планировщик — планы, шаги, роадмапы.`,
    keyboard: kb([[{ text: "Главное меню", callback_data: "menu:main" }]]),
  };
}

export function threadCreated(thread: Thread): AgentAnswer {
  return {
    text: `Создан новый поток: ${thread.title}`,
    html: `<b>Создан новый поток</b>: <code>${escapeHtml(thread.title)}</code>\n\nТеперь сообщения будут храниться отдельно.`,
    keyboard: mainMenu().keyboard,
  };
}

export function agentSwitched(agentKey: AgentKey): AgentAnswer {
  return {
    text: `Выбран агент: ${AGENT_LABELS[agentKey]}`,
    html: `<b>Агент переключён:</b> ${escapeHtml(AGENT_LABELS[agentKey])}`,
    keyboard: mainMenu().keyboard,
  };
}

export function powerSwitched(power: PowerProfile): AgentAnswer {
  return {
    text: `Мощность: ${POWER_LABELS[power]}`,
    html: `<b>Мощность:</b> ${escapeHtml(POWER_LABELS[power])}`,
    keyboard: mainMenu().keyboard,
  };
}

export function threadSwitched(thread: Thread): AgentAnswer {
  return {
    text: `Переключено на поток: ${thread.title}`,
    html: `<b>Переключено на поток:</b> <code>${escapeHtml(thread.title)}</code>\n\nАгент: ${AGENT_LABELS[thread.agent_key]} | Мощность: ${POWER_LABELS[thread.power]}`,
    keyboard: mainMenu().keyboard,
  };
}
