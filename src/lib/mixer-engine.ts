/**
 * MixerEngine - Core Web Audio Mix Bus
 * 
 * This module provides a complete audio mixing solution that sits on top
 * of the existing WebRTC pipeline. Instead of routing a single MediaStream
 * into the RTCPeerConnection, we route an AudioContext-powered mix bus
 * whose output goes into the peer connection.
 * 
 * Audio Flow:
 * Mic Source ──┐
 *              ├──► GainNode ──► MixBus (DestinationNode) ──► RTCPeerConnection
 * System Src ──┤
 *              │
 * Background ──┘
 */

export type ChannelType = 'mic' | 'system' | 'background' | 'master';

export interface MixerChannel {
  id: string;
  label: string;
  type: ChannelType;
  gainNode: GainNode;
  analyserNode: AnalyserNode;
  sourceNode: MediaStreamAudioSourceNode;
  stream: MediaStream;
  isMuted: boolean;
  volume: number;
  deviceId?: string;
}

export interface MixerEngineConfig {
  sampleRate?: number;
}

export class MixerEngine {
  private audioCtx: AudioContext;
  private destination: MediaStreamAudioDestinationNode;
  private masterGain: GainNode;
  private masterAnalyser: AnalyserNode;
  private channels: Map<string, MixerChannel> = new Map();
  private isDestroyed: boolean = false;

  constructor(config?: MixerEngineConfig) {
    const sampleRate = config?.sampleRate || 44100;
    
    const existingCtx = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (existingCtx) {
      this.audioCtx = new existingCtx() as AudioContext;
    } else {
      this.audioCtx = new AudioContext({ sampleRate });
    }
    
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.destination = this.audioCtx.createMediaStreamDestination();
    
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 1.0;
    
    this.masterAnalyser = this.audioCtx.createAnalyser();
    this.masterAnalyser.fftSize = 256;
    this.masterAnalyser.smoothingTimeConstant = 0.8;
    
    this.masterGain.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.destination);
  }

  get outputStream(): MediaStream {
    return this.destination.stream;
  }

  get context(): AudioContext {
    return this.audioCtx;
  }

  get allChannels(): MixerChannel[] {
    return Array.from(this.channels.values());
  }

  getChannel(id: string): MixerChannel | undefined {
    return this.channels.get(id);
  }

  addChannel(id: string, label: string, type: ChannelType, stream: MediaStream, deviceId?: string): MixerChannel {
    if (this.isDestroyed) {
      throw new Error('MixerEngine has been destroyed');
    }

    if (this.channels.has(id)) {
      console.warn(`[MixerEngine] Channel ${id} already exists, replacing...`);
      this.removeChannel(id);
    }

    const sourceNode = this.audioCtx.createMediaStreamSource(stream);
    
    const gainNode = this.audioCtx.createGain();
    gainNode.gain.value = 0.75;
    
    const analyserNode = this.audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.8;

    sourceNode.connect(gainNode);
    gainNode.connect(analyserNode);
    analyserNode.connect(this.masterGain);

    const channel: MixerChannel = {
      id,
      label,
      type,
      gainNode,
      analyserNode,
      sourceNode,
      stream,
      isMuted: false,
      volume: 75,
      deviceId,
    };

    this.channels.set(id, channel);
    return channel;
  }

  removeChannel(id: string): void {
    const channel = this.channels.get(id);
    if (!channel) return;

    channel.sourceNode.disconnect();
    channel.gainNode.disconnect();
    channel.analyserNode.disconnect();

    channel.stream.getTracks().forEach(track => track.stop());

    this.channels.delete(id);
  }

  setVolume(id: string, volume: number): void {
    const channel = this.channels.get(id);
    if (!channel) return;

    const clampedVolume = Math.max(0, Math.min(100, volume));
    channel.volume = clampedVolume;

    const gainValue = (clampedVolume / 100) * 1.5;
    
    const currentTime = this.audioCtx.currentTime;
    channel.gainNode.gain.setTargetAtTime(gainValue, currentTime, 0.02);
  }

  setMute(id: string, muted: boolean): void {
    const channel = this.channels.get(id);
    if (!channel) return;

    channel.isMuted = muted;
    
    const currentTime = this.audioCtx.currentTime;
    const targetGain = muted ? 0 : (channel.volume / 100) * 1.5;
    channel.gainNode.gain.setTargetAtTime(targetGain, currentTime, 0.02);
  }

  getLevel(id: string): number {
    const channel = this.channels.get(id);
    if (!channel) return 0;

    return this.calculateLevel(channel.analyserNode);
  }

  getMasterLevel(): number {
    return this.calculateLevel(this.masterAnalyser);
  }

  private calculateLevel(analyser: AnalyserNode): number {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = dataArray[i] / 255;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    return Math.min(1, rms * 2);
  }

  replaceSource(id: string, newStream: MediaStream, newDeviceId?: string): void {
    const channel = this.channels.get(id);
    if (!channel) return;

    channel.sourceNode.disconnect();

    const newSourceNode = this.audioCtx.createMediaStreamSource(newStream);
    newSourceNode.connect(channel.gainNode);

    channel.sourceNode = newSourceNode;
    channel.stream = newStream;
    if (newDeviceId !== undefined) {
      channel.deviceId = newDeviceId;
    }
  }

  setLabel(id: string, label: string): void {
    const channel = this.channels.get(id);
    if (!channel) return;

    channel.label = label;
  }

  setMasterVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(100, volume));
    const gainValue = (clampedVolume / 100) * 1.5;
    
    const currentTime = this.audioCtx.currentTime;
    this.masterGain.gain.setTargetAtTime(gainValue, currentTime, 0.02);
  }

  getState(): AudioContextState {
    return this.audioCtx.state;
  }

  async resume(): Promise<void> {
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  destroy(): void {
    if (this.isDestroyed) return;

    this.channels.forEach((_, id) => {
      this.removeChannel(id);
    });

    this.masterGain.disconnect();
    this.masterAnalyser.disconnect();
    this.destination.disconnect();

    this.audioCtx.close().catch(() => {});

    this.isDestroyed = true;
  }

  get destroyed(): boolean {
    return this.isDestroyed;
  }
}

export function createMixerEngine(config?: MixerEngineConfig): MixerEngine {
  return new MixerEngine(config);
}

export async function captureMicSource(deviceId?: string): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: deviceId
      ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      : { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  };
  return navigator.mediaDevices.getUserMedia(constraints);
}

export async function captureSystemSource(): Promise<MediaStream> {
  const constraints: DisplayMediaStreamOptions = {
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    video: false,
  };
  return navigator.mediaDevices.getDisplayMedia(constraints);
}

export async function getAudioInputDevicesList(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'audioinput');
}
