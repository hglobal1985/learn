import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { muxPlaybackUrl } from "../src/mux.ts";
import { createTestDb } from "./sqlite-d1.ts";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pkcs1 = privateKey.export({ format: "pem", type: "pkcs1" }).toString();
const pkcs8 = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const pkcs8Der = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");

const formats: Record<string, string> = {
  "Mux 後台格式：Base64(PKCS#1 PEM)": Buffer.from(pkcs1).toString("base64"),
  "PKCS#1 PEM": pkcs1,
  "PKCS#8 PEM": pkcs8,
  "Base64(PKCS#8 PEM)": Buffer.from(pkcs8).toString("base64"),
  "Base64 PKCS#8 DER": pkcs8Der,
  "字面 \\n 的 PEM": pkcs1.replace(/\n/g, "\\n"),
};

for (const [name, secret] of Object.entries(formats)) {
  test(`Mux 私鑰格式：${name}`, async () => {
    const url = await muxPlaybackUrl({ DB: createTestDb(), MUX_SIGNING_KEY_ID: ` key-${name.length} \n`, MUX_SIGNING_PRIVATE_KEY: secret }, "PlaybackId123");
    assert.ok(url, "應該簽出網址");
    const [h, p, s] = new URL(url!).searchParams.get("token")!.split(".");
    assert.equal(JSON.parse(Buffer.from(h, "base64url").toString()).kid, `key-${name.length}`, "金鑰 ID 去除空白");
    assert.ok(createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url")));
  });
}

test("Mux 私鑰無效時回傳 null（不丟出錯誤、不洩漏內容）", async () => {
  assert.equal(await muxPlaybackUrl({ DB: createTestDb(), MUX_SIGNING_KEY_ID: "k", MUX_SIGNING_PRIVATE_KEY: "not a key" }, "x"), null);
});
