// Installs the resolver hook before any test module is loaded.
//
// The date tests assert behaviour in the app's own timezone, so it is pinned
// here rather than via a shell prefix — that keeps `npm test` identical on
// Linux, macOS and Windows.
process.env.TZ = process.env.TZ ?? "America/Toronto";

import { register } from "node:module";
register("./resolver.mjs", import.meta.url);
