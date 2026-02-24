import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use service role for server-side writes (bypasses RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface AIScores {
  on_topic_score: number;     // 0–100
  clarity_score: number;      // 0–100
  answered_questions_score: number; // 0–100
  toxicity_detected: boolean;
  quality_bonus_xp: number;   // 0–3000
}

interface FeedbackResult {
  feedbackWinner: string;
  feedbackLoser: string;
  scores: AIScores;
}

/**
 * POST /api/ai-pipeline
 *
 * Called AFTER a debate ends. Runs asynchronously:
 *   1. Fetch all messages for the match
 *   2. Build transcript
 *   3. Run moderation + quality scoring via GPT
 *   4. Generate personalized win/loss feedback
 *   5. Store results in DB
 *
 * Body: { matchId }
 *
 * Does NOT determine the winner. Only scores quality + generates feedback.
 */
export async function POST(req: NextRequest) {
  try {
    const { matchId } = await req.json();
    if (!matchId) {
      return NextResponse.json({ error: "Missing matchId" }, { status: 400 });
    }

    // 1. Fetch match data
    const { data: match, error: matchErr } = await supabaseAdmin
      .from("matches")
      .select("*, player_a:profiles!matches_player_a_fkey(id, username, display_name), player_b:profiles!matches_player_b_fkey(id, username, display_name)")
      .eq("id", matchId)
      .single();

    if (matchErr || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Mark as processing
    await supabaseAdmin
      .from("matches")
      .update({ status: "processing_ai" })
      .eq("id", matchId);

    // 2. Fetch all messages
    const { data: messages } = await supabaseAdmin
      .from("match_messages")
      .select("sender_id, content, round, created_at")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true });

    const msgs = messages || [];
    const playerA = match.player_a;
    const playerB = match.player_b;

    // 3. Build transcript
    let transcript = msgs.map(m => {
      const name = m.sender_id === playerA?.id
        ? (playerA?.display_name || "Player A")
        : (playerB?.display_name || "Player B");
      return `[${m.round || "?"}] ${name}: ${m.content}`;
    }).join("\n");

    // 4. AI analysis (skip if no API key — give default scores)
    let scores: AIScores = {
      on_topic_score: 70,
      clarity_score: 70,
      answered_questions_score: 60,
      toxicity_detected: false,
      quality_bonus_xp: 1500,
    };
    let feedbackWinner = "Great debate! You made compelling arguments and earned this win. Keep that momentum going! 🏆";
    let feedbackLoser = "Close one! You showed real potential out there. Focus on addressing your opponent's points more directly next time, and you'll be taking W's in no time. 💪";

    // For video debates with no text messages, create a summary transcript
    if (msgs.length === 0 && match.format === "video") {
      const paName = playerA?.display_name || "Player A";
      const pbName = playerB?.display_name || "Player B";
      transcript = `[Video Debate - No text transcript available]\nTopic: ${match.topic}\nFormat: Video (3-round structured debate with opening statements, rapid fire, and closing arguments)\n${paName} vs ${pbName}\nWinner: ${match.winner === playerA?.id ? paName : match.winner === playerB?.id ? pbName : "Tie/No winner determined yet"}`;
    }

    if (OPENAI_API_KEY && (msgs.length > 0 || match.format === "video")) {
      try {
        const result = await runAIAnalysis(
          transcript,
          match.topic || "Unknown topic",
          playerA?.display_name || "Player A",
          playerB?.display_name || "Player B",
          match.winner === playerA?.id ? "A" : match.winner === playerB?.id ? "B" : null,
        );
        scores = result.scores;
        feedbackWinner = result.feedbackWinner;
        feedbackLoser = result.feedbackLoser;
      } catch (err) {
        console.error("AI analysis failed, using defaults:", err);
      }
    }

    // 5. Store results
    const isWinnerA = match.winner === playerA?.id;
    const isWinnerB = match.winner === playerB?.id;

    await supabaseAdmin
      .from("matches")
      .update({
        status: "final",
        transcript_text: transcript,
        ai_scores: scores,
        ai_quality_bonus: scores.quality_bonus_xp,
        moderation_flags: scores.toxicity_detected ? { toxicity: true } : null,
        ai_feedback_a: isWinnerA ? feedbackWinner : feedbackLoser,
        ai_feedback_b: isWinnerB ? feedbackWinner : feedbackLoser,
      })
      .eq("id", matchId);

    // 6. Handle toxicity strikes
    if (scores.toxicity_detected) {
      // Check who was toxic (simplified: flag both if any toxicity detected)
      // In a real system, you'd score each player separately
      for (const playerId of [playerA?.id, playerB?.id].filter(Boolean)) {
        if (!playerId) continue;
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("strike_count")
          .eq("id", playerId)
          .single();

        if (profile) {
          await supabaseAdmin
            .from("profiles")
            .update({ strike_count: (profile.strike_count || 0) + 1 })
            .eq("id", playerId);
        }
      }
    }

    return NextResponse.json({
      status: "final",
      scores,
      ai_quality_bonus: scores.quality_bonus_xp,
      toxicity: scores.toxicity_detected,
    });
  } catch (err) {
    console.error("AI pipeline error:", err);
    return NextResponse.json({ error: "Pipeline failed" }, { status: 500 });
  }
}

/**
 * Run GPT analysis on debate transcript.
 * Returns quality scores + personalized feedback.
 */
async function runAIAnalysis(
  transcript: string,
  topic: string,
  playerAName: string,
  playerBName: string,
  winnerSide: "A" | "B" | null,
): Promise<FeedbackResult> {
  const systemPrompt = `You are an expert debate judge and coach on HashClout, a competitive debate platform.

Analyze this debate transcript and provide:
1. Quality scores for the overall debate
2. Personalized feedback for the winner (hype them up, be enthusiastic, specific about what they did well)
3. Personalized feedback for the loser (be compassionate, encouraging, give specific actionable advice on what they could improve)

Topic: "${topic}"
Players: ${playerAName} (Player A) vs ${playerBName} (Player B)
${winnerSide ? `Winner: Player ${winnerSide}` : "Result: Tie"}

IMPORTANT:
- You do NOT decide the winner. The audience vote already determined that.
- Your scores assess overall debate quality only.
- quality_bonus_xp MUST be between 0–3000.
- If any message contains hate speech, threats, or extreme toxicity, set toxicity_detected to true and quality_bonus_xp to 0.
- Winner feedback should be 2-3 sentences, energetic and specific.
- Loser feedback should be 2-3 sentences, kind and constructive with specific advice.

Respond in EXACTLY this JSON format (no markdown, no code blocks):
{
  "on_topic_score": <0-100>,
  "clarity_score": <0-100>,
  "answered_questions_score": <0-100>,
  "toxicity_detected": <true/false>,
  "quality_bonus_xp": <0-3000>,
  "feedback_winner": "<personalized winner message>",
  "feedback_loser": "<personalized loser message>"
}`;

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
        { role: "user", content: `Debate transcript:\n\n${transcript.slice(0, 6000)}` },
      ],
      max_tokens: 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content?.trim();

  if (!raw) throw new Error("Empty AI response");

  // Parse JSON — handle potential markdown wrapping
  const jsonStr = raw.replace(/^```json?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(jsonStr);

  return {
    scores: {
      on_topic_score: clamp(parsed.on_topic_score || 50, 0, 100),
      clarity_score: clamp(parsed.clarity_score || 50, 0, 100),
      answered_questions_score: clamp(parsed.answered_questions_score || 50, 0, 100),
      toxicity_detected: !!parsed.toxicity_detected,
      quality_bonus_xp: parsed.toxicity_detected
        ? 0
        : clamp(parsed.quality_bonus_xp || 0, 0, 3000),
    },
    feedbackWinner: parsed.feedback_winner || "Amazing debate! You earned this win! 🏆",
    feedbackLoser: parsed.feedback_loser || "Great effort! Keep debating and you'll keep improving. 💪",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
