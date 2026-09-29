import assert from "node:assert/strict";
import {
  addCoil,
  addContact,
  addCounter,
  addInstruction,
  addParallelAction,
  addTimer,
  createNetwork,
  createProject,
  exportGxWorks2Text,
  getProject,
  validateProject,
} from "./project.js";

createProject("Semantic API Smoke", "Mitsubishi FX", "FX3U");

addContact("M0", "NO", 0);
addCoil("Y0", 0);
addParallelAction("set", "M10", [], 0);

createNetwork("Timer and counter", 1);
addContact("X0", "NO", 1);
addTimer("T0", 10, 1);
addCounter("C0", 5, 1);

createNetwork("MOV instruction", 2);
addContact("M1", "NC", 2);
addInstruction("MOV", ["K100", "D0"], 2);

const project = getProject();
assert.equal(project.version, "0.2");
assert.equal(project.programs[0].networks.length, 3);

const network0 = project.programs[0].networks[0];
assert.equal(network0.root.kind, "series");
if (network0.root.kind !== "series") throw new Error("Expected series root.");
const output0 = network0.root.children.at(-1);
assert.equal(output0?.kind, "parallel");
if (!output0 || output0.kind !== "parallel") throw new Error("Expected parallel output tail.");
assert.equal(output0.branches.length, 2);

const validation = validateProject();
assert.equal(validation.valid, true, JSON.stringify(validation.issues, null, 2));

const gx = exportGxWorks2Text();
assert.match(gx, /"SET"\t"M10"/);
assert.match(gx, /"OUT"\t"T0 K10"/);
assert.match(gx, /"OUT"\t"C0 K5"/);
assert.match(gx, /"MOV"\t"K100 D0"/);

console.log("PASS semantic IR v0.2 smoke");
