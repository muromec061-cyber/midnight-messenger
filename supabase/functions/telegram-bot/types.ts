export type PowerProfile = "lite" | "balanced" | "ultra";

export type AgentKey =
  | "coordinator"
  | "general"
  | "coder"
  | "creative"
  | "research"
  | "planner";

export interface MessageRecord {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Thread {
  id: string;
  user_id: number;
  chat_id: number;
  title: string;
  agent_key: AgentKey;
  power: PowerProfile;
  context: MessageRecord[];
  created_at: string;
  updated_at: string;
}

export interface AgentAnswer {
  /** Plain text for context / history */
  text: string;
  /** Optional pre-formatted HTML for Telegram */
  html?: string;
  keyboard?: unknown;
}

export interface LLMConfig {
  enabled: boolean;
  type: "minimax" | "openai" | "none";
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: {
    chat: TelegramChat;
    message_id: number;
  };
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}
