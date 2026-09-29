import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fx3uRejectedExactForms, fx3uVerifiedForms } from "@plc-ladder-mcp/ladder-ir";
import {
  addCoil,
  addContact,
  addCounter,
  addInstruction,
  addParallelAction,
  addReset,
  addSet,
  addTimer,
  createNetwork,
  createProject,
  exportGxWorks2Text,
  exportSamSoar,
  approvePendingChange,
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
  saveProjectSnapshot,
  setParallelConditions,
  undoProject,
  validateProject,
} from "./project.js";

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

export function createMcpServer() {
  const server = new McpServer({ name: "plc-ladder-mcp", version: "0.2.0" });

  server.tool("create_project", "Create/reset the current FX3U Ladder project using canonical IR v0.2.", {
    name: z.string().min(1),
    plc_family: z.string().default("Mitsubishi FX"),
    plc_model: z.string().default("FX3U"),
  }, async ({ name, plc_family, plc_model }) => json(createProject(name, plc_family, plc_model)));

  server.tool("get_project", "Return the canonical Ladder IR v0.2 for the current project.", {},
    async () => json(getProject()));

  server.tool("get_fx3u_capabilities", "Return exact GX Works2 verification evidence and known rejected operand forms for FX3U.", {},
    async () => json({ verified_forms: fx3uVerifiedForms, rejected_forms: fx3uRejectedExactForms }));


  server.tool("create_network", "Create an empty series-root Ladder network.", {
    network_id: z.number().int().nonnegative().optional(),
    comment: z.string().optional(),
  }, async ({ network_id, comment }) =>
    json({ created: createNetwork(comment, network_id), project: getProject() }));

  server.tool("add_contact", "Add a NO/NC contact to a network before its output action tail.", {
    device: z.string(),
    mode: z.enum(["NO", "NC"]).default("NO"),
    network_id: z.number().int().nonnegative().default(0),
  }, async ({ device, mode, network_id }) =>
    json({ added: addContact(device, mode, network_id), project: getProject() }));

  server.tool("add_coil", "Add an output coil. If an output already exists, the new coil becomes a parallel output branch.", {
    device: z.string(),
    network_id: z.number().int().nonnegative().default(0),
  }, async ({ device, network_id }) =>
    json({ added: addCoil(device, network_id), project: getProject() }));

  server.tool("add_set", "Add a SET action. Existing outputs are preserved as parallel output branches.", {
    device: z.string(),
    network_id: z.number().int().nonnegative().default(0),
  }, async ({ device, network_id }) =>
    json({ added: addSet(device, network_id), project: getProject() }));

  server.tool("add_reset", "Add an RST action. Existing outputs are preserved as parallel output branches.", {
    device: z.string(),
    network_id: z.number().int().nonnegative().default(0),
  }, async ({ device, network_id }) =>
    json({ added: addReset(device, network_id), project: getProject() }));

  server.tool("add_timer", "Add a verified FX3U timer action serialized as OUT Tn Kpreset.", {
    timer: z.string(),
    preset: z.number().int().nonnegative(),
    network_id: z.number().int().nonnegative().default(0),
  }, async ({ timer, preset, network_id }) =>
    json({ added: addTimer(timer, preset, network_id), project: getProject() }));

  server.tool("add_counter", "Add a verified FX3U counter action serialized as OUT Cn Kpreset.", {
    counter: z.string(),
    preset: z.number().int().nonnegative(),
    network_id: z.number().int().nonnegative().default(0),
  }, async ({ counter, preset, network_id }) =>
    json({ added: addCounter(counter, preset, network_id), project: getProject() }));

  server.tool("add_instruction", "Add a generic FX3U instruction action. Operands use device, K-decimal, or H-hex syntax.", {
    opcode: z.string().min(1),
    operands: z.array(z.string()).default([]),
    network_id: z.number().int().nonnegative().default(0),
  }, async ({ opcode, operands, network_id }) =>
    json({ added: addInstruction(opcode, operands, network_id), project: getProject() }));

  server.tool("add_parallel_action", "Append an explicit parallel output action to a network that already has an output.", {
    kind: z.enum(["coil", "set", "reset", "instruction"]),
    value: z.string().min(1).describe("Device for coil/set/reset, or opcode for instruction."),
    operands: z.array(z.string()).default([]),
    network_id: z.number().int().nonnegative().default(0),
  }, async ({ kind, value, operands, network_id }) =>
    json({ added: addParallelAction(kind, value, operands, network_id), project: getProject() }));

  server.tool("set_parallel_conditions", "Replace a network condition with two or more parallel contact branches while preserving its output tail.", {
    branches: z.array(z.array(z.object({
      device: z.string().min(1),
      mode: z.enum(["NO", "NC"]).default("NO"),
      edge: z.enum(["none", "rising", "falling"]).default("none"),
    })).min(1)).min(2),
    network_id: z.number().int().nonnegative().default(0),
  }, async ({ branches, network_id }) =>
    json({ condition: setParallelConditions(branches, network_id), project: getProject() }));


  server.tool("remove_contact", "Preview or apply removal of a direct series contact by node id. Preview is the default.", {
    contact_id: z.string().min(1),
    network_id: z.number().int().nonnegative().default(0),
    apply: z.boolean().default(false),
  }, async ({ contact_id, network_id, apply }) =>
    json(removeContact(contact_id, network_id, apply)));

  server.tool("remove_action", "Preview or apply removal of an output action by action/node id. Parallel tails collapse automatically.", {
    action_id: z.string().min(1),
    network_id: z.number().int().nonnegative().default(0),
    apply: z.boolean().default(false),
  }, async ({ action_id, network_id, apply }) =>
    json(removeAction(action_id, network_id, apply)));

  server.tool("replace_device", "Preview or apply an exact PLC-device replacement. Omit network_id to replace across the current program.", {
    from_device: z.string().min(1),
    to_device: z.string().min(1),
    network_id: z.number().int().nonnegative().optional(),
    apply: z.boolean().default(false),
  }, async ({ from_device, to_device, network_id, apply }) =>
    json(replaceDevice(from_device, to_device, network_id, apply)));

  server.tool("delete_network", "Preview or apply deletion of a network. The final remaining network cannot be deleted.", {
    network_id: z.number().int().nonnegative(),
    apply: z.boolean().default(false),
  }, async ({ network_id, apply }) =>
    json(deleteNetwork(network_id, apply)));

  server.tool("modify_network", "Preview or apply network metadata changes. Currently supports the network comment.", {
    network_id: z.number().int().nonnegative(),
    comment: z.string().nullable(),
    apply: z.boolean().default(false),
  }, async ({ network_id, comment, apply }) =>
    json(modifyNetwork(network_id, comment, apply)));

  server.tool("list_pending_changes", "List AI edit proposals waiting for human review, including diff, validation, and stale status.", {},
    async () => json(listPendingChanges()));

  server.tool("approve_pending_change", "Approve a previously previewed semantic edit by pending_change_id.", {
    pending_change_id: z.string().min(1),
  }, async ({ pending_change_id }) =>
    json(approvePendingChange(pending_change_id)));

  server.tool("reject_pending_change", "Reject and discard a previously previewed semantic edit by pending_change_id.", {
    pending_change_id: z.string().min(1),
  }, async ({ pending_change_id }) =>
    json(rejectPendingChange(pending_change_id)));

  server.tool("get_history", "Return change log plus undo/redo availability for the current project.", {},
    async () => json(getHistory()));

  server.tool("undo_project", "Undo the most recent applied project mutation.", {},
    async () => json(undoProject()));

  server.tool("redo_project", "Redo the most recently undone project mutation.", {},
    async () => json(redoProject()));

  server.tool("list_saved_projects", "List named JSON project snapshots stored by the server.", {},
    async () => json(listSavedProjects()));

  server.tool("save_project", "Save the current canonical IR v0.2 project as a named JSON snapshot.", {
    name: z.string().min(1).optional(),
  }, async ({ name }) => json(saveProjectSnapshot(name)));

  server.tool("load_project", "Load a named JSON project snapshot into the current canonical state.", {
    name: z.string().min(1),
  }, async ({ name }) => json(loadProjectSnapshot(name)));

  server.tool("import_gxworks2", "Import GX Works2 List CSV/TSV text into canonical IR v0.2.", {
    content: z.string().min(1),
  }, async ({ content }) => json(importGxWorks2Text(content)));

  server.tool("validate_project", "Validate the canonical IR v0.2 and current FX3U compiler topology rules.", {},
    async () => json(validateProject()));

  server.tool("export_project", "Compile the project to a supported PLC IDE interchange format.", {
    target: z.enum(["samsoar2022", "gxworks2"]),
  }, async ({ target }) => target === "gxworks2" ? json({
    target,
    filename: "plc-ladder-gxworks2.csv",
    encoding: "UTF-16 LE with BOM required at file boundary",
    content: exportGxWorks2Text(),
  }) : json({
    target,
    filename: "plc-ladder-samsoar.csv",
    encoding: "UTF-8 with BOM",
    content: exportSamSoar(),
  }));

  return server;
}
