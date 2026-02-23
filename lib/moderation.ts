export interface ModerationResult {
  flagged: boolean;
  categories: string[];
  message: string | null;
}

/**
 * Check a message against the moderation API.
 * Returns { flagged, categories, message }.
 * Fails open — if API is unreachable, returns not flagged.
 */
export async function moderateMessage(text: string): Promise<ModerationResult> {
  try {
    const res = await fetch("/api/moderate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) return { flagged: false, categories: [], message: null };

    return await res.json();
  } catch {
    return { flagged: false, categories: [], message: null };
  }
}
