import assert from "node:assert/strict";
import test from "node:test";
import type { LadderProjectV02 } from "@plc-ladder-mcp/ladder-ir";
import { layoutLadder } from "../src/editor/layout.js";
import {
  clearCellRange,
  normalizeCellRange,
  rangeCellCount,
} from "../src/editor/cell-selection.js";

function projectWithSeries(): LadderProjectV02 {
  return {
    version: "0.2",
    name: "Selection project",
    plc: { family: "Mitsubishi FX", model: "FX3U" },
    programs: [{
      name: "Main",
      networks: [
        {
          id: 1,
          root: {
            id: "root-1",
            kind: "series",
            children: [
              { id: "x0", kind: "contact", mode: "NO", device: { kind: "device", address: "X0" } },
              { id: "wire-1", kind: "wire", connected: true },
              { id: "x1", kind: "contact", mode: "NO", device: { kind: "device", address: "X1" } },
              { id: "y0-node", kind: "action", action: { id: "y0", kind: "coil", device: { kind: "device", address: "Y0" } } },
            ],
          },
        },
        {
          id: 2,
          root: {
            id: "root-2",
            kind: "series",
            children: [{ id: "y1-node", kind: "action", action: { id: "y1", kind: "coil", device: { kind: "device", address: "Y1" } } }],
          },
        },
      ],
    }],
  };
}

test("normalizes a reverse drag and counts every covered cell", () => {
  const normalized = normalizeCellRange({
    anchor: { row: 2, column: 4 },
    focus: { row: 0, column: 1 },
  });

  assert.deepEqual(normalized, {
    top: 0,
    bottom: 2,
    left: 1,
    right: 4,
  });
  assert.equal(rangeCellCount(normalized), 12);
});

test("clears every symbol and wire in a rectangular range without touching another network", () => {
  const project = projectWithSeries();
  const untouched = structuredClone(project.programs[0].networks[1]);

  const result = clearCellRange(
    project,
    1,
    {
      anchor: { row: 0, column: 0 },
      focus: { row: 0, column: 2 },
    },
    () => "generated",
  );

  assert.equal(result.changed, true);
  assert.deepEqual(project.programs[0].networks[1], untouched);
  assert.deepEqual(result.project.programs[0].networks[1], untouched);

  const remaining = result.project.programs[0].networks[0].root;
  assert.equal(remaining.kind, "series");
  assert.deepEqual(
    remaining.kind === "series"
      ? remaining.children.map((node) =>
          node.kind === "wire" ? [node.id, node.kind, node.connected] : [node.id, node.kind],
        )
      : [],
    [
      ["wire-1", "wire", false],
      ["y0-node", "action"],
    ],
  );
});

test("turns selected projected wire cells into explicit gaps", () => {
  const project = projectWithSeries();
  const root = project.programs[0].networks[0].root;
  if (root.kind !== "series") throw new Error("Expected series root");
  root.children = [root.children[0], root.children[3]];

  let sequence = 0;
  const result = clearCellRange(
    project,
    1,
    {
      anchor: { row: 0, column: 1 },
      focus: { row: 0, column: 2 },
    },
    () => `generated-${sequence++}`,
  );

  assert.equal(result.changed, true);
  const layout = layoutLadder(result.project.programs[0].networks[0].root);
  const selectedCells = layout.cells.filter(
    (cell) => cell.row === 0 && (cell.column === 1 || cell.column === 2),
  );
  assert.equal(selectedCells.length, 2);
  assert.ok(selectedCells.every((cell) => cell.kind === "wire" && cell.connected === false));
});

test("does not create an edit when the range contains only blank cells", () => {
  const project = projectWithSeries();
  const result = clearCellRange(
    project,
    1,
    {
      anchor: { row: 3, column: 3 },
      focus: { row: 4, column: 4 },
    },
    () => "unused",
  );

  assert.equal(result.changed, false);
  assert.equal(result.project, project);
});
