"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteParticipant,
  type LocalTrackPublication,
} from "livekit-client";
import { LIVEKIT_URL, getRoomName } from "./livekit";

export interface LiveKitConnectOptions {
  matchId: string;
  participantId: string;
  participantName: string;
  videoStream: MediaStream;
}

export interface UseLiveKitRoomResult {
  room: Room | null;
  remoteVideoTrack: RemoteTrack | null;
  remoteAudioTrack: RemoteTrack | null;
  connected: boolean;
  connect: (opts: LiveKitConnectOptions) => Promise<void>;
  disconnect: () => void;
  setCameraEnabled: (enabled: boolean) => void;
}

/**
 * React hook that manages a LiveKit room connection for 2-player video debate.
 * - Fetches a token from /api/livekit/token
 * - Connects to the room
 * - Publishes local video+audio from the existing MediaStream
 * - Subscribes to remote participant tracks
 */
export function useLiveKitRoom(): UseLiveKitRoomResult {
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<RemoteTrack | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<RemoteTrack | null>(null);

  const handleTrackSubscribed = useCallback(
    (track: RemoteTrack, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Video) {
        setRemoteVideoTrack(track);
      } else if (track.kind === Track.Kind.Audio) {
        setRemoteAudioTrack(track);
      }
    },
    [],
  );

  const handleTrackUnsubscribed = useCallback(
    (track: RemoteTrack, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
      if (track.kind === Track.Kind.Video) {
        setRemoteVideoTrack((prev) => (prev === track ? null : prev));
      } else if (track.kind === Track.Kind.Audio) {
        setRemoteAudioTrack((prev) => (prev === track ? null : prev));
      }
    },
    [],
  );

  const handleDisconnected = useCallback(() => {
    setConnected(false);
    setRemoteVideoTrack(null);
    setRemoteAudioTrack(null);
  }, []);

  const connectToRoom = useCallback(
    async (opts: LiveKitConnectOptions) => {
      if (roomRef.current) return; // already connected

      const roomName = getRoomName(opts.matchId);

      // 1. Fetch token
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomName,
          participantName: opts.participantName,
          participantId: opts.participantId,
        }),
      });

      if (!res.ok) {
        console.error("Failed to get LiveKit token:", await res.text());
        return;
      }

      const { token } = await res.json();

      // 2. Create room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;

      // 3. Attach event listeners
      room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.on(RoomEvent.Disconnected, handleDisconnected);

      // 4. Connect
      try {
        await room.connect(LIVEKIT_URL, token);
        setConnected(true);
      } catch (err) {
        console.error("Failed to connect to LiveKit room:", err);
        roomRef.current = null;
        return;
      }

      // 5. Publish local tracks from the existing MediaStream
      const videoTracks = opts.videoStream.getVideoTracks();
      const audioTracks = opts.videoStream.getAudioTracks();

      try {
        if (videoTracks.length > 0) {
          await room.localParticipant.publishTrack(videoTracks[0], {
            source: Track.Source.Camera,
          });
        }
        if (audioTracks.length > 0) {
          await room.localParticipant.publishTrack(audioTracks[0], {
            source: Track.Source.Microphone,
          });
        }
      } catch (err) {
        console.error("Failed to publish local tracks:", err);
      }

      // 6. Check if remote participant already in room (joined before us)
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((pub) => {
          if (pub.track && pub.isSubscribed) {
            if (pub.track.kind === Track.Kind.Video) setRemoteVideoTrack(pub.track as RemoteTrack);
            else if (pub.track.kind === Track.Kind.Audio) setRemoteAudioTrack(pub.track as RemoteTrack);
          }
        });
      });
    },
    [handleTrackSubscribed, handleTrackUnsubscribed, handleDisconnected],
  );

  const disconnectFromRoom = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
      room.off(RoomEvent.Disconnected, handleDisconnected);
      room.disconnect(false); // don't stop tracks — page.tsx owns the MediaStream
      roomRef.current = null;
    }
    setConnected(false);
    setRemoteVideoTrack(null);
    setRemoteAudioTrack(null);
  }, [handleTrackSubscribed, handleTrackUnsubscribed, handleDisconnected]);

  const setCameraEnabled = useCallback((enabled: boolean) => {
    const room = roomRef.current;
    if (!room) return;

    const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
    if (camPub) {
      if (enabled) {
        (camPub as LocalTrackPublication).unmute();
      } else {
        (camPub as LocalTrackPublication).mute();
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const room = roomRef.current;
      if (room) {
        room.disconnect(false);
        roomRef.current = null;
      }
    };
  }, []);

  return {
    room: roomRef.current,
    remoteVideoTrack,
    remoteAudioTrack,
    connected,
    connect: connectToRoom,
    disconnect: disconnectFromRoom,
    setCameraEnabled,
  };
}
