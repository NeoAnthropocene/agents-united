// Frame values are local to each Sequence. No clocks, random values or CSS animation.
export function frameState(frame, duration) {
  const entrance = Math.max(1, Math.min(12, Math.floor(duration / 3)));
  const progress = duration < 3 ? 1 : Math.max(0, Math.min(1, frame / entrance));
  return { opacity: progress, translateY: (1 - progress) * 28 };
}
