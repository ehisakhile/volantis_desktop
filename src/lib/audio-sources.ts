/**
 * Background Audio Source - Play local audio files as background music
 */

export interface BackgroundAudioSourceResult {
  stream: MediaStream;
  duration: number;
}

export class BackgroundAudioSource {
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private destination: MediaStreamAudioDestinationNode;
  private isPlaying: boolean = false;
  private loop: boolean;

  constructor(file: File, loop: boolean = true) {
    this.audioContext = new AudioContext();
    this.loop = loop;
    this.gainNode = this.audioContext.createGain();
    this.destination = this.audioContext.createMediaStreamDestination();
    this.gainNode.connect(this.destination);
  }

  async capture(): Promise<BackgroundAudioSourceResult> {
    const arrayBuffer = await this.fileToArrayBuffer();
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    
    return {
      stream: this.destination.stream,
      duration: this.audioBuffer.duration,
    };
  }

  play(): void {
    if (!this.audioBuffer || this.isPlaying) return;

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.loop = this.loop;
    this.sourceNode.connect(this.gainNode);
    this.sourceNode.start(0);
    this.isPlaying = true;
  }

  stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (e) {}
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.isPlaying = false;
  }

  setVolume(volume: number): void {
    this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }

  setLoop(loop: boolean): void {
    this.loop = loop;
    if (this.sourceNode) {
      this.sourceNode.loop = loop;
    }
  }

  private fileToArrayBuffer(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer((this as unknown as { file: File }).file || new Blob());
    });
  }
}

export function createBackgroundAudioSource(file: File, loop: boolean = true): BackgroundAudioSource {
  return new BackgroundAudioSource(file, loop);
}
