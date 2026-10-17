import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The Overview's "Play the day": moves the hour from 6am to 9pm in about 10 seconds,
 * holding 2 seconds at 3pm so the afternoon gap is visible. `t` is a fractional hour
 * (e.g. 14.5) so the scene can move smoothly between hourly values.
 */
export default function usePlayDay(initialHour, { start = 6, end = 21, durationMs = 10000, holdAt = 15, holdMs = 2000 } = {}) {
  const [t, setT] = useState(initialHour);
  const [playing, setPlaying] = useState(false);
  const frame = useRef(0);

  useEffect(() => {
    if (!playing) return undefined;
    const rate = (end - start) / durationMs;          // hours per millisecond
    const reachHold = (holdAt - start) / rate;         // ms from 6am until 3pm
    const began = performance.now();
    const tick = (now) => {
      const ms = now - began;
      let hour;
      if (ms < reachHold) hour = start + ms * rate;
      else if (ms < reachHold + holdMs) hour = holdAt;  // the 2-second pause at 3pm
      else hour = holdAt + (ms - reachHold - holdMs) * rate;
      if (hour >= end) { setT(end); setPlaying(false); return; }
      setT(hour);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [playing, start, end, durationMs, holdAt, holdMs]);

  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const scrub = useCallback((hour) => { setPlaying(false); setT(hour); }, []);
  return { t, playing, toggle, scrub };
}
