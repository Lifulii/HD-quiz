// Build a clean deploy package for Cloudflare Pages (direct upload).
// Only ships the password-gated app + ciphertext; plaintext bank and 刷题.html stay out.
//
// Usage: node tools/build_dist.js
// Output: dist/ 和 dist.zip
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const FILES = ["index.html", "app.js", "style.css", path.join("data", "questions.enc.js")];

fs.rmSync(dist, { recursive: true, force: true });
for (const f of FILES) {
  const dest = path.join(dist, f);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, f), dest);
}

const zip = path.join(root, "dist.zip");
fs.rmSync(zip, { force: true });
// PowerShell Compress-Archive（Windows 自带）
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${dist}\\*' -DestinationPath '${zip}' -Force"`,
  { stdio: "inherit" }
);

console.log("OK -> dist/ 和 dist.zip");
console.log("包含文件:");
for (const f of FILES) console.log("  -", f.replace(/\\/g, "/"));
