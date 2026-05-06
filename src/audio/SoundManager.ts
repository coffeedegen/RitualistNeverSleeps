type SoundName = "pickup" | "hit" | "kill" | "levelUp" | "gameOver" | "click";

interface SoundEnvelope {
  frequency: number;
  durationMs: number;
  gain: number;
  type?: OscillatorType;
  frequencyEnd?: number;
}

/**
 * Tiny Web Audio sound bank for UI and combat feedback.
 *
 * The manager stays lazy-initialized so the game still works if audio is blocked
 * until the player interacts with the page.
 */
export class SoundManager {
  private static instance: SoundManager | null = null;
  private context: AudioContext | null = null;
  private unlocked = false;
  private muted = false;

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  unlock(): void {
    if (this.unlocked || this.muted) return;

    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return;

    if (!this.context) {
      this.context = new Ctor();
    }

    if (this.context.state === "suspended") {
      void this.context.resume();
    }

    this.unlocked = true;
  }

  play(name: SoundName): void {
    if (this.muted) return;
    if (!this.context) {
      this.unlock();
    }
    if (!this.context || this.context.state === "closed") return;

    const preset = this.resolvePreset(name);
    this.playEnvelope(preset);
  }

  private resolvePreset(name: SoundName): SoundEnvelope {
    switch (name) {
      case "pickup":
        return { frequency: 740, frequencyEnd: 980, durationMs: 110, gain: 0.035, type: "triangle" };
      case "hit":
        return { frequency: 220, frequencyEnd: 160, durationMs: 90, gain: 0.05, type: "square" };
      case "kill":
        return { frequency: 520, frequencyEnd: 220, durationMs: 160, gain: 0.05, type: "sawtooth" };
      case "levelUp":
        return { frequency: 440, frequencyEnd: 880, durationMs: 220, gain: 0.04, type: "sine" };
      case "gameOver":
        return { frequency: 180, frequencyEnd: 70, durationMs: 320, gain: 0.06, type: "triangle" };
      case "click":
      default:
        return { frequency: 620, frequencyEnd: 520, durationMs: 70, gain: 0.02, type: "sine" };
    }
  }

  private playEnvelope(envelope: SoundEnvelope): void {
    if (!this.context) return;

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    osc.type = envelope.type ?? "sine";
    osc.frequency.setValueAtTime(envelope.frequency, now);
    if (envelope.frequencyEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, envelope.frequencyEnd),
        now + envelope.durationMs / 1000,
      );
    }

    filter.type = "lowpass";
    filter.frequency.value = 3000;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(envelope.gain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + envelope.durationMs / 1000);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.context.destination);

    osc.start(now);
    osc.stop(now + envelope.durationMs / 1000 + 0.02);

    osc.onended = () => {
      filter.disconnect();
      gain.disconnect();
      osc.disconnect();
    };
  }
}

export default SoundManager;
