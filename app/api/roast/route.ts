import { NextRequest, NextResponse } from "next/server";

/**
 * Roast Mode — CLOUTBOT generates a playful comeback roast.
 *
 * Hard content rules (in the system prompt): the bot roasts the user's WORDS,
 * takes, username and the bit — never their physical appearance, and never any
 * protected trait. Keeps clips funny + shareable instead of cruel/abusive.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SAFETY_RULES = `
HARD RULES — never break these:
- Roast their WORDS, their take, their roast attempt, their username, their overconfidence, or the situation. Make it about the bit.
- NEVER comment on or insult physical appearance, body, face, weight, height, or how they look.
- NEVER attack race, ethnicity, nationality, gender, sexuality, religion, disability, age, or any protected trait.
- No slurs, no hate, no sexual content, no threats, no self-harm references. Keep it PG-13.
- Punchy: 1-2 sentences MAX. Clever and playful, like a comedy-roast friend — not genuinely mean.
- If their input is empty, weak, or just a greeting, roast how weak their opener was.`;

export async function POST(req: NextRequest) {
  if (!OPENAI_API_KEY) {
    return NextResponse.json({ reply: "My circuits are offline, but trust me — that was roastable." });
  }

  try {
    const body = await req.json();
    const mode: "roast" | "verdict" = body.mode === "verdict" ? "verdict" : "roast";
    const username = typeof body.username === "string" ? body.username.slice(0, 40) : "challenger";

    let systemPrompt: string;
    let userPrompt: string;
    let maxTokens = 90;

    if (mode === "verdict") {
      const transcript = typeof body.transcript === "string" ? body.transcript.slice(0, 2000) : "";
      systemPrompt = `You are CLOUTBOT 3000, a witty roast-battle robot host on HashClout. The battle is over. Give a final verdict on how the human ("${username}") did. Return ONLY JSON: {"score": <1-10>, "line": "<one punchy 1-2 sentence verdict, playful>"}.
${SAFETY_RULES}`;
      userPrompt = `Here is the roast battle transcript:\n${transcript}\n\nRate the human's roasting 1-10 and give a final playful verdict line.`;
      maxTokens = 120;
    } else {
      const userRoast = typeof body.userRoast === "string" ? body.userRoast.slice(0, 400) : "";
      const round = Number(body.round) || 1;
      systemPrompt = `You are CLOUTBOT 3000, a witty roast-battle robot on HashClout. The human "${username}" just tried to roast you. Fire back ONE savage-but-playful comeback roast. You are a confident, comedic AI that thinks it is hilarious.
${SAFETY_RULES}`;
      userPrompt = `Round ${round}. The human's roast at you: "${userRoast || "(they said nothing — weak)"}"\n\nRoast them back.`;
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.95,
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ reply: "Lag got me. Consider yourself spared… this round." });
    }

    const data = await res.json();
    const content = (data.choices?.[0]?.message?.content || "").trim();

    if (mode === "verdict") {
      try {
        const jsonStr = content.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
        const parsed = JSON.parse(jsonStr);
        const score = Math.max(1, Math.min(10, Math.round(Number(parsed.score) || 5)));
        return NextResponse.json({ reply: parsed.line || "Not bad for a human.", score });
      } catch {
        return NextResponse.json({ reply: content || "Decent effort, carbon-based life form.", score: 6 });
      }
    }

    return NextResponse.json({ reply: content || "That was so weak my fans stopped spinning." });
  } catch {
    return NextResponse.json({ reply: "Error 404: your roast not found." });
  }
}
