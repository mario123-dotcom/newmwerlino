import test from "node:test";
import assert from "node:assert/strict";

import { getTextXYFromTemplate } from "./timeline";
import type { TemplateDoc } from "./template";

test("getTextXYFromTemplate uses anchors and keeps box inside canvas", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "50%",
            y: "50%",
            width: "60%",
            height: "40%",
            x_anchor: "50%",
            y_anchor: "50%",
          },
        ],
      },
    ],
  };
  const pos = getTextXYFromTemplate(tpl, 0)!;
  assert.equal(pos.x, 20);
  assert.equal(pos.y, 30);
});

test("getTextXYFromTemplate clamps to slide bounds", () => {
  const tpl: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "95%",
            y: "5%",
            width: "20%",
            height: "10%",
            x_anchor: "0%",
            y_anchor: "0%",
          },
        ],
      },
    ],
  };
  const pos = getTextXYFromTemplate(tpl, 0)!;
  assert.equal(pos.x, 80); // 95 - 0, but clamped to 80 (100-20)
  assert.equal(pos.y, 5);

  const tpl2: TemplateDoc = {
    width: 100,
    height: 100,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "5%",
            y: "10%",
            width: "40%",
            height: "10%",
            x_anchor: "100%",
            y_anchor: "0%",
          },
        ],
      },
    ],
  };
  const pos2 = getTextXYFromTemplate(tpl2, 0)!;
  assert.equal(pos2.x, 0); // negative -> clamped to 0
  assert.equal(pos2.y, 10);
});
