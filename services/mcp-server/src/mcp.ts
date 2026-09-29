import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fx3uRejectedExactForms, fx3uVerifiedForms } from "@plc-ladder-mcp/ladder-ir";
import {
  deleteNetwork,
  exportGxWorks2Text,
  exportSamSoar,
  getHistory,
  getProject,
  listPendingChanges,
  listSavedProjects,
  modifyNetwork,
  proposeAddCoil,
  proposeAddContact,
  proposeAddCounter,
  proposeAddInstruction,
  proposeAddParallelAction,
  proposeAddReset,
  proposeAddSet,
  proposeAddTimer,
  proposeImportGxWorks2Text,
  proposeLoadProjectSnapshot,
  proposeSemanticChanges,
  proposeSetParallelConditions,
  rejectPendingChange,
  removeAction,
  removeContact,
  replaceDevice,
  saveProjectSnapshot,
  validateProject,
} from "./project.js";

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const contactSpec = z.object({
  device: z.string().min(1),
  mode: z.enum(["NO", "NC"]).default("NO"),
  edge: z.enum(["none", "rising", "falling"]).default("none"),
});

const semanticOperation = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_project"),
    name: z.string().min(1),
    plc_family: z.string().default("Mitsubishi FX"),
    plc_model: z.string().default("FX3U"),
  }),
  z.object({
    type: z.literal("create_network"),
    network_id: z.number().int().nonnegative().optional(),
    comment: z.string().optional(),
  }),
  z.object({
    type: z.literal("add_contact"),
    device: z.string().min(1),
    mode: z.enum(["NO", "NC"]).default("NO"),
    edge: z.enum(["none", "rising", "falling"]).default("none"),
    network_id: z.number().int().nonnegative().default(0),
  }),
  z.object({
    type: z.literal("add_coil"),
    device: z.string().min(1),
    network_id: z.number().int().nonnegative().default(0),
  }),
  z.object({
    type: z.literal("add_set"),
    device: z.string().min(1),
    network_id: z.number().int().nonnegative().default(0),
  }),
  z.object({
    type: z.literal("add_reset"),
    device: z.string().min(1),
    network_id: z.number().int().nonnegative().default(0),
  }),
  z.object({
    type: z.literal("add_timer"),
    timer: z.string().min(1),
    preset: z.number().int().nonnegative(),
    network_id: z.number().int().nonnegative().default(0),
  }),
  z.object({
    type: z.literal("add_counter"),
    counter: z.string().min(1),
    preset: z.number().int().nonnegative(),
    network_id: z.number().int().nonnegative().default(0),
  }),
  z.object({
    type: z.literal("add_instruction"),
    opcode: z.string().min(1),
    operands: z.array(z.string()).default([]),
    network_id: z.number().int().nonnegative().default(0),
  }),
  z.object({
    type: z.literal("add_parallel_action"),
    kind: z.enum(["coil", "set", "reset", "instruction"]),
    value: z.string().min(1),
    operands: z.array(z.string()).default([]),
    network_id: z.number().int().nonnegative().default(0),
  }),
  z.object({
    type: z.literal("set_parallel_conditions"),
    branches: z.array(z.array(contactSpec).min(1)).min(2),
    network_id: z.number().int().nonnegative().default(0),
  }),
]);

export function createMcpServer() {
  const server = new McpServer({ name: "plc-ladder-mcp", version: "0.3.0" });

  server.tool(
    "get_project",
    "Return the current canonical Ladder IR v0.2. This is read-only.",
    {},
    async () => json(getProject()),
  );

  server.tool(
    "get_fx3u_capabilities",
    "Return exact GX Works2 verification evidence and known rejected operand forms for FX3U. Check this before choosing applied-instruction operand forms.",
    {},
    async () => json({ verified_forms: fx3uVerifiedForms, rejected_forms: fx3uRejectedExactForms }),
  );

  server.tool(
    "propose_changes",
    "PRIMARY WRITE TOOL. Build one complete AI proposal from multiple semantic operations. Nothing is applied until the human approves it in the Web AI Changes screen. Use one batch for a new project/network so the final proposed project validates as a whole.",
    {
      operations: z.array(semanticOperation).min(1),
    },
    async ({ operations }) => json(proposeSemanticChanges(operations, false)),
  );

  server.tool(
    "add_contact",
    "Propose adding one contact to an existing network. This NEVER applies directly; it creates a pending human-review change.",
    {
      device: z.string().min(1),
      mode: z.enum(["NO", "NC"]).default("NO"),
      edge: z.enum(["none", "rising", "falling"]).default("none"),
      network_id: z.number().int().nonnegative().default(0),
    },
    async ({ device, mode, edge, network_id }) =>
      json(proposeAddContact(device, mode, network_id, false, edge)),
  );

  server.tool(
    "add_coil",
    "Propose adding an output coil to an existing network. Human approval is required.",
    {
      device: z.string().min(1),
      network_id: z.number().int().nonnegative().default(0),
    },
    async ({ device, network_id }) => json(proposeAddCoil(device, network_id, false)),
  );

  server.tool(
    "add_set",
    "Propose adding a SET action. Human approval is required.",
    {
      device: z.string().min(1),
      network_id: z.number().int().nonnegative().default(0),
    },
    async ({ device, network_id }) => json(proposeAddSet(device, network_id, false)),
  );

  server.tool(
    "add_reset",
    "Propose adding an RST action. Human approval is required.",
    {
      device: z.string().min(1),
      network_id: z.number().int().nonnegative().default(0),
    },
    async ({ device, network_id }) => json(proposeAddReset(device, network_id, false)),
  );

  server.tool(
    "add_timer",
    "Propose an FX3U timer action serialized as OUT Tn Kpreset. Human approval is required.",
    {
      timer: z.string().min(1),
      preset: z.number().int().nonnegative(),
      network_id: z.number().int().nonnegative().default(0),
    },
    async ({ timer, preset, network_id }) => json(proposeAddTimer(timer, preset, network_id, false)),
  );

  server.tool(
    "add_counter",
    "Propose an FX3U counter action serialized as OUT Cn Kpreset. Human approval is required.",
    {
      counter: z.string().min(1),
      preset: z.number().int().nonnegative(),
      network_id: z.number().int().nonnegative().default(0),
    },
    async ({ counter, preset, network_id }) => json(proposeAddCounter(counter, preset, network_id, false)),
  );

  server.tool(
    "add_instruction",
    "Propose a generic FX3U instruction action. Exact operand-form capability evidence is validated where known. Human approval is required.",
    {
      opcode: z.string().min(1),
      operands: z.array(z.string()).default([]),
      network_id: z.number().int().nonnegative().default(0),
    },
    async ({ opcode, operands, network_id }) =>
      json(proposeAddInstruction(opcode, operands, network_id, false)),
  );

  server.tool(
    "add_parallel_action",
    "Propose an explicit parallel output action on a network with an existing output. Human approval is required.",
    {
      kind: z.enum(["coil", "set", "reset", "instruction"]),
      value: z.string().min(1).describe("Device for coil/set/reset, or opcode for instruction."),
      operands: z.array(z.string()).default([]),
      network_id: z.number().int().nonnegative().default(0),
    },
    async ({ kind, value, operands, network_id }) =>
      json(proposeAddParallelAction(kind, value, operands, network_id, false)),
  );

  server.tool(
    "set_parallel_conditions",
    "Propose replacing a network condition with two or more parallel contact branches. Human approval is required.",
    {
      branches: z.array(z.array(contactSpec).min(1)).min(2),
      network_id: z.number().int().nonnegative().default(0),
    },
    async ({ branches, network_id }) =>
      json(proposeSetParallelConditions(branches, network_id, false)),
  );

  server.tool(
    "remove_contact",
    "Propose removing a direct series contact by node id. This NEVER applies directly.",
    {
      contact_id: z.string().min(1),
      network_id: z.number().int().nonnegative().default(0),
    },
    async ({ contact_id, network_id }) => json(removeContact(contact_id, network_id, false)),
  );

  server.tool(
    "remove_action",
    "Propose removing an output action by action/node id. This NEVER applies directly.",
    {
      action_id: z.string().min(1),
      network_id: z.number().int().nonnegative().default(0),
    },
    async ({ action_id, network_id }) => json(removeAction(action_id, network_id, false)),
  );

  server.tool(
    "replace_device",
    "Propose an exact PLC-device replacement. Omit network_id to target the whole current program. This NEVER applies directly.",
    {
      from_device: z.string().min(1),
      to_device: z.string().min(1),
      network_id: z.number().int().nonnegative().optional(),
    },
    async ({ from_device, to_device, network_id }) =>
      json(replaceDevice(from_device, to_device, network_id, false)),
  );

  server.tool(
    "delete_network",
    "Propose deleting a network. The final remaining network cannot be deleted. This NEVER applies directly.",
    {
      network_id: z.number().int().nonnegative(),
    },
    async ({ network_id }) => json(deleteNetwork(network_id, false)),
  );

  server.tool(
    "modify_network",
    "Propose changing network metadata, currently the comment. This NEVER applies directly.",
    {
      network_id: z.number().int().nonnegative(),
      comment: z.string().nullable(),
    },
    async ({ network_id, comment }) => json(modifyNetwork(network_id, comment, false)),
  );

  server.tool(
    "import_gxworks2",
    "Propose importing GX Works2 List CSV/TSV text into canonical IR v0.2. The imported project is not applied until human approval.",
    {
      content: z.string().min(1),
    },
    async ({ content }) => json(proposeImportGxWorks2Text(content, false)),
  );

  server.tool(
    "load_project",
    "Propose loading a named saved project snapshot. The current project is not replaced until human approval.",
    {
      name: z.string().min(1),
    },
    async ({ name }) => json(proposeLoadProjectSnapshot(name, false)),
  );

  server.tool(
    "list_pending_changes",
    "List AI proposals waiting for human review, including diff, validation, and stale status. AI cannot approve its own proposals.",
    {},
    async () => json(listPendingChanges()),
  );

  server.tool(
    "get_history",
    "Return the project change log and undo/redo availability. Undo/redo are human Web actions and are not exposed as AI write tools.",
    {},
    async () => json(getHistory()),
  );

  server.tool(
    "list_saved_projects",
    "List named JSON project snapshots stored by the server. This is read-only.",
    {},
    async () => json(listSavedProjects()),
  );

  server.tool(
    "save_project",
    "Save a named JSON snapshot of the current already-approved canonical project. This does not change Ladder logic.",
    {
      name: z.string().min(1).optional(),
    },
    async ({ name }) => json(saveProjectSnapshot(name)),
  );

  server.tool(
    "reject_pending_change",
    "Discard one pending AI proposal. Rejection cannot modify canonical Ladder logic.",
    {
      pending_change_id: z.string().min(1),
    },
    async ({ pending_change_id }) => json(rejectPendingChange(pending_change_id)),
  );

  server.tool(
    "validate_project",
    "Validate the current approved canonical IR v0.2 and FX3U compiler topology rules. This is read-only.",
    {},
    async () => json(validateProject()),
  );

  server.tool(
    "export_project",
    "Compile the current approved project to a supported PLC IDE interchange format. This is read-only.",
    {
      target: z.enum(["samsoar2022", "gxworks2"]),
    },
    async ({ target }) => target === "gxworks2" ? json({
      target,
      filename: "plc-ladder-gxworks2.csv",
      encoding: "UTF-16 LE with BOM required at file boundary",
      content: exportGxWorks2Text(),
    }) : json({
      target,
      filename: "plc-ladder-samsoar.csv",
      encoding: "UTF-8 with BOM",
      content: exportSamSoar(),
    }),
  );

  return server;
}
