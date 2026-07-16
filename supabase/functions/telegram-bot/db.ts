import { createClient } from "npm:@supabase/supabase-js@2";
import type { MessageRecord, Thread } from "./types.ts";

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!client) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export async function getOrCreateThread(userId: number, chatId: number): Promise<Thread> {
  const supabase = getClient();
  const { data: rows, error: selectError } = await supabase
    .from("telegram_threads")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (selectError) {
    console.error("select thread error:", selectError);
    throw selectError;
  }

  if (rows && rows.length > 0) {
    return rows[0] as Thread;
  }

  const title = `Поток #1`;
  const { data: inserted, error: insertError } = await supabase
    .from("telegram_threads")
    .insert({
      user_id: userId,
      chat_id: chatId,
      title,
      agent_key: "coordinator",
      power: "balanced",
      context: [],
    })
    .select()
    .single();

  if (insertError) {
    console.error("insert thread error:", insertError);
    throw insertError;
  }

  return inserted as Thread;
}

export async function listThreads(userId: number): Promise<Thread[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("telegram_threads")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("list threads error:", error);
    throw error;
  }

  return (data ?? []) as Thread[];
}

export async function getThreadById(id: string, userId: number): Promise<Thread | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("telegram_threads")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("get thread error:", error);
    throw error;
  }

  return data as Thread;
}

export async function createThread(userId: number, chatId: number): Promise<Thread> {
  const supabase = getClient();
  const existing = await listThreads(userId);
  const title = `Поток #${existing.length + 1}`;
  const { data, error } = await supabase
    .from("telegram_threads")
    .insert({
      user_id: userId,
      chat_id: chatId,
      title,
      agent_key: "coordinator",
      power: "balanced",
      context: [],
    })
    .select()
    .single();

  if (error) {
    console.error("create thread error:", error);
    throw error;
  }

  return data as Thread;
}

export async function updateThread(thread: Thread): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from("telegram_threads")
    .update({
      title: thread.title,
      agent_key: thread.agent_key,
      power: thread.power,
      context: thread.context,
      updated_at: new Date().toISOString(),
    })
    .eq("id", thread.id);

  if (error) {
    console.error("update thread error:", error);
    throw error;
  }
}

export async function addMessage(threadId: string, role: MessageRecord["role"], content: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from("telegram_messages")
    .insert({ thread_id: threadId, role, content });

  if (error) {
    console.error("add message error:", error);
    throw error;
  }
}

export async function appendContext(thread: Thread, record: MessageRecord): Promise<Thread> {
  const context = [...thread.context, record].slice(-20);
  const updated = { ...thread, context, updated_at: new Date().toISOString() };
  await updateThread(updated);
  return updated;
}
