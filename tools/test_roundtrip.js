// Roundtrip test: encrypt with tools/encrypt_data.js output, decrypt via
// the WebCrypto (subtle) API exactly as the browser does.
// Usage: node tools/test_roundtrip.js <password>
const fs = require("fs");
const path = require("path");
const { webcrypto } = require("crypto");

const root = path.resolve(__dirname, "..");
const password = process.argv[2];
if (!password) {
  console.error("usage: node tools/test_roundtrip.js <password>");
  process.exit(1);
}

const src = fs.readFileSync(path.join(root, "data", "questions.enc.js"), "utf8");
const payload = JSON.parse(src.replace("window.QUESTION_ENC = ", "").replace(/;\s*$/, ""));

function b64ToBytes(b64) {
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

(async () => {
  const subtle = webcrypto.subtle;
  const baseKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await subtle.deriveKey(
    { name: "PBKDF2", salt: b64ToBytes(payload.salt), iterations: payload.iter, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const buf = await subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(payload.iv) },
    key,
    b64ToBytes(payload.data)
  );
  const bank = JSON.parse(new TextDecoder().decode(buf));
  console.log("decrypt OK, questions:", bank.length);
  console.log("sample:", bank[0].id, bank[0].part, "| exp:", bank[0].explanation.slice(0, 24));

  // wrong password must fail
  try {
    const badKey = await subtle.importKey("raw", new TextEncoder().encode("wrong-pwd"), "PBKDF2", false, ["deriveKey"]);
    const bad = await subtle.deriveKey(
      { name: "PBKDF2", salt: b64ToBytes(payload.salt), iterations: payload.iter, hash: "SHA-256" },
      badKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    await subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(payload.iv) }, bad, b64ToBytes(payload.data));
    console.log("FAIL: wrong password decrypted!");
    process.exit(1);
  } catch (e) {
    console.log("wrong password correctly rejected");
  }
})().catch((e) => {
  console.error("decrypt failed:", e.message);
  process.exit(1);
});
