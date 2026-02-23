import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;

/**
 * Generate a LiveKit access token for a debater.
 * Only debaters get tokens — spectators watch via HLS.
 */
export async function POST(req: NextRequest) {
  if (!API_KEY || !API_SECRET) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
  }

  try {
    const { roomName, participantName, participantId } = await req.json();

    if (!roomName || !participantName || !participantId) {
      return NextResponse.json({ error: "Missing roomName, participantName, or participantId" }, { status: 400 });
    }

    const token = new AccessToken(API_KEY, API_SECRET, {
      identity: participantId,
      name: participantName,
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();

    return NextResponse.json({ token: jwt });
  } catch (err) {
    console.error("Token generation error:", err);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}
