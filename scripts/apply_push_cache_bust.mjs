import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const VERSION = "push-apple-resubscribe-20260831";
const TEXT_EXTENSIONS = new Set([".html", ".js", ".mjs"]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", "node_modules", ".vercel"].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk(ROOT)) {
  if (!TEXT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
  let text = fs.readFileSync(file, "utf8");
  const original = text;

  // Cache-bust every direct reference, including prerendered product pages.
  text = text.replace(
    /\/java\/notifications(?:\.min)?\.js\?v=[^"'\s<)]+/g,
    `/java/notifications.js?v=push-apple-resubscribe-20260831
  );

  if (file.endsWith(path.join("java", "index-idle-loader.js"))) {
    text = text.replace(
      /\/java\/notifications(?:\.min)?\.js\?v=[^"'\s<)]+/g,
      `/java/notifications.js?v=push-apple-resubscribe-20260831
    );
  }

  if (file.endsWith("sw.js")) {
    text = text.replace(
      /const CACHE\s*=\s*['"][^'"]+['"];/,
      `const CACHE = 'bariq-v411-apple-push-resubscribe';`
    );

    // Make push runtime scripts network-first so a stale SW cannot pin old VAPID code.
    text = text.replace(
      /(const isMutableRuntime\s*=\s*\/\\\/java\\\/\\\()([^)]*)(\\\)\(\\\?\\\|\\\$\\\)\/\.test\(url\))/,
      (m, a, body, c) => {
        if (body.includes("notifications")) return m;
        return a + "notifications\\.js|notifications\\.min\\.js|" + body + c;
      }
    );
  }

  if (text !== original) {
    fs.writeFileSync(file, text, "utf8");
    changed++;
    console.log("patched", path.relative(ROOT, file));
  }
}

console.log(`Done. ${changed} files patched.`);
