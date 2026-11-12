/**
 * AI "thinking" orb: a soft conic-gradient sphere that slowly morphs and turns while a model is working and rests when idle.
 * Pure CSS (see .orb in styles.css), decorative (aria-hidden); the surrounding text always says what is happening.
 * Under reduced motion it stays still.
 */
export function Orb({ state = "idle", size = 28 }: { state?: "idle" | "thinking" | "done"; size?: number }) {
  return (
    <span className={`orb orb-${state}`} aria-hidden="true" style={{ width: size, height: size }}>
      <span className="orb-core" />
      <span className="orb-glow" />
    </span>
  );
}
