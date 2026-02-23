"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Eye, Loader2 } from "lucide-react";

interface HlsSpectatorProps {
  hlsUrl: string;
  matchId: string;
}

export default function HlsSpectator({ hlsUrl, matchId }: HlsSpectatorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!hlsUrl || !videoRef.current) return;

    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error("HLS fatal error:", data);
          setError(true);
          setLoading(false);
        }
      });

      return () => {
        hls.destroy();
      };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = hlsUrl;
      video.addEventListener("loadedmetadata", () => {
        setLoading(false);
        video.play().catch(() => {});
      });
      video.addEventListener("error", () => {
        setError(true);
        setLoading(false);
      });
    } else {
      setError(true);
      setLoading(false);
    }
  }, [hlsUrl]);

  return (
    <div style={s.container}>
      {loading && !error && (
        <div style={s.overlay}>
          <Loader2 size={28} color="#ff7a45" style={{ animation: "mmq-spin .6s linear infinite" }} />
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.45)", fontWeight: 600, marginTop: 10 }}>
            Loading live stream...
          </div>
        </div>
      )}

      {error && (
        <div style={s.overlay}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📡</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,.45)" }}>Stream not available yet</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.25)", marginTop: 4 }}>HLS stream may take a moment to start. Refresh to try again.</div>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        controls
        style={{ ...s.video, display: loading || error ? "none" : "block" }}
      />

      {!loading && !error && (
        <div style={s.liveBadge}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "#ff4d3d" }} />
          LIVE
        </div>
      )}

      <style>{`@keyframes mmq-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    position: "relative", borderRadius: 16, overflow: "hidden",
    background: "#0a0a10", border: "2px solid rgba(255,255,255,.06)",
    aspectRatio: "16/9", width: "100%",
  },
  video: {
    width: "100%", height: "100%", objectFit: "cover",
    background: "#000",
  },
  overlay: {
    position: "absolute" as const, inset: 0,
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    background: "rgba(10,10,16,.95)",
  },
  liveBadge: {
    position: "absolute" as const, top: 12, left: 12,
    padding: "4px 12px", borderRadius: 8,
    background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)",
    fontSize: 10, fontWeight: 800, color: "#ff4d3d",
    display: "flex", alignItems: "center", gap: 5,
  },
};
