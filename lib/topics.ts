import { supabase } from "./supabase";

export interface Topic {
  id: string;
  title: string;
  description: string | null;
  category: string;
  yes_label: string;
  no_label: string;
  is_active: boolean;
  is_featured: boolean;
  total_debates: number;
  created_at: string;
}

/** Get the current featured topic (or a random active one if none featured) */
export async function getFeaturedTopic(): Promise<Topic | null> {
  // Try featured first — use .maybeSingle() to avoid error when no rows
  const { data: featured, error } = await supabase
    .from("topics")
    .select("*")
    .eq("is_active", true)
    .eq("is_featured", true)
    .limit(1)
    .maybeSingle();

  if (featured && !error) return featured as Topic;

  // Fallback: random active topic
  return getRandomTopic();
}

/** Get a random active topic */
export async function getRandomTopic(): Promise<Topic | null> {
  const { data: all } = await supabase
    .from("topics")
    .select("*")
    .eq("is_active", true);

  if (!all || all.length === 0) return null;
  return all[Math.floor(Math.random() * all.length)] as Topic;
}

/** Get all active topics */
export async function getAllTopics(): Promise<Topic[]> {
  const { data } = await supabase
    .from("topics")
    .select("*")
    .eq("is_active", true)
    .order("total_debates", { ascending: false });

  return (data || []) as Topic[];
}

/** Get topics by category */
export async function getTopicsByCategory(category: string): Promise<Topic[]> {
  const { data } = await supabase
    .from("topics")
    .select("*")
    .eq("is_active", true)
    .eq("category", category)
    .order("total_debates", { ascending: false });

  return (data || []) as Topic[];
}

/** Increment debate count for a topic */
export async function incrementTopicDebates(topicId: string): Promise<void> {
  // Use raw update since we don't have an RPC
  const { data: topic } = await supabase
    .from("topics")
    .select("total_debates")
    .eq("id", topicId)
    .single();

  if (topic) {
    await supabase
      .from("topics")
      .update({ total_debates: topic.total_debates + 1 })
      .eq("id", topicId);
  }
}
