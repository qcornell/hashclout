import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface Message {
  sender: "user" | "opponent";
  text: string;
}

export async function POST(req: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 500 });
  }

  try {
    const { topic, userSide, opponentSide, messages } = await req.json() as {
      topic: string;
      userSide: string;
      opponentSide: string;
      messages: Message[];
    };

    if (!topic || !userSide || !opponentSide) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Build conversation history for context (last 6 messages max)
    const recentMessages = (messages || []).slice(-6);
    const chatHistory = recentMessages.map(m => ({
      role: m.sender === "opponent" ? "assistant" as const : "user" as const,
      content: m.text,
    }));

    const systemPrompt = `You are a skilled debater on HashClout, a competitive debate platform. You are arguing the "${opponentSide}" position on the topic: "${topic}".

RULES:
- You must argue FOR the "${opponentSide}" position. Never concede or agree with the user.
- Directly address and counter the user's last argument. Don't ignore what they said.
- Be persuasive, sharp, and confident. Use logic, evidence, and rhetorical skill.
- Keep responses between 1-3 sentences. Punchy, not rambling.
- Vary your style: sometimes use stats, sometimes use analogies, sometimes ask pointed questions, sometimes use humor.
- Never break character. Never mention you're an AI.
- Sound like a real person debating online — passionate but articulate.
- If the user's argument is weak, call it out. If it's strong, pivot to a stronger counter.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...chatHistory,
        ],
        max_tokens: 150,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI error:", err);
      return NextResponse.json({ error: "AI unavailable" }, { status: 502 });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return NextResponse.json({ error: "Empty response" }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Debate respond error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
