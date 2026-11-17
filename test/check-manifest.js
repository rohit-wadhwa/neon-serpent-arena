#!/usr/bin/env node
// PWA manifest + icon integrity check (v2.14.2 installable, v2.14.3 iOS tags).
// Pure Node, no dependencies, sub-second. Guards the install experience:
//   - manifest.webmanifest is valid JSON with the required fields
//   - every icon it declares exists on disk at the right path
//   - index.html wires up the manifest, the apple-touch-icon, theme-color,
//     and the iOS/mobile web-app meta tags that give a full-screen install
//   - theme/background colors match the game's actual background (#05060f)
// Exits 0 if all good, 1 (with the reason) otherwise.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

const problems = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };

const APP_BG = "#05060f";   // must match css/style.css + the canvas clear in game.js

// ---- manifest.webmanifest ----
let m;
try {
  m = JSON.parse(read("manifest.webmanifest"));
} catch (e) {
  console.error("✗ manifest check FAILED\n  manifest.webmanifest is not valid JSON: " + e.message);
  process.exit(1);
}

for (const field of ["name", "short_name", "start_url", "display", "icons"]) {
  check(m[field] !== undefined, "manifest missing required field: " + field);
}
check(m.display === "standalone", 'manifest display should be "standalone" (got "' + m.display + '")');
check(m.theme_color === APP_BG, "manifest theme_color should match the app bg " + APP_BG + " (got " + m.theme_color + ")");
check(m.background_color === APP_BG, "manifest background_color should match the app bg " + APP_BG + " (got " + m.background_color + ")");

// Icons must declare 192 and 512 PNGs and every declared file must exist.
const sizes = (m.icons || []).map((i) => i.sizes);
check(sizes.includes("192x192"), "manifest missing a 192x192 icon");
check(sizes.includes("512x512"), "manifest missing a 512x512 icon");
for (const ic of m.icons || []) {
  const rel = ic.src.replace(/^\//, "");   // manifest uses web-absolute /icons/... → repo-relative
  check(exists(rel), "manifest icon file is missing on disk: " + ic.src);
}

// ---- index.html wiring ----
const html = read("index.html");
const has = (re, label) => check(re.test(html), "index.html missing " + label);
has(/<link[^>]+rel=["']manifest["'][^>]+href=["']\/manifest\.webmanifest["']/, "<link rel=manifest>");
has(/<link[^>]+rel=["']apple-touch-icon["']/, "<link rel=apple-touch-icon>");
has(/<meta[^>]+name=["']theme-color["'][^>]+content=["']#05060f["']/, 'theme-color meta = ' + APP_BG);
has(/<meta[^>]+name=["']apple-mobile-web-app-capable["'][^>]+content=["']yes["']/, "apple-mobile-web-app-capable meta (iOS full-screen)");
has(/<meta[^>]+name=["']mobile-web-app-capable["'][^>]+content=["']yes["']/, "mobile-web-app-capable meta");

// The apple-touch-icon file itself must exist.
const at = (html.match(/rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/) || [])[1];
if (at) check(exists(at.replace(/^\//, "")), "apple-touch-icon file is missing on disk: " + at);

if (problems.length) {
  console.error("✗ manifest check FAILED (" + problems.length + "):");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("✓ PWA manifest OK (valid, " + (m.icons.length) + " icons present, index.html wired, iOS tags + colors aligned)");
