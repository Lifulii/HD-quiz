// Encrypt the question bank for password-gated publishing.
//
// Usage: node tools/encrypt_data.js <password>
// Input : data/questions.json (plaintext, stays local)
// Output: data/questions.enc.js (ciphertext, safe to publish)
//
// Crypto: PBKDF2-SHA256 (100k iters) -> AES-256-GCM. Format is compatible
// with WebCrypto in the browser (ciphertext || 16-byte auth tag).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const password = process.argv[2];
if (!password || password.length < 6) {
  console.error("usage: node tools/encrypt_data.js <password>  (password >= 6 chars)");
  process.exit(1);
}

const ITER = 100000;
const plain = fs.readFileSync(path.join(root, "data", "questions.json"), "utf8");

const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(password, salt, ITER, 32, "sha256");
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();

const payload = {
  v: 1,
  iter: ITER,
  salt: salt.toString("base64"),
  iv: iv.toString("base64"),
  data: Buffer.concat([enc, tag]).toString("base64"),
};

const out = "window.QUESTION_ENC = " + JSON.stringify(payload) + ";\n";
fs.writeFileSync(path.join(root, "data", "questions.enc.js"), out, "utf8");
console.log(
  "OK -> data/questions.enc.js (" +
    Math.round(out.length / 1024) +
    " KB), questions: " +
    JSON.parse(plain).length
);
