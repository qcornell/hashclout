import { NextRequest, NextResponse } from "next/server";
import { EgressClient, EncodedFileOutput, SegmentedFileOutput } from "livekit-server-sdk";

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_HOST = process.env.LIVEKIT_HOST || ""; // e.g. https://your-project.livekit.cloud

/**
 * Start HLS egress for a LiveKit room.
 * Returns the HLS playlist URL for spectators.
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

    // Start room composite egress with HLS output
    const output = new SegmentedFileOutput({
      filenamePrefix: `hashclout/${matchId}/stream`,
      playlistName: "index.m3u8",
      filenameSuffix: SegmentedFileOutput.LivekitSegmentedFileSuffix.INDEX,
      livePlaylistName: "live.m3u8",
    });

    const egressInfo = await egressClient.startRoomCompositeEgress(
      roomName,
      { segments: output },
      {
        layout: "grid",
        audioOnly: false,
      }
    );

    return NextResponse.json({
      egressId: egressInfo.egressId,
      // HLS URL will be available once egress starts producing segments
      // The exact URL depends on your LiveKit egress output config (S3, GCS, etc.)
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
