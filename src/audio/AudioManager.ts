export type BgmTrackName = "titleBGM" | "gameBGM" | "gameOverBGM";
export type BgmPlaybackPhase = "idle" | "armed" | "fadingOut" | "fadingIn" | "playing";

export interface BgmDebugState {
  requestedTrack: BgmTrackName | null;
  currentTrack: BgmTrackName | null;
  phase: BgmPlaybackPhase;
  unlocked: boolean;
  muted: boolean;
}

const BGM_TRACKS: Record<BgmTrackName, string> = {
  titleBGM: "/assets/audio/title_bgm.mp3",
  gameBGM: "/assets/audio/game_bgm.mp3",
  gameOverBGM: "/assets/audio/gameover_bgm.mp3",
};

const DEFAULT_BGM_VOLUME = 0.62;
const DEFAULT_FADE_MS = 420;

export class AudioManager {
  private static instance: AudioManager | null = null;

  private readonly tracks = new Map<BgmTrackName, HTMLAudioElement>();
  private currentTrack: BgmTrackName | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private desiredTrack: BgmTrackName | null = null;
  private unlocked = false;
  private interactionArmed = false;
  private muted = false;
  private transitionToken = 0;
  private phase: BgmPlaybackPhase = "idle";
  private readonly listeners = new Set<(state: BgmDebugState) => void>();

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  subscribe(listener: (state: BgmDebugState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getDebugState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  getDebugState(): BgmDebugState {
    return {
      requestedTrack: this.desiredTrack,
      currentTrack: this.currentTrack,
      phase: this.phase,
      unlocked: this.unlocked,
      muted: this.muted,
    };
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.emitState();
    if (muted) {
      void this.stopBgm();
      return;
    }
    if (this.desiredTrack) {
      void this.syncRequestedTrack();
    }
  }

  armAutoplayUnlock(): void {
    if (this.unlocked || this.interactionArmed) {
      return;
    }

    this.interactionArmed = true;
    this.phase = "armed";
    this.emitState();
    const unlock = () => {
      this.unlocked = true;
      this.interactionArmed = false;
      if (this.phase === "armed") {
        this.phase = this.desiredTrack ? "idle" : "idle";
      }
      window.removeEventListener("click", unlock);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      this.emitState();
      void this.syncRequestedTrack();
    };

    window.addEventListener("click", unlock, { once: true });
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  requestBgm(track: BgmTrackName): void {
    this.desiredTrack = track;
    this.emitState();
    if (!this.unlocked) {
      this.armAutoplayUnlock();
      return;
    }
    void this.syncRequestedTrack();
  }

  stopBgm(): Promise<void> {
    this.desiredTrack = null;
    this.emitState();
    return this.syncRequestedTrack();
  }

  private async syncRequestedTrack(): Promise<void> {
    const token = ++this.transitionToken;

    if (this.muted) {
      await this.fadeOutCurrent(token);
      if (token === this.transitionToken && !this.currentAudio) {
        this.phase = this.interactionArmed ? "armed" : "idle";
        this.emitState();
      }
      return;
    }

    const target = this.desiredTrack;
    if (target === null) {
      await this.fadeOutCurrent(token);
      if (token === this.transitionToken) {
        this.phase = this.interactionArmed ? "armed" : "idle";
        this.emitState();
      }
      return;
    }

    if (this.currentTrack === target && this.currentAudio) {
      if (this.currentAudio.paused) {
        await this.playAndFadeIn(this.currentAudio, token);
      } else {
        this.phase = "playing";
        this.emitState();
      }
      return;
    }

    const next = this.getOrCreateTrack(target);
    await this.fadeOutCurrent(token);
    if (token !== this.transitionToken) {
      return;
    }

    this.currentTrack = target;
    this.currentAudio = next;
    await this.playAndFadeIn(next, token);
  }

  private getOrCreateTrack(name: BgmTrackName): HTMLAudioElement {
    const existing = this.tracks.get(name);
    if (existing) {
      return existing;
    }

    const audio = new Audio(BGM_TRACKS[name]);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    this.tracks.set(name, audio);
    return audio;
  }

  private async fadeOutCurrent(token: number): Promise<void> {
    if (!this.currentAudio) {
      this.currentTrack = null;
      this.phase = this.interactionArmed ? "armed" : "idle";
      this.emitState();
      return;
    }

    const audio = this.currentAudio;
    this.phase = "fadingOut";
    this.emitState();
    await this.fadeVolume(audio, audio.volume, 0, DEFAULT_FADE_MS, token);
    if (token !== this.transitionToken) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    this.currentTrack = null;
    this.currentAudio = null;
    this.phase = this.interactionArmed ? "armed" : "idle";
    this.emitState();
  }

  private async playAndFadeIn(audio: HTMLAudioElement, token: number): Promise<void> {
    audio.volume = 0;
    this.phase = "fadingIn";
    this.emitState();
    try {
      await audio.play();
    } catch (error) {
      if (token === this.transitionToken) {
        this.phase = this.interactionArmed ? "armed" : "idle";
        this.emitState();
        console.warn("[bgm] Failed to start track:", error);
      }
      return;
    }

    if (token !== this.transitionToken) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }

    await this.fadeVolume(audio, 0, DEFAULT_BGM_VOLUME, DEFAULT_FADE_MS, token);
    if (token === this.transitionToken) {
      this.phase = "playing";
      this.emitState();
    }
  }

  private emitState(): void {
    const snapshot = this.getDebugState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private fadeVolume(
    audio: HTMLAudioElement,
    from: number,
    to: number,
    durationMs: number,
    token: number,
  ): Promise<void> {
    const delta = to - from;
    if (Math.abs(delta) < 0.001 || durationMs <= 0) {
      audio.volume = to;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const startedAt = performance.now();
      const step = (now: number) => {
        if (token !== this.transitionToken) {
          resolve();
          return;
        }

        const t = Math.min(1, (now - startedAt) / durationMs);
        audio.volume = from + delta * t;
        if (t >= 1) {
          audio.volume = to;
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}

export default AudioManager;
