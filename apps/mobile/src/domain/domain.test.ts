import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  submitOrder,
  reviewOrder,
  owned,
  eligible,
} from "./domain.ts";
const student = {
  id: "demo-student",
  name: "測試學員",
  rank: "白金" as const,
  role: "student" as const,
};
test("免費即開通，重複領取拒絕", () => {
  let s = initialState();
  s.member = student;
  s.cart = ["start"];
  s = submitOrder(s, "DEMO-1", "2026-11-11");
  assert.equal(owned(s, "start"), true);
  s.cart = ["start"];
  assert.throws(() => submitOrder(s, "DEMO-2", "now"));
});
test("混合購物車免費先開通、付費待審、通知管理員，審核後通知學員", () => {
  let s = initialState();
  s.member = student;
  s.cart = ["start", "lead"];
  s = submitOrder(s, "DEMO-1", "now");
  assert.equal(owned(s, "start"), true);
  assert.equal(owned(s, "lead"), false);
  assert.equal(s.notices.filter((n) => n.recipient === "admin").length, 1);
  const paid = s.orders.find((o) => o.status === "pending")!;
  assert.throws(() => reviewOrder(s, paid.id, true, ""));
  s.member = { ...student, id: "admin", role: "admin" };
  s = reviewOrder(s, paid.id, true, "");
  assert.equal(owned(s, "lead", student.id), true);
  assert.throws(() => reviewOrder(s, paid.id, true, ""));
});
test("獎銜與下架不能繞過結帳，訪客不符資格", () => {
  const s = initialState();
  s.member = student;
  s.cart = ["growth"];
  assert.throws(() => submitOrder(s, "DEMO-1", "now"));
  assert.equal(eligible(null, s.courses[0]), false);
  s.cart = ["start"];
  s.courses[0].published = false;
  assert.throws(() => submitOrder(s, "DEMO-2", "now"));
});
test("拒絕須提供理由且不開通", () => {
  let s = initialState();
  s.member = student;
  s.cart = ["lead"];
  s = submitOrder(s, "DEMO-1", "now");
  s.member = { ...student, id: "admin", role: "admin" };
  assert.throws(() => reviewOrder(s, "DEMO-1", false, ""));
  s = reviewOrder(s, "DEMO-1", false, "尚未查到款項");
  assert.equal(owned(s, "lead", student.id), false);
  assert.equal(s.orders[0].status, "rejected");
});
