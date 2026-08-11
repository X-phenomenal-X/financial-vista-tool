/**
 * A short confetti burst for genuine milestones — clearing a debt, hitting a
 * goal. Hand-rolled on a canvas rather than pulling in a library: it's ~60
 * lines, and a finance app should not ship a dependency to throw paper.
 *
 * Deliberately rare. If this fires for routine saves it stops meaning
 * anything, so call it only when something is actually finished.
 */

const COLORS = ["#a78bfa", "#5eead4", "#f0abfc", "#fcd34d", "#ffffff"];

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  size: number;
  color: string;
};

export function celebrate(pieceCount = 90) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  // Never animate for people who asked not to see motion.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "9999",
  });
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  const context = canvas.getContext("2d");
  if (!context) {
    canvas.remove();
    return;
  }
  context.scale(dpr, dpr);

  const pieces: Piece[] = Array.from({ length: pieceCount }, () => ({
    // Launch from two lower corners, the way a party popper actually throws.
    x: width * (Math.random() < 0.5 ? 0.15 : 0.85),
    y: height * 0.75,
    vx: (Math.random() - 0.5) * 13,
    vy: -(9 + Math.random() * 11),
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.3,
    size: 5 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));

  const GRAVITY = 0.32;
  const DRAG = 0.992;
  const started = performance.now();
  const LIFETIME = 2600;
  let frame = 0;

  const tick = (now: number) => {
    const elapsed = now - started;
    context.clearRect(0, 0, width, height);

    for (const piece of pieces) {
      piece.vy += GRAVITY;
      piece.vx *= DRAG;
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.rotation += piece.spin;

      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.rotation);
      context.globalAlpha = Math.max(0, 1 - elapsed / LIFETIME);
      context.fillStyle = piece.color;
      context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
      context.restore();
    }

    if (elapsed < LIFETIME) {
      frame = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(frame);
      canvas.remove();
    }
  };

  frame = requestAnimationFrame(tick);
}
