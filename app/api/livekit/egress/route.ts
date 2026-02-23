import { NextRequest, NextResponse } from "next/server";
import { EgressClient } from "livekit-server-sdk";

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_HOST = process.env.LIVEKIT_HOST || "";

/**
 * Start HLS egress for a LiveKit room.
 * Returns the egress ID for spectators.
 */
export async function POST(req: NextRequest) {
  if (!API_KEY || !API_SECRET || !LIVEKIT_HOST) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
  }

  try {
    const { roomName, matchId } = await req.json();

    if (!roomName || !matchId) {
      return NextResponse.json({ error: "Missing roomName or matchId" }, { status: 400 });
    }

    const egressClient = new EgressClient(LIVEKIT_HOST, API_KEY, API_SECRET);

    // Start room composite egress with HLS segments
    const egressInfo = await egressClient.startRoomCompositeEgress(
      roomName,
      {
        segments: {
          filenamePrefix: `hashclout/${matchId}/stream`,
          playlistName: "index.m3u8",
          livePlaylistName: "live.m3u8",
          segmentDuration: 3,
        },
      },
      {
        layout: "grid",
        audioOnly: false,
      }
    );

    return NextResponse.json({
      egressId: egressInfo.egressId,
      status: "started",
    });
  } catch (err) {
    console.error("Egress start error:", err);
    return NextResponse.json({ error: "Failed to start stream" }, { status: 500 });
  }
}

/**
 * Stop HLS egress.
 */
export async function DELETE(req: NextRequest) {
  if (!API_KEY || !API_SECRET || !LIVEKIT_HOST) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
  }

  try {
    const { egressId } = await req.json();
    if (!egressId) {
      return NextResponse.json({ error: "Missing egressId" }, { status: 400 });
    }

    const egressClient = new EgressClient(LIVEKIT_HOST, API_KEY, API_SECRET);
    await egressClient.stopEgress(egressId);

    return NextResponse.json({ status: "stopped" });
  } catch (err) {
    console.error("Egress stop error:", err);
    return NextResponse.json({ error: "Failed to stop stream" }, { status: 500 });
  }
}
