import assert from "node:assert/strict";
import { test } from "node:test";
import { applicantLabel } from "../src/contract.ts";

test("申請人名稱：本名＋暱稱同時顯示；相同或缺一個時只顯示一個", () => {
  assert.equal(applicantLabel("王小明", "小明"), "王小明（小明）");
  assert.equal(applicantLabel("王小明", "王小明"), "王小明");
  assert.equal(applicantLabel("", "小明"), "小明");
  assert.equal(applicantLabel("王小明", null), "王小明");
  assert.equal(applicantLabel(undefined, undefined), "");
});
