import test from "node:test";
import assert from "node:assert/strict";

import { wrapText } from "../../timeline";

test("wrapText splits by length", () => {
  const lines = wrapText("uno due tre quattro cinque", 7);
  assert.deepEqual(lines, ["uno due", "tre", "quattro", "cinque"]);
});
