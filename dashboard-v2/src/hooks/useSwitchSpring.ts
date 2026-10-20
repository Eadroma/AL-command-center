import { useLayoutEffect, useRef } from 'react';

/** Retarget from the current position and velocity; rapid reversals never jump. */
export function useSwitchSpring(checked: boolean) {
  const element = useRef<HTMLSpanElement>(null);
  const state = useRef({ position: checked ? 1 : 0, velocity: 0 });
  useLayoutEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const target = checked ? 1 : 0;
    let frame = 0, previous = performance.now();
    const paint = () => element.current?.style.setProperty('--switch-progress', String(state.current.position));
    const snap = () => { cancelAnimationFrame(frame); state.current = { position: target, velocity: 0 }; paint(); };
    const tick = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 1 / 60); previous = now;
      const s = state.current;
      // Critically damped: no decorative overshoot on a binary setting.
      s.velocity += ((target - s.position) * 400 - s.velocity * 40) * dt;
      s.position += s.velocity * dt; paint();
      if (Math.abs(target - s.position) < .001 && Math.abs(s.velocity) < .01) snap();
      else frame = requestAnimationFrame(tick);
    };
    paint();
    if (preference.matches) snap(); else frame = requestAnimationFrame(tick);
    const onPreference = () => { if (preference.matches) snap(); };
    preference.addEventListener('change', onPreference);
    return () => { cancelAnimationFrame(frame); preference.removeEventListener('change', onPreference); };
  }, [checked]);
  return element;
}
