import assert from "node:assert/strict";
import {
  addCoil,
  addContact,
  addCounter,
  addInstruction,
  addParallelAction,
  addTimer,
  approvePendingChange,
  createNetwork,
  createProject,
  exportGxWorks2Text,
  deleteNetwork,
  getHistory,
  getProject,
  importGxWorks2Text,
  listPendingChanges,
  listSavedProjects,
  loadProjectSnapshot,
  modifyNetwork,
  redoProject,
  rejectPendingChange,
  removeAction,
  removeContact,
  replaceDevice,
  undoProject,
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


const contactId = (() => {
  const n = getProject().programs[0].networks[2];
  if (n.root.kind !== "series") throw new Error("Expected series root.");
  const contact = n.root.children.find(node => node.kind === "contact");
  if (!contact || contact.kind !== "contact") throw new Error("Expected contact.");
  return contact.id;
})();

const actionId = (() => {
  const n = getProject().programs[0].networks[0];
  if (n.root.kind !== "series") throw new Error("Expected series root.");
  const tail = n.root.children.at(-1);
  if (!tail || tail.kind !== "parallel") throw new Error("Expected parallel output.");
  const setBranch = tail.branches.find(branch => branch.kind === "action" && branch.action.kind === "set");
  if (!setBranch || setBranch.kind !== "action") throw new Error("Expected SET action.");
  return setBranch.action.id;
})();

const previewReplace = replaceDevice("M0", "M5", 0, false);
assert.equal(previewReplace.applied, false);
assert.equal(previewReplace.changes.length, 1);
assert.equal(JSON.stringify(getProject()).includes('"M5"'), false);

const applyReplace = replaceDevice("M0", "M5", 0, true);
assert.equal(applyReplace.applied, true);
assert.equal(JSON.stringify(getProject()).includes('"M5"'), true);

const previewRemoveAction = removeAction(actionId, 0, false);
assert.equal(previewRemoveAction.applied, false);
assert.equal(previewRemoveAction.changes.length, 1);

const applyRemoveAction = removeAction(actionId, 0, true);
assert.equal(applyRemoveAction.applied, true);
const network0After = getProject().programs[0].networks[0];
if (network0After.root.kind !== "series") throw new Error("Expected series root.");
assert.equal(network0After.root.children.at(-1)?.kind, "action");

const previewRemoveContact = removeContact(contactId, 2, false);
assert.equal(previewRemoveContact.applied, false);
assert.equal(previewRemoveContact.validation.valid, false);

const commentPreview = modifyNetwork(1, "Updated timer/counter", false);
assert.equal(commentPreview.applied, false);
assert.equal(getProject().programs[0].networks[1].comment, "Timer and counter");

const commentApply = modifyNetwork(1, "Updated timer/counter", true);
assert.equal(commentApply.applied, true);
assert.equal(getProject().programs[0].networks[1].comment, "Updated timer/counter");

const deletePreview = deleteNetwork(2, false);
assert.equal(deletePreview.applied, false);
assert.equal(getProject().programs[0].networks.length, 3);

const deleteApply = deleteNetwork(2, true);
assert.equal(deleteApply.applied, true);
assert.equal(getProject().programs[0].networks.length, 2);

const finalValidation = validateProject();
assert.equal(finalValidation.valid, true, JSON.stringify(finalValidation.issues, null, 2));
console.log("PASS semantic edit preview/apply smoke");


const reviewProposal = modifyNetwork(1, "Human-approved timer/counter", false);
assert.ok(reviewProposal.pending_change_id);
const listed = listPendingChanges();
assert.ok(listed.some(change => change.id === reviewProposal.pending_change_id && change.stale === false));

const approved = approvePendingChange(reviewProposal.pending_change_id!);
assert.equal(approved.status, "approved");
assert.equal(getProject().programs[0].networks[1].comment, "Human-approved timer/counter");

const rejectProposal = replaceDevice("M5", "M6", 0, false);
assert.ok(rejectProposal.pending_change_id);
const rejected = rejectPendingChange(rejectProposal.pending_change_id!);
assert.equal(rejected.status, "rejected");
assert.equal(JSON.stringify(getProject()).includes('"M6"'), false);

console.log("PASS pending human review smoke");


const historyBeforeUndo = getHistory();
assert.equal(historyBeforeUndo.can_undo, true);
assert.ok(historyBeforeUndo.entries.some(entry => entry.source === "approved"));

const undoResult = undoProject();
assert.equal(undoResult.can_redo, true);
assert.equal(getProject().programs[0].networks[1].comment, "Updated timer/counter");

const redoResult = redoProject();
assert.equal(redoResult.can_undo, true);
assert.equal(getProject().programs[0].networks[1].comment, "Human-approved timer/counter");

const historyAfterRedo = getHistory();
assert.equal(historyAfterRedo.entries[0].kind, "redo");
assert.ok(historyAfterRedo.entries.some(entry => entry.kind === "undo"));

console.log("PASS history undo redo smoke");


createProject("Nested Import Smoke", "Mitsubishi FX", "FX3U");
addCoil("Y10", 0);
setParallelConditions([
  [{ device: "M10", mode: "NO" }, { device: "M11", mode: "NO" }],
  [{ device: "M12", mode: "NO" }, { device: "M13", mode: "NC" }],
], 0);

const nestedValidation = validateProject();
assert.equal(nestedValidation.valid, true, JSON.stringify(nestedValidation.issues, null, 2));
const nestedGx = exportGxWorks2Text();
assert.match(nestedGx, /"ORB"/);
assert.match(nestedGx, /"ANI"\t"M13"/);

const importedNested = importGxWorks2Text(nestedGx);
assert.equal(importedNested.validation.valid, true);
const importedRoot = getProject().programs[0].networks[0].root;
assert.equal(importedRoot.kind, "series");
if (importedRoot.kind !== "series") throw new Error("Expected series root after GX import.");
assert.equal(importedRoot.children[0]?.kind, "parallel");

const saved = saveProjectSnapshot("nested-import-smoke");
assert.equal(saved.name, "nested-import-smoke");
assert.ok(listSavedProjects().some(item => item.name === "nested-import-smoke"));

replaceDevice("Y10", "Y11", 0, true);
assert.equal(JSON.stringify(getProject()).includes('"Y11"'), true);
loadProjectSnapshot("nested-import-smoke");
assert.equal(JSON.stringify(getProject()).includes('"Y10"'), true);
assert.equal(JSON.stringify(getProject()).includes('"Y11"'), false);

console.log("PASS nested branch GX import persistence smoke");
