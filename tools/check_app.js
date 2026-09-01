// Verify every DOM id referenced in app.js exists in index.html.
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const ids = new Set();
for (const m of app.matchAll(/\$\("([\w-]+)"\)/g)) ids.add(m[1]);
for (const m of app.matchAll(/getElementById\("([\w-]+)"\)/g)) ids.add(m[1]);

const missing = [...ids].filter((id) => !html.includes(`id="${id}"`));
console.log("ids used:", ids.size);
if (missing.length) {
  console.log("MISSING:", missing.join(", "));
  process.exit(1);
}
console.log("all ids present");

// Check questions.js loads and every question has explanation + mnemonic.
global.window = {};
require(path.join(root, "data", "questions.js"));
const bank = global.window.QUESTION_BANK;
const bad = bank.filter((q) => !q.explanation || !q.mnemonic);
console.log("questions:", bank.length, "| missing content:", bad.length);
if (bad.length) process.exit(1);
