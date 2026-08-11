/**
 * Module resolution hook for the test runner.
 *
 * The source uses TypeScript conventions Node's ESM loader doesn't follow:
 * extensionless relative imports ("./format") and the "@/" alias from
 * tsconfig. Vite handles both at build time; this teaches the test runner
 * the same two rules so tests can import application code directly.
 *
 * Deliberately dependency-free — the project's lockfile is managed by
 * Lovable, and a test runner is not worth risking an install mismatch over.
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const CANDIDATES = [".ts", ".tsx", ".js", "/index.ts", "/index.tsx"];

function firstExisting(base) {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const suffix of CANDIDATES) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

export function resolve(specifier, context, nextResolve) {
  let base = null;

  if (specifier.startsWith("@/")) {
    base = path.join(SRC, specifier.slice(2));
  } else if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (base) {
    const resolved = firstExisting(base);
    if (resolved) return nextResolve(pathToFileURL(resolved).href, context);
  }

  return nextResolve(specifier, context);
}
