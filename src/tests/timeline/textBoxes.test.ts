import test from "node:test";
import assert from "node:assert/strict";

import { getTextBoxFromTemplate } from "../../timeline";
import { TEXT } from "../../config";
import type { TemplateDoc } from "../../template";

test("getTextBoxFromTemplate uses anchors and keeps box inside canvas", () => {
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

  const box = getTextBoxFromTemplate(tpl, 0, undefined, {
    preserveOrigin: true,
    minWidthRatio: TEXT.MIN_BOX_WIDTH_RATIO,
  })!;
  assert.equal(box.x, 15);
  assert.equal(box.y, 30);
  assert.equal(box.w, 85);
  assert.equal(box.h, 40);
});

test("getTextBoxFromTemplate enforces optional minimum width ratio", () => {
  const tpl: TemplateDoc = {
    width: 400,
    height: 200,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "10%",
            y: "20%",
            width: "15%",
            height: "30%",
            x_anchor: "0%",
            y_anchor: "0%",
          },
        ],
      },
    ],
  } as any;

  const defaultBox = getTextBoxFromTemplate(tpl, 0, undefined, {
    preserveOrigin: true,
  })!;
  assert.equal(defaultBox.w, 60);
  assert.equal(defaultBox.x, 40);

  const widened = getTextBoxFromTemplate(tpl, 0, undefined, {
    preserveOrigin: true,
    minWidthRatio: 0.8,
  })!;
  assert.equal(widened.w, 320);
  assert.equal(widened.x, 40);
});

test("getTextBoxFromTemplate mirrors point text margins", () => {
  const tpl: TemplateDoc = {
    width: 400,
    height: 200,
    elements: [
      {
        type: "composition",
        name: "Slide_0",
        elements: [
          {
            type: "text",
            name: "Testo-0",
            x: "25%",
            y: "10%",
            x_anchor: "0%",
            y_anchor: "0%",
            x_alignment: "50%",
          },
        ],
      },
    ],
  } as any;

  const box = getTextBoxFromTemplate(tpl, 0, undefined, {
    preserveAnchor: true,
    minWidthRatio: TEXT.MIN_BOX_WIDTH_RATIO,
  })!;
  assert.equal(box.x, 60);
  assert.equal(box.w, 340);
  assert.equal(box.y, 20);
  assert.equal(box.h, 160);
});

test("getTextBoxFromTemplate keeps anchors beyond 100 percent", () => {
  const tpl: TemplateDoc = {
    width: 200,
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
            y: "80%",
            width: "40%",
            height: "50%",
            x_anchor: "50%",
            y_anchor: "150%",
          },
        ],
      },
    ],
  } as any;

  const box = getTextBoxFromTemplate(tpl, 0, undefined, {
    preserveAnchor: true,
    minWidthRatio: TEXT.MIN_BOX_WIDTH_RATIO,
  })!;
  assert.equal(box.x, 15);
  assert.equal(box.y, 5);
  assert.equal(box.w, 170);
  assert.equal(box.h, 50);
});

test("getTextBoxFromTemplate clamps to slide bounds", () => {
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
  const box = getTextBoxFromTemplate(tpl, 0, undefined, {
    preserveOrigin: true,
    minWidthRatio: TEXT.MIN_BOX_WIDTH_RATIO,
  })!;
  assert.equal(box.x, 15);
  assert.equal(box.y, 5);
});
