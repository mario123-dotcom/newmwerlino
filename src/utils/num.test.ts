import test from "node:test";
import assert from "node:assert/strict";
import { parsePercent } from "./num";

test("parsePercent basic", () => {
  assert.equal(parsePercent("50%"), 0.5);
  assert.equal(parsePercent(25), 0.25);
});
