import { NextRequest, NextResponse } from "next/server";

/**
 * Fact Check API — uses GPT-4o-mini to verify a debate claim.
 * ~$0.001-0.003 per call.
 */
export async function POST(req: NextRequest) {
  try {
    const { claim } = await req.json();

    if (!claim || typeof claim !== "string" || claim.length < 12 || claim.length > 120) {
      return NextResponse.json({ error: "Invalid claim" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const systemPrompt = `You are a debate fact-checker for a competitive live debate platform called HashClout.

Given a claim made during a debate, respond with a JSON object only. No markdown, no explanation outside the JSON.

Rules:
- Be decisive. Pick a clear verdict when possible.
- If the claim is a well-known fact or well-known falsehood, judge it clearly.
- If the claim is an opinion, exaggeration, or too vague to verify, mark it appropriately.
- Keep context to ONE sentence max.
- Do NOT hedge or be wishy-washy. This is entertainment — verdicts should feel definitive.

Response format:
{
  "verdict": "FACTS" | "FAKE_NEWS" | "STRETCH" | "UNVERIFIABLE",
  "context": "One sentence explaining the verdict."
}

Verdict meanings:
- FACTS: The claim is substantially true and verifiable.
- FAKE_NEWS: The claim is clearly false, a misquote, or a debunked myth.
- STRETCH: The claim has a kernel of truth but is misleading, exaggerated, or missing critical context.
- UNVERIFIABLE: The claim is an opinion, too vague, or cannot be fact-checked.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Claim to fact-check: "${claim}"` },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[FACT-CHECK] OpenAI error:", errText);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    // Parse JSON from response
    try {
      // Handle potential markdown wrapping
      const jsonStr = content.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
      const result = JSON.parse(jsonStr);

      // Validate verdict
      const validVerdicts = ["FACTS", "FAKE_NEWS", "STRETCH", "UNVERIFIABLE"];
      if (!validVerdicts.includes(result.verdict)) {
        result.verdict = "UNVERIFIABLE";
      }

      return NextResponse.json({
        verdict: result.verdict,
        context: result.context || "No additional context available.",
      });
    } catch {
      console.error("[FACT-CHECK] Failed to parse AI response:", content);
      return NextResponse.json({
        verdict: "UNVERIFIABLE",
        context: "Unable to verify this claim at this time.",
      });
    }
  } catch (err) {
    console.error("[FACT-CHECK] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
