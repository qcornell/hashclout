import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
  message: string | null;
}

/**
 * Moderate a debate message using OpenAI Moderation API.
 * Free to use — no token cost.
 */
export async function POST(req: NextRequest) {
  if (!OPENAI_API_KEY) {
    // If no key, let everything through (fail open)
    return NextResponse.json({ flagged: false, categories: [], message: null });
  }

  try {
    const { text } = await req.json() as { text: string };

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ flagged: false, categories: [], message: null });
    }

    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: text,
      }),
    });

    if (!response.ok) {
      // Fail open — don't block users if API is down
      console.error("Moderation API error:", await response.text());
      return NextResponse.json({ flagged: false, categories: [], message: null });
    }

    const data = await response.json();
    const result = data.results?.[0];

    if (!result) {
      return NextResponse.json({ flagged: false, categories: [], message: null });
    }

    const flaggedCategories: string[] = [];
    if (result.categories) {
      for (const [category, flagged] of Object.entries(result.categories)) {
        if (flagged) flaggedCategories.push(category);
      }
    }

    // Determine severity and message
    let message: string | null = null;
    if (result.flagged) {
      const hasViolence = flaggedCategories.some(c => c.includes("violence"));
      const hasHate = flaggedCategories.some(c => c.includes("hate"));
      const hasSexual = flaggedCategories.some(c => c.includes("sexual"));
      const hasHarassment = flaggedCategories.some(c => c.includes("harassment"));
      const hasSelfHarm = flaggedCategories.some(c => c.includes("self-harm"));

      if (hasViolence || hasSelfHarm) {
        message = "This message contains content that violates our safety guidelines. Please keep the debate respectful.";
      } else if (hasHate) {
        message = "Hate speech is not allowed on HashClout. Debate the ideas, not the person.";
      } else if (hasHarassment) {
        message = "Personal attacks aren't allowed. Focus on making strong arguments instead.";
      } else if (hasSexual) {
        message = "Please keep the conversation appropriate and on-topic.";
      } else {
        message = "This message was flagged by our content filter. Please rephrase your argument.";
      }
    }

    return NextResponse.json({
      flagged: result.flagged,
      categories: flaggedCategories,
      message,
    });
  } catch (err) {
    console.error("Moderation error:", err);
    // Fail open
    return NextResponse.json({ flagged: false, categories: [], message: null });
  }
}
