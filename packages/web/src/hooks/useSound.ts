import { useCallback, useRef } from "react";

type SoundEvent = "click" | "advance" | "battle" | "notification";

const FREQUENCIES: Record<SoundEvent, number[]> = {
  click: [800],
  advance: [440, 550],
  battle: [200, 300, 150],
  notification: [660, 880],
};

const DURATIONS: Record<SoundEvent, number> = {
  click: 0.05,
  advance: 0.1,
  battle: 0.15,
  notification: 0.12,
};

export function useSound(enabled = true) {
  const ctxRef = useRef<AudioContext | null>(null);

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback(
    (event: SoundEvent) => {
      if (!enabled) return;
      try {
        const ctx = getContext();
        const freqs = FREQUENCIES[event];
        const dur = DURATIONS[event];
        const now = ctx.currentTime;

        for (let i = 0; i < freqs.length; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = event === "battle" ? "sawtooth" : "sine";
          osc.frequency.setValueAtTime(freqs[i], now + i * dur);
          gain.gain.setValueAtTime(0.08, now + i * dur);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * dur + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * dur);
          osc.stop(now + i * dur + dur + 0.01);
        }
      } catch {
        // AudioContext not available (SSR or blocked)
      }
    },
    [enabled, getContext],
  );

  return { play };
}
