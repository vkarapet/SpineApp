export class AudioManager {
  private context: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  initOnGesture(): AudioContext {
    if (this.context) {
      if (this.context.state === 'suspended') {
        this.context.resume();
      }
      return this.context;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContextClass();
    return this.context;
  }

  async loadSound(name: string, url: string): Promise<void> {
    if (!this.context) return;
    if (this.buffers.has(name)) return;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
      this.buffers.set(name, audioBuffer);
    } catch (err) {
      console.error(`Failed to load audio "${name}":`, err);
    }
  }

  play(name: string): void {
    if (!this.enabled || !this.context) return;

    const buffer = this.buffers.get(name);
    if (!buffer) return;

    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.context.destination);
      source.start(0);
    } catch (err) {
      console.error(`Failed to play audio "${name}":`, err);
    }
  }

  async preloadAll(): Promise<void> {
    const base = import.meta.env.BASE_URL;
    await Promise.all([
      this.loadSound('beep', base + 'audio/beep.mp3'),
      this.loadSound('go', base + 'audio/go.mp3'),
      this.loadSound('end', base + 'audio/end.mp3'),
    ]);
  }

  dispose(): void {
    if (this.context) {
      this.context.close();
      this.context = null;
    }
    this.buffers.clear();
  }
}

// Singleton
export const audioManager = new AudioManager();
