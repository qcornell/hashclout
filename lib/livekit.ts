/**
 * LiveKit configuration — client-side constants.
 * Server URL and API keys are in .env.local (server-side only).
 */

// This is the public WebSocket URL for LiveKit Cloud (or self-hosted)
export const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || "";

/**
 * Room naming convention: hashclout-{matchId}
 */
export function getRoomName(matchId: string): string {
  return `hashclout-${matchId}`;
}
