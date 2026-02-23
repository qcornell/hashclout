"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrackPublication,
  LocalParticipant,
  ConnectionState,
} from "livekit-client";
import { LIVEKIT_URL, getRoomName } from "@/lib/livekit";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from "lucide-react";

interface VideoRoomProps {
  matchId: string;
  userId: string;
  userName: string;
  isPlayerA: boolean;
  onDisconnect?: () => void;
}

export default function VideoRoom({ matchId, userId, userName, isPlayerA, onDisconnect }: VideoRoomProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [remoteConnected, setRemoteConnected] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Get token and connect
  useEffect(() => {
    if (!LIVEKIT_URL || !matchId || !userId) {
      setConnecting(false);
      return;
    }

    const roomName = getRoomName(matchId);
    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    setRoom(newRoom);

    // Fetch token from our API
    fetch("/api/livekit/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomName, participantName: userName, participantId: userId }),
    })
      .then(r => r.json())
      .then(async ({ token, error }) => {
        if (error || !token) {
          console.error("Token error:", error);
          setConnecting(false);
          return;
        }

        try {
          await newRoom.connect(LIVEKIT_URL, token);
          setConnected(true);
          setConnecting(false);

          // Publish local tracks
          await newRoom.localParticipant.enableCameraAndMicrophone();

          // Attach local video
          const localVideo = newRoom.localParticipant.getTrackPublication(Track.Source.Camera);
          if (localVideo?.track && localVideoRef.current) {
            localVideo.track.attach(localVideoRef.current);
          }
        } catch (err) {
          console.error("Connection error:", err);
          setConnecting(false);
        }
      })
      .catch(err => {
        console.error("Token fetch error:", err);
        setConnecting(false);
      });

    // Handle remote participant
    newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
        track.attach(remoteVideoRef.current);
      }
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        document.body.appendChild(el);
      }
      setRemoteConnected(true);
    });

    newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach();
    });

    newRoom.on(RoomEvent.ParticipantDisconnected, () => {
      setRemoteConnected(false);
    });

    newRoom.on(RoomEvent.Disconnected, () => {
      setConnected(false);
      onDisconnect?.();
    });

    // Start egress for spectators
    if (isPlayerA) {
      // Only player A triggers egress to avoid double-start
      fetch("/api/livekit/egress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomName, matchId }),
      }).catch(err => console.warn("Egress start failed:", err));
    }

    return () => {
      newRoom.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, userId]);

  // Toggle mic
  const toggleMic = useCallback(async () => {
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(!micEnabled);
    setMicEnabled(!micEnabled);
  }, [room, micEnabled]);

  // Toggle camera
  const toggleCam = useCallback(async () => {
    if (!room) return;
    await room.localParticipant.setCameraEnabled(!camEnabled);
    setCamEnabled(!camEnabled);
  }, [room, camEnabled]);

  // Disconnect
  const handleDisconnect = useCallback(() => {
    room?.disconnect();
    onDisconnect?.();
  }, [room, onDisconnect]);

  return (
    <div style={s.container}>
      {/* Video feeds */}
      <div style={s.videoGrid}>
        {/* Remote (opponent) — large */}
        <div style={s.remoteWrap}>
          {remoteConnected ? (
            <video ref={remoteVideoRef} autoPlay playsInline style={s.remoteVideo} />
          ) : (
            <div style={s.remotePlaceholder}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.35)", fontWeight: 600 }}>
                {connecting ? "Connecting..." : "Waiting for opponent..."}
              </div>
            </div>
          )}

          {/* Remote label */}
          <div style={s.remoteLabel}>
            {remoteConnected ? "🔴 LIVE" : "Waiting..."}
          </div>
        </div>

        {/* Local (self) — picture-in-picture */}
        <div style={s.localWrap}>
          {connecting ? (
            <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%" }}>
              <Loader2 size={20} color="#ff7a45" style={{ animation: "mmq-spin .6s linear infinite" }} />
            </div>
          ) : (
            <video ref={localVideoRef} autoPlay muted playsInline style={s.localVideo} />
          )}
          <div style={s.localLabel}>You</div>
        </div>
      </div>

      {/* Controls */}
      <div style={s.controls}>
        <button onClick={toggleMic} style={{ ...s.controlBtn, background: micEnabled ? "rgba(255,255,255,.08)" : "rgba(255,77,61,.20)", borderColor: micEnabled ? "rgba(255,255,255,.10)" : "rgba(255,77,61,.30)" }}>
          {micEnabled ? <Mic size={20} color="rgba(255,255,255,.80)" /> : <MicOff size={20} color="#ff4d3d" />}
        </button>
        <button onClick={toggleCam} style={{ ...s.controlBtn, background: camEnabled ? "rgba(255,255,255,.08)" : "rgba(255,77,61,.20)", borderColor: camEnabled ? "rgba(255,255,255,.10)" : "rgba(255,77,61,.30)" }}>
          {camEnabled ? <Video size={20} color="rgba(255,255,255,.80)" /> : <VideoOff size={20} color="#ff4d3d" />}
        </button>
        <button onClick={handleDisconnect} style={{ ...s.controlBtn, background: "rgba(255,77,61,.15)", borderColor: "rgba(255,77,61,.25)" }}>
          <PhoneOff size={20} color="#ff4d3d" />
        </button>
      </div>

      <style>{`@keyframes mmq-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    display: "flex", flexDirection: "column", height: "100%",
    borderRadius: 18, overflow: "hidden", background: "#0a0a10",
    border: "2px solid rgba(255,255,255,.06)",
    position: "relative",
  },
  videoGrid: {
    flex: 1, position: "relative", minHeight: 0,
  },
  remoteWrap: {
    position: "absolute", inset: 0, display: "flex",
    alignItems: "center", justifyContent: "center",
    background: "radial-gradient(ellipse at center, rgba(115,47,109,.06), #0a0a10 60%)",
  },
  remoteVideo: {
    width: "100%", height: "100%", objectFit: "cover",
  },
  remotePlaceholder: {
    textAlign: "center" as const,
  },
  remoteLabel: {
    position: "absolute" as const, top: 14, left: 14,
    padding: "4px 12px", borderRadius: 8,
    background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)",
    fontSize: 11, fontWeight: 800, color: "#ff4d3d",
    display: "flex", alignItems: "center", gap: 6,
  },
  localWrap: {
    position: "absolute" as const, bottom: 80, right: 14,
    width: 140, height: 105, borderRadius: 12, overflow: "hidden",
    border: "2px solid rgba(255,255,255,.12)",
    background: "rgba(0,0,0,.4)", boxShadow: "0 10px 30px rgba(0,0,0,.5)",
  },
  localVideo: {
    width: "100%", height: "100%", objectFit: "cover",
    transform: "scaleX(-1)", // mirror
  },
  localLabel: {
    position: "absolute" as const, bottom: 4, left: 8,
    fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.60)",
  },
  controls: {
    display: "flex", justifyContent: "center", gap: 12,
    padding: "14px 20px",
    background: "linear-gradient(0deg, rgba(0,0,0,.8), rgba(0,0,0,.3))",
    position: "absolute" as const, bottom: 0, left: 0, right: 0,
  },
  controlBtn: {
    width: 48, height: 48, borderRadius: 999,
    border: "1px solid", display: "grid", placeItems: "center",
    cursor: "pointer", transition: "transform .15s",
  },
};
