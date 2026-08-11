import { useEffect, useState } from "react";

import { money } from "@/lib/format";

/**
 * Count-up primitives, extracted from the dashboard so every screen animates
 * the same way instead of some numbers easing and others snapping.
 *
 * Both honour prefers-reduced-motion by rendering the final value directly.
 */
function useCountUp(value: number, duration: number, round = false) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(value);
      return;
    }

    const from = 0;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (value - from) * eased;
      setDisplay(round ? Math.round(next) : next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, round]);

  return display;
}

export function AnimatedMoney({
  value,
  hidden = false,
  className,
  short = false,
}: {
  value: number;
  hidden?: boolean;
  className?: string;
  short?: boolean;
}) {
  const display = useCountUp(value, 620);
  return <span className={className}>{hidden ? "••••••" : money(display, { short })}</span>;
}

export function AnimatedNumber({
  value,
  className,
  suffix,
}: {
  value: number;
  className?: string;
  suffix?: string;
}) {
  const display = useCountUp(value, 560, true);
  return (
    <span className={className}>
      {display}
      {suffix}
    </span>
  );
}

/**
 * Circular progress dial. Draws with two stacked strokes and animates the
 * dash offset, so it stays crisp at any size and needs no chart library.
 */
export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  tone = "accent",
  label,
  sublabel,
}: {
  /** 0–1. Values outside the range are clamped. */
  value: number;
  size?: number;
  stroke?: number;
  tone?: "accent" | "primary" | "success" | "warning" | "destructive";
  label?: string;
  sublabel?: string;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDrawn(clamped);
      return;
    }
    // A frame's delay lets the CSS transition run from the previous value.
    const id = requestAnimationFrame(() => setDrawn(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={label ?? `${Math.round(clamped * 100)}%`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-white/[0.08]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - drawn)}
          className={`transition-[stroke-dashoffset] duration-700 ease-out ${
            tone === "accent"
              ? "stroke-accent"
              : tone === "primary"
                ? "stroke-primary"
                : tone === "success"
                  ? "stroke-success"
                  : tone === "warning"
                    ? "stroke-warning"
                    : "stroke-destructive"
          }`}
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute inset-0 grid place-items-center text-center leading-none">
          {label && (
            <span className="numeric-display text-sm font-semibold text-foreground">{label}</span>
          )}
          {sublabel && (
            <span className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
