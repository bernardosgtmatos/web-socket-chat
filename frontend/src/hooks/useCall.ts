import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { User, CallParticipant } from '../types';

interface ParticipantsPayload {
  roomId: string;
  participants: Array<{ userId: string; username: string; socketId: string }>;
}

interface UserJoinedPayload {
  roomId: string;
  userId: string;
  username: string;
  socketId: string;
}

interface UserLeftPayload {
  roomId: string;
  socketId: string;
  userId: string;
}

interface SignalPayload {
  from: string;
  fromUserId?: string;
  roomId?: string;
  to?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface MutedPayload {
  roomId: string;
  socketId: string;
  muted: boolean;
}

interface ScreenPayload {
  roomId: string;
  socketId: string;
  userId?: string;
  username?: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function useCall(socket: Socket | null, roomId: string | null, user: User | null) {
  const [inCall, setInCall] = useState(false);
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [muted, setMuted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [speaking, setSpeaking] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [selfId, setSelfId] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(socket);
  const roomIdRef = useRef<string | null>(roomId);
  const userRef = useRef<User | null>(user);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const inCallRef = useRef<boolean>(false);

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceQueuesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Record<string, boolean>>({});

  useEffect(() => { socketRef.current = socket; }, [socket]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  useEffect(() => { inCallRef.current = inCall; }, [inCall]);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { screenStreamRef.current = screenStream; }, [screenStream]);

  useEffect(() => {
    if (!socket) { setSelfId(null); return; }
    const update = () => setSelfId(socket.id ?? null);
    update();
    socket.on('connect', update);
    return () => { socket.off('connect', update); };
  }, [socket]);

  const createPc = useCallback((remoteId: string): RTCPeerConnection => {
    const existing = pcsRef.current.get(remoteId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(remoteId, pc);
    makingOfferRef.current[remoteId] = false;
    iceQueuesRef.current.set(remoteId, []);

    const addStreamTracks = (stream: MediaStream | null) => {
      if (!stream) return;
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    };
    addStreamTracks(localStreamRef.current);
    addStreamTracks(screenStreamRef.current);

    pc.ontrack = (event) => {
      const track = event.track;
      if (track) {
        track.onended = () => {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            const stream = next.get(remoteId);
            if (stream) stream.removeTrack(track);
            return next;
          });
        };
      }
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        const stream = next.get(remoteId) ?? new MediaStream();
        const incoming = event.streams[0]?.getTracks() ?? [];
        const tracks = incoming.length ? incoming : (track ? [track] : []);
        for (const t of tracks) {
          if (!stream.getTracks().some((x) => x.id === t.id)) stream.addTrack(t);
        }
        if (track && !stream.getTracks().some((x) => x.id === track.id)) {
          stream.addTrack(track);
        }
        next.set(remoteId, stream);
        return next;
      });
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const s = socketRef.current;
      const r = roomIdRef.current;
      if (s && r) s.emit('webrtc:ice', { roomId: r, to: remoteId, candidate: event.candidate });
    };

    pc.onnegotiationneeded = async () => {
      try {
        makingOfferRef.current[remoteId] = true;
        await pc.setLocalDescription();
        const s = socketRef.current;
        const r = roomIdRef.current;
        if (s && r) s.emit('webrtc:offer', { roomId: r, to: remoteId, sdp: pc.localDescription });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'negotiation failed');
      } finally {
        makingOfferRef.current[remoteId] = false;
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pc.close();
        pcsRef.current.delete(remoteId);
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(remoteId);
          return next;
        });
      }
    };

    return pc;
  }, []);

  const drainIce = useCallback(async (remoteId: string, pc: RTCPeerConnection) => {
    const queue = iceQueuesRef.current.get(remoteId) ?? [];
    iceQueuesRef.current.set(remoteId, []);
    for (const c of queue) {
      try { await pc.addIceCandidate(c); } catch { /* ignore */ }
    }
  }, []);

  const handleOffer = useCallback(async (payload: SignalPayload) => {
    const remoteId = payload.from;
    const pc = pcsRef.current.get(remoteId) ?? createPc(remoteId);
    const polite = (socketRef.current?.id ?? '') > remoteId;
    const makingOffer = makingOfferRef.current[remoteId] ?? false;
    const offerCollision = makingOffer || pc.signalingState !== 'stable';
    const ignore = !polite && offerCollision;
    if (ignore) return;
    try {
      if (polite && offerCollision) {
        try { await pc.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit); } catch { /* ignore */ }
      }
      await pc.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
      await drainIce(remoteId, pc);
      if (payload.sdp?.type === 'offer') {
        await pc.setLocalDescription();
        const s = socketRef.current;
        const r = roomIdRef.current;
        if (s && r) s.emit('webrtc:answer', { roomId: r, to: remoteId, sdp: pc.localDescription });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to handle offer');
    }
  }, [createPc, drainIce]);

  const handleAnswer = useCallback(async (payload: SignalPayload) => {
    const remoteId = payload.from;
    const pc = pcsRef.current.get(remoteId) ?? createPc(remoteId);
    if (pc.signalingState !== 'have-local-offer') return;
    try {
      await pc.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
      await drainIce(remoteId, pc);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to handle answer');
    }
  }, [createPc, drainIce]);

  const handleIce = useCallback(async (payload: SignalPayload) => {
    const remoteId = payload.from;
    const pc = pcsRef.current.get(remoteId) ?? createPc(remoteId);
    const candidate = payload.candidate;
    if (!candidate) return;
    if (pc.remoteDescription) {
      try { await pc.addIceCandidate(candidate); } catch { /* ignore */ }
    } else {
      const q = iceQueuesRef.current.get(remoteId) ?? [];
      q.push(candidate);
      iceQueuesRef.current.set(remoteId, q);
    }
  }, [createPc]);

  const joinCall = useCallback(async () => {
    const s = socketRef.current;
    const r = roomIdRef.current;
    if (!s || !r) { setError('not connected'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setMuted(false);
      setInCall(true);
      inCallRef.current = true;
      setSelfId(s.id ?? null);
      s.emit('call:join', { roomId: r });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to access microphone');
    }
  }, []);

  const stopScreenShareInternal = useCallback(() => {
    const stream = screenStreamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((t) => t.stop());
    for (const pc of pcsRef.current.values()) {
      const sender = pc.getSenders().find((snd) => snd.track && stream.getTracks().includes(snd.track));
      if (sender) pc.removeTrack(sender);
    }
    screenStreamRef.current = null;
    setScreenStream(null);
    setSharing(false);
    const s = socketRef.current;
    const r = roomIdRef.current;
    if (s && r) s.emit('screen:stop', { roomId: r });
  }, []);

  const startScreenShare = useCallback(async () => {
    const s = socketRef.current;
    const r = roomIdRef.current;
    if (!s || !r) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 960, height: 540, frameRate: 30 },
        audio: false,
      } as MediaStreamConstraints);
      const track = stream.getVideoTracks()[0];
      try { await track.applyConstraints({ width: 960, height: 540, frameRate: 30 }); } catch { /* ignore */ }

      for (const pc of pcsRef.current.values()) {
        const sender = pc.addTrack(track, stream);
        try {
          const params = sender.getParameters();
          if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
          params.encodings[0].maxBitrate = 1_000_000;
          params.encodings[0].maxFramerate = 30;
          await sender.setParameters(params);
        } catch { /* ignore */ }
      }

      track.onended = () => { stopScreenShareInternal(); };

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setSharing(true);
      s.emit('screen:start', { roomId: r });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to share screen');
    }
  }, [stopScreenShareInternal]);

  const toggleScreenShare = useCallback(() => {
    if (screenStreamRef.current) stopScreenShareInternal();
    else void startScreenShare();
  }, [startScreenShare, stopScreenShareInternal]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const newMuted = !track.enabled;
    setMuted(newMuted);
    const s = socketRef.current;
    const r = roomIdRef.current;
    if (s && r) s.emit('call:mute', { roomId: r, muted: newMuted });
  }, []);

  const leaveCall = useCallback(() => {
    const s = socketRef.current;
    const r = roomIdRef.current;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    iceQueuesRef.current.clear();
    makingOfferRef.current = {};

    localStreamRef.current = null;
    screenStreamRef.current = null;
    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams(new Map());
    setParticipants([]);
    setMuted(false);
    setSharing(false);
    setSpeaking({});
    setInCall(false);
    inCallRef.current = false;

    if (s && r) s.emit('call:leave', { roomId: r });
  }, []);

  // Speaking detection
  useEffect(() => {
    if (!inCall) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const analysers: Array<{ id: string; analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }> = [];

    if (localStream) {
      try {
        const src = ctx.createMediaStreamSource(localStream);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        analysers.push({ id: selfId ?? socketRef.current?.id ?? '', analyser: an, data: new Uint8Array(an.frequencyBinCount) });
      } catch { /* ignore */ }
    }
    remoteStreams.forEach((stream, id) => {
      try {
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        analysers.push({ id, analyser: an, data: new Uint8Array(an.frequencyBinCount) });
      } catch { /* ignore */ }
    });

    const interval = window.setInterval(() => {
      const next: Record<string, boolean> = {};
      for (const a of analysers) {
        a.analyser.getByteFrequencyData(a.data);
        let sum = 0;
        for (let i = 0; i < a.data.length; i++) sum += a.data[i];
        const avg = a.data.length ? sum / a.data.length : 0;
        const isSelf = a.id === (selfId ?? socketRef.current?.id ?? '');
        next[a.id] = !(isSelf && muted) && avg > 15;
      }
      setSpeaking(next);
    }, 200);

    return () => {
      window.clearInterval(interval);
      void ctx.close();
    };
  }, [inCall, localStream, remoteStreams, selfId]);

  // Event listeners
  useEffect(() => {
    const s = socket;
    if (!s) return;

    const onParticipants = (p: ParticipantsPayload) => {
      setParticipants(p.participants.map((x) => ({
        userId: x.userId, username: x.username, socketId: x.socketId, muted: false, sharing: false,
      })));
      for (const x of p.participants) {
        if (x.socketId !== s.id) createPc(x.socketId);
      }
    };

    const onUserJoined = (p: UserJoinedPayload) => {
      setParticipants((prev) => {
        if (prev.some((x) => x.socketId === p.socketId)) return prev;
        return [...prev, { userId: p.userId, username: p.username, socketId: p.socketId, muted: false, sharing: false }];
      });
      if (p.socketId !== s.id) createPc(p.socketId);
    };

    const onUserLeft = (p: UserLeftPayload) => {
      setParticipants((prev) => prev.filter((x) => x.socketId !== p.socketId));
      const pc = pcsRef.current.get(p.socketId);
      if (pc) { pc.close(); pcsRef.current.delete(p.socketId); }
      setRemoteStreams((prev) => { const next = new Map(prev); next.delete(p.socketId); return next; });
      setSpeaking((prev) => { const next = { ...prev }; delete next[p.socketId]; return next; });
    };

    const onOffer = (p: SignalPayload) => { void handleOffer(p); };
    const onAnswer = (p: SignalPayload) => { void handleAnswer(p); };
    const onIce = (p: SignalPayload) => { void handleIce(p); };

    const onMuted = (p: MutedPayload) => {
      setParticipants((prev) => prev.map((x) => (x.socketId === p.socketId ? { ...x, muted: p.muted } : x)));
    };

    const onScreenStarted = (p: ScreenPayload) => {
      setParticipants((prev) => prev.map((x) => (x.socketId === p.socketId ? { ...x, sharing: true } : x)));
    };

    const onScreenStopped = (p: ScreenPayload) => {
      setParticipants((prev) => prev.map((x) => (x.socketId === p.socketId ? { ...x, sharing: false } : x)));
    };

    const onError = (e: { message?: string }) => {
      if (e?.message) setError(e.message);
    };

    s.on('call:participants', onParticipants);
    s.on('call:user-joined', onUserJoined);
    s.on('call:user-left', onUserLeft);
    s.on('webrtc:offer', onOffer);
    s.on('webrtc:answer', onAnswer);
    s.on('webrtc:ice', onIce);
    s.on('call:muted', onMuted);
    s.on('screen:started', onScreenStarted);
    s.on('screen:stopped', onScreenStopped);
    s.on('error', onError);

    return () => {
      s.off('call:participants', onParticipants);
      s.off('call:user-joined', onUserJoined);
      s.off('call:user-left', onUserLeft);
      s.off('webrtc:offer', onOffer);
      s.off('webrtc:answer', onAnswer);
      s.off('webrtc:ice', onIce);
      s.off('call:muted', onMuted);
      s.off('screen:started', onScreenStarted);
      s.off('screen:stopped', onScreenStopped);
      s.off('error', onError);
    };
  }, [socket, createPc, handleOffer, handleAnswer, handleIce]);

  const prevRoomIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevRoomIdRef.current;
    prevRoomIdRef.current = roomId;
    if (prev !== null && prev !== roomId && inCallRef.current) {
      socketRef.current?.emit('call:leave', { roomId: prev });
    }
    if (prev !== roomId) {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      iceQueuesRef.current.clear();
      makingOfferRef.current = {};
      localStreamRef.current = null;
      screenStreamRef.current = null;
      setLocalStream(null);
      setScreenStream(null);
      setRemoteStreams(new Map());
      setParticipants([]);
      setMuted(false);
      setSharing(false);
      setSpeaking({});
      setInCall(false);
      inCallRef.current = false;
    }
  }, [roomId]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (inCallRef.current && roomIdRef.current) {
        socketRef.current?.emit('call:leave', { roomId: roomIdRef.current });
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
    };
  }, []);

  return {
    inCall,
    participants,
    localStream,
    screenStream,
    remoteStreams,
    muted,
    sharing,
    speaking,
    error,
    selfId,
    joinCall,
    leaveCall,
    toggleMute,
    toggleScreenShare,
  };
}
