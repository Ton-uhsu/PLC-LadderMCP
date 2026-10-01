import type {
  ActionNode,
  LadderNetworkV02,
  LadderProjectV02,
  LogicNode,
  Operand,
} from "@plc-ladder-mcp/ladder-ir";
import { generateGxWorks2ListText, parseGxWorks2ListText, validateFx3uV02, normalizeWires, containsAction, outputActions } from "@plc-ladder-mcp/ladder-ir";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hash, snapshotSchema } from "./persistence/snapshot.js";

const dev = (address: string) => ({ kind: "device" as const, address });

const DEFAULT_DATA_DIR = fileURLToPath(new URL("../../../.plc-ladder/", import.meta.url));
const LEGACY_DATA_DIR = join(process.cwd(), ".plc-ladder");
const DATA_DIR = process.env.PLC_LADDER_DATA_DIR || DEFAULT_DATA_DIR;
const CURRENT_PROJECT_FILE = join(DATA_DIR, "current-project.json");
const SAVED_PROJECTS_DIR = join(DATA_DIR, "projects");

function migrateLegacyWorkspaceData() {
  if (process.env.PLC_LADDER_DATA_DIR) return;
  if (LEGACY_DATA_DIR === DATA_DIR || !existsSync(LEGACY_DATA_DIR)) return;

  const legacyCurrent = join(LEGACY_DATA_DIR, "current-project.json");
  if (!existsSync(CURRENT_PROJECT_FILE) && existsSync(legacyCurrent)) {
    mkdirSync(DATA_DIR, { recursive: true });
    copyFileSync(legacyCurrent, CURRENT_PROJECT_FILE);
  }

  const legacyProjects = join(LEGACY_DATA_DIR, "projects");
  if (existsSync(legacyProjects)) {
    mkdirSync(SAVED_PROJECTS_DIR, { recursive: true });
    for (const name of readdirSync(legacyProjects)) {
      if (!name.toLowerCase().endsWith(".json")) continue;
      const destination = join(SAVED_PROJECTS_DIR, name);
      if (!existsSync(destination)) copyFileSync(join(legacyProjects, name), destination);
    }
  }
}

migrateLegacyWorkspaceData();

function newEmptyProject(name = "Untitled PLC Project"): LadderProjectV02 {
  return {
    version: "0.2",
    name,
    plc: { family: "Mitsubishi FX", model: "FX3U" },
    programs: [{
      name: "Main",
      networks: [{ id: 0, root: { kind: "series", id: "network-0", children: [] } }],
    }],
  };
}

function readProjectFile(path: string): LadderProjectV02 {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as LadderProjectV02;
  if (parsed.version !== "0.2" || parsed.plc?.family !== "Mitsubishi FX" || parsed.plc?.model !== "FX3U") {
    throw new Error("Project file is not a supported Mitsubishi FX3U IR v0.2 project.");
  }
  return parsed;
}

function loadInitialProject(): LadderProjectV02 {
  try {
    return existsSync(CURRENT_PROJECT_FILE) ? readProjectFile(CURRENT_PROJECT_FILE) : newEmptyProject();
  } catch {
    return newEmptyProject();
  }
}

let project: LadderProjectV02 = loadInitialProject();

function persistCurrentProject() {
  mkdirSync(dirname(CURRENT_PROJECT_FILE), { recursive: true });
  writeFileSync(CURRENT_PROJECT_FILE, JSON.stringify(project, null, 2) + "\n", "utf8");
}

function safeProjectFileName(input: string) {
  const clean = basename(input.trim()).replace(/\.json$/i, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!clean) throw new Error("Saved project name must contain at least one safe filename character.");
  return clean + ".json";
}

export function listSavedProjects() {
  mkdirSync(SAVED_PROJECTS_DIR, { recursive: true });
  return readdirSync(SAVED_PROJECTS_DIR)
    .filter(name => name.toLowerCase().endsWith(".json"))
    .sort()
    .map(name => ({ name: name.replace(/\.json$/i, ""), file: name }));
}

export function saveProjectSnapshot(name = project.name) {
  mkdirSync(SAVED_PROJECTS_DIR, { recursive: true });
  const file = safeProjectFileName(name);
  const path = join(SAVED_PROJECTS_DIR, file);
  writeFileSync(path, JSON.stringify(project, null, 2) + "\n", "utf8");
  return { name: file.replace(/\.json$/i, ""), file, project };
}

export function loadProjectSnapshot(name: string) {
  const file = safeProjectFileName(name);
  const next = readProjectFile(join(SAVED_PROJECTS_DIR, file));
  pendingChanges.clear();
  commitProject(next, "load_project", "Load saved project " + file.replace(/\.json$/i, ""), "direct");
  return { name: file.replace(/\.json$/i, ""), file, project };
}

export function importProjectJson(raw: string, source = "import") {
  const next = JSON.parse(raw) as LadderProjectV02;
  if (next.version !== "0.2" || next.plc?.family !== "Mitsubishi FX" || next.plc?.model !== "FX3U") {
    throw new Error("Imported project must be Mitsubishi FX3U IR v0.2.");
  }
  const validation = validateProjectState(next);
  if (!validation.valid) throw new Error(validation.issues.filter(i => i.severity === "error").map(i => i.message).join("; "));
  pendingChanges.clear();
  commitProject(next, "import_project", "Import project from " + source, "direct");
  return { project, validation };
}

export function createProject(name: string, family: string, model: string): LadderProjectV02 {
  if (family !== "Mitsubishi FX" || model !== "FX3U") {
    throw new Error("Canonical IR v0.2 currently supports Mitsubishi FX3U only.");
  }
  pendingChanges.clear();
  undoStack.splice(0);
  redoStack.splice(0);
  changeLog.splice(0);
  project = {
    version: "0.2",
    name,
    plc: { family: "Mitsubishi FX", model: "FX3U" },
    programs: [{
      name: "Main",
      networks: [{ id: 0, root: { kind: "series", id: "network-0", children: [] } }],
    }],
  };
  addChangeLog("change", "create_project", "Create project " + name, "direct");
  persistCurrentProject();
  return project;
}

export function getProject(): LadderProjectV02 { return project; }

export function createNetwork(comment?: string, requestedId?: number) {
  const networks = project.programs[0].networks;
  const nextId = networks.length ? Math.max(...networks.map(n => n.id)) + 1 : 0;
  const id = requestedId ?? nextId;
  if (!Number.isInteger(id) || id < 0) throw new Error("network_id must be a non-negative integer.");
  if (networks.some(n => n.id === id)) throw new Error("Network " + id + " already exists.");

  return mutateProject("create_network", "Create network " + id, () => {
    const network: LadderNetworkV02 = {
      id,
      root: { kind: "series", id: "network-" + id, children: [] },
      ...(comment?.trim() ? { comment: comment.trim() } : {}),
    };
    project.programs[0].networks.push(network);
    project.programs[0].networks.sort((a, b) => a.id - b.id);
    return network;
  });
}

export type ContactSpec = {
  device: string;
  mode?: "NO" | "NC";
  edge?: "none" | "rising" | "falling";
};

export function setParallelConditions(branches: ContactSpec[][], networkId = 0) {
  if (branches.length < 2) throw new Error("Parallel condition requires at least two branches.");
  if (branches.some(branch => branch.length < 1)) throw new Error("Each parallel condition branch requires at least one contact.");
  if (branches.some(branch => branch.some(spec => (spec.edge ?? "none") !== "none" && spec.mode === "NC"))) {
    throw new Error("Pulse edge contacts currently support NO mode only.");
  }

  return mutateProject("set_parallel_conditions", "Set parallel condition branches on network " + networkId, () => {
    const root = requireSeriesRoot(networkId);
    const tail = root.children.at(-1);
    if (!tail || !isOutputNode(tail)) throw new Error("Network must already have an output action before setting parallel conditions.");

    const branchNodes: LogicNode[] = branches.map((branch, branchIndex) => {
      const contacts: LogicNode[] = branch.map((spec, contactIndex) => ({
        kind: "contact" as const,
        id: "condition-" + networkId + "-" + branchIndex + "-" + contactIndex + "-" + crypto.randomUUID(),
        device: dev(normalizeDevice(spec.device)),
        mode: spec.mode ?? "NO",
        edge: spec.edge ?? "none",
      }));
      return contacts.length === 1
        ? contacts[0]
        : { kind: "series" as const, id: "condition-series-" + crypto.randomUUID(), children: contacts };
    });

    const condition: LogicNode = {
      kind: "parallel",
      id: "condition-parallel-" + crypto.randomUUID(),
      branches: branchNodes,
    };
    root.children = [condition, tail];
    return condition;
  });
}

export function importGxWorks2Text(raw: string) {
  const next = parseGxWorks2ListText(raw);
  const validation = validateProjectState(next);
  if (!validation.valid) {
    throw new Error(validation.issues.filter(issue => issue.severity === "error").map(issue => issue.message).join("; "));
  }
  pendingChanges.clear();
  commitProject(next, "import_gxworks2", "Import GX Works2 List file", "direct");
  return { project, validation };
}

export function proposeImportGxWorks2Text(raw: string, apply = false): EditResult {
  const next = parseGxWorks2ListText(raw);
  return editProject("import_gxworks2", apply, draft => {
    const before = cloneValue(draft);
    Object.assign(draft, cloneValue(next));
    return {
      summary: "Import GX Works2 List file",
      changes: [{ path: "project", before, after: cloneValue(next) }],
    };
  });
}

export function proposeLoadProjectSnapshot(name: string, apply = false): EditResult {
  const file = safeProjectFileName(name);
  const next = readProjectFile(join(SAVED_PROJECTS_DIR, file));
  return editProject("load_project", apply, draft => {
    const before = cloneValue(draft);
    Object.assign(draft, cloneValue(next));
    return {
      summary: "Load saved project " + file.replace(/\.json$/i, ""),
      changes: [{ path: "project", before, after: cloneValue(next) }],
    };
  });
}

export function addContact(device: string, mode: "NO" | "NC", networkId = 0) {
  const address = normalizeDevice(device);
  return mutateProject("add_contact", "Add " + mode + " contact " + address + " to network " + networkId, () => {
    const root = requireSeriesRoot(networkId);
    const node: Extract<LogicNode, { kind: "contact" }> = {
      kind: "contact",
      id: crypto.randomUUID(),
      device: dev(address),
      mode,
      edge: "none",
    };
    const outputIndex = root.children.findIndex(isOutputNode);
    if (outputIndex >= 0) root.children.splice(outputIndex, 0, node);
    else root.children.push(node);
    return node;
  });
}

export function addCoil(device: string, networkId = 0) {
  const address = normalizeDevice(device);
  return mutateProject("add_coil", "Add coil " + address + " to network " + networkId, () =>
    appendAction({
      kind: "coil",
      id: crypto.randomUUID(),
      device: dev(address),
    }, networkId)
  );
}

export function addSet(device: string, networkId = 0) {
  const address = normalizeDevice(device);
  return mutateProject("add_set", "Add SET " + address + " to network " + networkId, () =>
    appendAction({
      kind: "set",
      id: crypto.randomUUID(),
      device: dev(address),
    }, networkId)
  );
}

export function addReset(device: string, networkId = 0) {
  const address = normalizeDevice(device);
  return mutateProject("add_reset", "Add RST " + address + " to network " + networkId, () =>
    appendAction({
      kind: "reset",
      id: crypto.randomUUID(),
      device: dev(address),
    }, networkId)
  );
}

export function addTimer(timer: string, preset: number, networkId = 0) {
  const address = normalizeDevice(timer);
  if (!/^T\d+$/.test(address)) throw new Error("Timer target must use a T device, for example T0.");
  assertNonNegativeInteger(preset, "Timer preset");
  return mutateProject("add_timer", "Add timer " + address + " K" + preset + " to network " + networkId, () =>
    appendAction({
      kind: "instruction",
      id: crypto.randomUUID(),
      opcode: "OUT",
      operands: [dev(address), { kind: "constant", radix: "decimal", value: preset }],
    }, networkId)
  );
}

export function addCounter(counter: string, preset: number, networkId = 0) {
  const address = normalizeDevice(counter);
  if (!/^C\d+$/.test(address)) throw new Error("Counter target must use a C device, for example C0.");
  assertNonNegativeInteger(preset, "Counter preset");
  return mutateProject("add_counter", "Add counter " + address + " K" + preset + " to network " + networkId, () =>
    appendAction({
      kind: "instruction",
      id: crypto.randomUUID(),
      opcode: "OUT",
      operands: [dev(address), { kind: "constant", radix: "decimal", value: preset }],
    }, networkId)
  );
}

export function addInstruction(opcode: string, operands: string[], networkId = 0) {
  const normalizedOpcode = normalizeOpcode(opcode);
  const parsedOperands = operands.map(parseOperand);
  return mutateProject("add_instruction", "Add " + normalizedOpcode + " to network " + networkId, () =>
    appendAction({
      kind: "instruction",
      id: crypto.randomUUID(),
      opcode: normalizedOpcode,
      operands: parsedOperands,
    }, networkId)
  );
}

export function addParallelAction(
  kind: "coil" | "set" | "reset" | "instruction",
  value: string,
  operands: string[] = [],
  networkId = 0,
) {
  const action: ActionNode = kind === "instruction"
    ? {
        kind: "instruction",
        id: crypto.randomUUID(),
        opcode: normalizeOpcode(value),
        operands: operands.map(parseOperand),
      }
    : {
        kind,
        id: crypto.randomUUID(),
        device: dev(normalizeDevice(value)),
      };

  return mutateProject("add_parallel_action", "Add parallel " + kind + " action to network " + networkId, () =>
    appendAction(action, networkId, true)
  );
}

function validateProjectState(target: LadderProjectV02) {
  const result = validateFx3uV02(target);
  const issues = [...result.issues];

  for (const program of target.programs) {
    for (const network of program.networks) {
      const root = network.root;
      if (root.kind !== "series") {
        issues.push({
          severity: "error" as const,
          code: "ROOT_TOPOLOGY",
          message: "Current FX3U mutation/compiler slice requires a series root.",
          path: `network[${network.id}].root`,
        });
        continue;
      }
      if (!root.children.slice(0, root.children.findIndex(containsAction)).some(hasConditionPath)) {
        issues.push({
          severity: "error" as const,
          code: "MISSING_CONDITION",
          message: `Network ${network.id} requires a contact condition or a connected wire path.`,
          path: `network[${network.id}].root`,
        });
      }
      if (!root.children.some(containsAction)) {
        issues.push({
          severity: "error" as const,
          code: "MISSING_OUTPUT",
          message: `Network ${network.id} requires at least one output action.`,
          path: `network[${network.id}].root`,
        });
      }
    }
  }

  return { valid: !issues.some(i => i.severity === "error"), issues };
}

export function validateProject() {
  return validateProjectState(project);
}


export type EditChange = {
  path: string;
  before: unknown;
  after: unknown;
};

export type EditResult = {
  operation: string;
  applied: boolean;
  summary: string;
  changes: EditChange[];
  validation: ReturnType<typeof validateProjectState>;
  pending_change_id?: string;
};

export type PendingChange = {
  id: string;
  operation: string;
  summary: string;
  changes: EditChange[];
  validation: ReturnType<typeof validateProjectState>;
  created_at: string;
  stale: boolean;
};

type PendingChangeInternal = PendingChange & {
  base_state: string;
  next_project: LadderProjectV02;
};

const pendingChanges = new Map<string, PendingChangeInternal>();

const HISTORY_LIMIT = 50;

type HistoryFrame = {
  project: LadderProjectV02;
  operation: string;
  summary: string;
  created_at: string;
};

export type ChangeLogEntry = {
  id: string;
  kind: "change" | "undo" | "redo";
  operation: string;
  summary: string;
  source: "direct" | "approved" | "history";
  created_at: string;
};

const undoStack: HistoryFrame[] = [];
const redoStack: HistoryFrame[] = [];
const changeLog: ChangeLogEntry[] = [];

function addChangeLog(kind: ChangeLogEntry["kind"], operation: string, summary: string, source: ChangeLogEntry["source"]) {
  changeLog.push({ id: crypto.randomUUID(), kind, operation, summary, source, created_at: new Date().toISOString() });
  if (changeLog.length > HISTORY_LIMIT * 4) changeLog.splice(0, changeLog.length - HISTORY_LIMIT * 4);
}

function commitProject(nextProject: LadderProjectV02, operation: string, summary: string, source: "direct" | "approved" = "direct") {
  undoStack.push({ project: cloneValue(project), operation, summary, created_at: new Date().toISOString() });
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.splice(0);
  project = cloneValue(nextProject);
  addChangeLog("change", operation, summary, source);
  persistCurrentProject();
}

function mutateProject<T>(operation: string, summary: string, mutate: () => T): T {
  const before = cloneValue(project);
  try {
    const result = mutate();
    undoStack.push({ project: before, operation, summary, created_at: new Date().toISOString() });
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.splice(0);
    addChangeLog("change", operation, summary, "direct");
    persistCurrentProject();
    return result;
  } catch (error) {
    project = before;
    throw error;
  }
}

export function getHistory() {
  return {
    can_undo: undoStack.length > 0,
    can_redo: redoStack.length > 0,
    undo_count: undoStack.length,
    redo_count: redoStack.length,
    entries: [...changeLog].reverse(),
  };
}

export function undoProject() {
  const frame = undoStack.pop();
  if (!frame) throw new Error("Nothing to undo.");
  redoStack.push({ project: cloneValue(project), operation: frame.operation, summary: frame.summary, created_at: new Date().toISOString() });
  project = cloneValue(frame.project);
  addChangeLog("undo", frame.operation, "Undo: " + frame.summary, "history");
  persistCurrentProject();
  return { ...getHistory(), project };
}

export function redoProject() {
  const frame = redoStack.pop();
  if (!frame) throw new Error("Nothing to redo.");
  undoStack.push({ project: cloneValue(project), operation: frame.operation, summary: frame.summary, created_at: new Date().toISOString() });
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  project = cloneValue(frame.project);
  addChangeLog("redo", frame.operation, "Redo: " + frame.summary, "history");
  persistCurrentProject();
  return { ...getHistory(), project };
}


export function listPendingChanges(): PendingChange[] {
  const current = JSON.stringify(project);
  return [...pendingChanges.values()].map(({ base_state, next_project, ...item }) => ({
    ...item,
    stale: base_state !== current,
  }));
}

export function approvePendingChange(id: string) {
  const pending = pendingChanges.get(id);
  if (!pending) throw new Error("Pending change " + id + " not found.");
  if (pending.base_state !== JSON.stringify(project)) {
    throw new Error("Pending change is stale because the project changed after it was proposed. Preview the edit again.");
  }
  if (!pending.validation.valid) {
    throw new Error("Pending change cannot be approved because its resulting project is invalid.");
  }
  commitProject(pending.next_project, pending.operation, pending.summary, "approved");
  pendingChanges.delete(id);
  return {
    id,
    status: "approved" as const,
    summary: pending.summary,
    project,
  };
}

export function rejectPendingChange(id: string) {
  const pending = pendingChanges.get(id);
  if (!pending) throw new Error(`Pending change ${id} not found.`);
  pendingChanges.delete(id);
  return {
    id,
    status: "rejected" as const,
    summary: pending.summary,
  };
}

export function removeContact(contactId: string, networkId = 0, apply = false): EditResult {
  return editProject("remove_contact", apply, draft => {
    const root = requireSeriesRootFrom(draft, networkId);
    const index = root.children.findIndex(node => node.kind === "contact" && node.id === contactId);
    if (index < 0) throw new Error(`Contact ${contactId} not found in network ${networkId}.`);
    const [removed] = root.children.splice(index, 1);
    return {
      summary: `Remove contact ${contactId} from network ${networkId}`,
      changes: [{ path: `programs[0].networks[${networkId}].root.children[${index}]`, before: removed, after: null }],
    };
  });
}

export function removeAction(actionId: string, networkId = 0, apply = false): EditResult {
  return editProject("remove_action", apply, draft => {
    const root = requireSeriesRootFrom(draft, networkId);
    const tailIndex = root.children.length - 1;
    const tail = root.children[tailIndex];
    if (!tail) throw new Error(`Network ${networkId} has no output action.`);

    if (tail.kind === "action") {
      if (tail.action.id !== actionId && tail.id !== actionId) {
        throw new Error(`Action ${actionId} not found in network ${networkId}.`);
      }
      root.children.splice(tailIndex, 1);
      return {
        summary: `Remove action ${actionId} from network ${networkId}`,
        changes: [{ path: `programs[0].networks[${networkId}].root.children[${tailIndex}]`, before: tail, after: null }],
      };
    }

    if (tail.kind !== "parallel" || !tail.branches.every(branch => branch.kind === "action")) {
      throw new Error("remove_action currently supports a single action tail or parallel output-action tail.");
    }

    const branchIndex = tail.branches.findIndex(branch =>
      branch.kind === "action" && (branch.action.id === actionId || branch.id === actionId)
    );
    if (branchIndex < 0) throw new Error(`Action ${actionId} not found in network ${networkId}.`);

    const before = cloneValue(tail);
    tail.branches.splice(branchIndex, 1);

    if (tail.branches.length === 1) root.children[tailIndex] = tail.branches[0];
    else if (tail.branches.length === 0) root.children.splice(tailIndex, 1);

    return {
      summary: `Remove action ${actionId} from network ${networkId}`,
      changes: [{
        path: `programs[0].networks[${networkId}].root.children[${tailIndex}]`,
        before,
        after: root.children[tailIndex] ?? null,
      }],
    };
  });
}

export function replaceDevice(
  fromDevice: string,
  toDevice: string,
  networkId?: number,
  apply = false,
): EditResult {
  const from = normalizeDevice(fromDevice);
  const to = normalizeDevice(toDevice);

  return editProject("replace_device", apply, draft => {
    const changes: EditChange[] = [];
    const networks = networkId === undefined
      ? draft.programs[0].networks
      : [requireNetworkFrom(draft, networkId)];

    for (const network of networks) {
      replaceDeviceInNode(network.root, from, to, `programs[0].networks[${network.id}].root`, changes);
    }

    if (!changes.length) {
      throw new Error(`Device ${from} was not found${networkId === undefined ? "" : ` in network ${networkId}`}.`);
    }

    return {
      summary: `Replace ${from} with ${to} in ${changes.length} location(s)`,
      changes,
    };
  });
}

export function deleteNetwork(networkId: number, apply = false): EditResult {
  return editProject("delete_network", apply, draft => {
    const networks = draft.programs[0].networks;
    if (networks.length <= 1) throw new Error("Cannot delete the last network in the project.");
    const index = networks.findIndex(network => network.id === networkId);
    if (index < 0) throw new Error(`Network ${networkId} not found.`);
    const [removed] = networks.splice(index, 1);
    return {
      summary: `Delete network ${networkId}`,
      changes: [{ path: `programs[0].networks[${networkId}]`, before: removed, after: null }],
    };
  });
}

export function modifyNetwork(
  networkId: number,
  comment: string | null,
  apply = false,
): EditResult {
  return editProject("modify_network", apply, draft => {
    const network = requireNetworkFrom(draft, networkId);
    const before = network.comment ?? null;
    const normalized = comment?.trim() || undefined;
    if (before === (normalized ?? null)) throw new Error("Network comment is unchanged.");
    if (normalized) network.comment = normalized;
    else delete network.comment;
    return {
      summary: `Update network ${networkId} comment`,
      changes: [{
        path: `programs[0].networks[${networkId}].comment`,
        before,
        after: normalized ?? null,
      }],
    };
  });
}

export function exportGxWorks2Text() {
  const validation = validateProject();
  if (!validation.valid) {
    throw new Error(validation.issues.filter(i => i.severity === "error").map(i => i.message).join("; "));
  }
  return generateGxWorks2ListText(project);
}

export function exportSamSoar(target: LadderProjectV02 = project) {
  const validation = validateProjectState(target);
  if (!validation.valid) {
    throw new Error(validation.issues.filter(i => i.severity === "error").map(i => i.message).join("; "));
  }

  const lines: string[] = [];
  for (const program of target.programs) {
    lines.push(`Program,${program.name}`);
    for (const network of program.networks) {
      lines.push(`Network,${network.id}`);
      const root = network.root;
      if (root.kind !== "series") throw new Error("SamSoar adapter currently requires a series root.");

      const outputIndex = root.children.findIndex(containsAction);
      const conditions = root.children.slice(0, outputIndex).map(normalizeWires).filter((node): node is LogicNode => node !== null);
      if (conditions.some(node => node.kind !== 'contact')) throw new Error('SamSoar adapter currently supports direct series contact conditions only; nested conditions cannot be omitted.');
      const contacts = conditions as Extract<LogicNode, { kind: 'contact' }>[];
      if (!contacts.length) lines.push(`LD,${samDevice('M8000')}`);
      contacts.forEach((contact, index) => {
        const mnemonic = index === 0
          ? (contact.mode === "NC" ? "LDI" : "LD")
          : (contact.mode === "NC" ? "ANI" : "AND");
        lines.push(`${mnemonic},${samDevice(contact.device.address)}`);
      });

      const outputs = outputActions({kind:'series',id:root.id,children:root.children.slice(outputIndex)});
      for (const output of outputs) {
        if (output.kind !== 'coil') throw new Error('SamSoar adapter currently supports coil outputs only.');
        lines.push(`OUT,${samDevice(output.device.address)}`);
      }
      lines.push("POP");
    }
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

function appendActionTo(
  target: LadderProjectV02,
  action: ActionNode,
  networkId: number,
  requireExistingOutput = false,
) {
  const root = requireSeriesRootFrom(target, networkId);
  const node: Extract<LogicNode, { kind: "action" }> = {
    kind: "action",
    id: `action-${action.id}`,
    action,
  };

  const tail = root.children[root.children.length - 1];

  if (!tail || tail.kind === "contact" || tail.kind === "series") {
    if (requireExistingOutput) {
      throw new Error("add_parallel_action requires an existing output action in the target network.");
    }
    root.children.push(node);
    return node;
  }

  if (tail.kind === "action") {
    root.children[root.children.length - 1] = {
      kind: "parallel",
      id: `outputs-${networkId}`,
      branches: [tail, node],
    };
    return node;
  }

  if (tail.kind === "parallel") {
    if (!tail.branches.every(branch => branch.kind === "action")) {
      if (requireExistingOutput) {
        throw new Error("add_parallel_action requires an existing output action in the target network.");
      }
      root.children.push(node);
      return node;
    }
    tail.branches.push(node);
    return node;
  }

  throw new Error("Network tail is not a supported output topology.");
}

function appendAction(action: ActionNode, networkId: number, requireExistingOutput = false) {
  return appendActionTo(project, action, networkId, requireExistingOutput);
}


export type SemanticOperation =
  | { type: "create_project"; name: string; plc_family?: string; plc_model?: string }
  | { type: "create_network"; network_id?: number; comment?: string }
  | { type: "add_contact"; device: string; mode?: "NO" | "NC"; edge?: "none" | "rising" | "falling"; network_id?: number }
  | { type: "add_coil"; device: string; network_id?: number }
  | { type: "add_set"; device: string; network_id?: number }
  | { type: "add_reset"; device: string; network_id?: number }
  | { type: "add_timer"; timer: string; preset: number; network_id?: number }
  | { type: "add_counter"; counter: string; preset: number; network_id?: number }
  | { type: "add_instruction"; opcode: string; operands?: string[]; network_id?: number }
  | { type: "add_parallel_action"; kind: "coil" | "set" | "reset" | "instruction"; value: string; operands?: string[]; network_id?: number }
  | { type: "set_parallel_conditions"; branches: ContactSpec[][]; network_id?: number };

function makeAction(kind: "coil" | "set" | "reset" | "instruction", value: string, operands: string[] = []): ActionNode {
  if (kind === "instruction") {
    return {
      kind: "instruction",
      id: crypto.randomUUID(),
      opcode: normalizeOpcode(value),
      operands: operands.map(parseOperand),
    };
  }
  return {
    kind,
    id: crypto.randomUUID(),
    device: dev(normalizeDevice(value)),
  };
}

function setParallelConditionsOn(target: LadderProjectV02, branches: ContactSpec[][], networkId: number) {
  if (branches.length < 2) throw new Error("Parallel condition requires at least two branches.");
  if (branches.some(branch => branch.length < 1)) throw new Error("Each parallel condition branch requires at least one contact.");
  if (branches.some(branch => branch.some(spec => (spec.edge ?? "none") !== "none" && spec.mode === "NC"))) {
    throw new Error("Pulse edge contacts currently support NO mode only.");
  }

  const root = requireSeriesRootFrom(target, networkId);
  const tail = root.children.at(-1);
  if (!tail || !isOutputNode(tail)) {
    throw new Error("Network must already have an output action before setting parallel conditions.");
  }

  const branchNodes: LogicNode[] = branches.map((branch, branchIndex) => {
    const contacts: LogicNode[] = branch.map((spec, contactIndex) => ({
      kind: "contact" as const,
      id: "condition-" + networkId + "-" + branchIndex + "-" + contactIndex + "-" + crypto.randomUUID(),
      device: dev(normalizeDevice(spec.device)),
      mode: spec.mode ?? "NO",
      edge: spec.edge ?? "none",
    }));
    return contacts.length === 1
      ? contacts[0]
      : { kind: "series" as const, id: "condition-series-" + crypto.randomUUID(), children: contacts };
  });

  const condition: LogicNode = {
    kind: "parallel",
    id: "condition-parallel-" + crypto.randomUUID(),
    branches: branchNodes,
  };
  root.children = [condition, tail];
  return condition;
}

function applySemanticOperation(
  target: LadderProjectV02,
  operation: SemanticOperation,
  changes: EditChange[],
  summaries: string[],
) {
  if (operation.type === "create_project") {
    if ((operation.plc_family ?? "Mitsubishi FX") !== "Mitsubishi FX" || (operation.plc_model ?? "FX3U") !== "FX3U") {
      throw new Error("Canonical IR v0.2 currently supports Mitsubishi FX3U only.");
    }
    const before = cloneValue(target);
    const next = newEmptyProject(operation.name.trim() || "Untitled PLC Project");
    Object.assign(target, next);
    changes.push({ path: "project", before, after: cloneValue(next) });
    summaries.push("Create project " + next.name);
    return;
  }

  if (operation.type === "create_network") {
    const networks = target.programs[0].networks;
    const nextId = networks.length ? Math.max(...networks.map(network => network.id)) + 1 : 0;
    const id = operation.network_id ?? nextId;
    if (!Number.isInteger(id) || id < 0) throw new Error("network_id must be a non-negative integer.");
    if (networks.some(network => network.id === id)) throw new Error("Network " + id + " already exists.");
    const network: LadderNetworkV02 = {
      id,
      root: { kind: "series", id: "network-" + id, children: [] },
      ...(operation.comment?.trim() ? { comment: operation.comment.trim() } : {}),
    };
    networks.push(network);
    networks.sort((a, b) => a.id - b.id);
    changes.push({ path: `programs[0].networks[${id}]`, before: null, after: cloneValue(network) });
    summaries.push("Create network " + id);
    return;
  }

  const networkId = operation.network_id ?? 0;

  if (operation.type === "add_contact") {
    const address = normalizeDevice(operation.device);
    if ((operation.edge ?? "none") !== "none" && operation.mode === "NC") {
      throw new Error("Pulse edge contacts currently support NO mode only.");
    }
    const root = requireSeriesRootFrom(target, networkId);
    const node: Extract<LogicNode, { kind: "contact" }> = {
      kind: "contact",
      id: crypto.randomUUID(),
      device: dev(address),
      mode: operation.mode ?? "NO",
      edge: operation.edge ?? "none",
    };
    const outputIndex = root.children.findIndex(isOutputNode);
    const index = outputIndex >= 0 ? outputIndex : root.children.length;
    root.children.splice(index, 0, node);
    changes.push({ path: `programs[0].networks[${networkId}].root.children[${index}]`, before: null, after: cloneValue(node) });
    summaries.push("Add " + (operation.mode ?? "NO") + " contact " + address + " to network " + networkId);
    return;
  }

  if (operation.type === "set_parallel_conditions") {
    const root = requireSeriesRootFrom(target, networkId);
    const before = cloneValue(root.children.slice(0, -1));
    const condition = setParallelConditionsOn(target, operation.branches, networkId);
    changes.push({
      path: `programs[0].networks[${networkId}].condition`,
      before,
      after: cloneValue(condition),
    });
    summaries.push("Set parallel condition branches on network " + networkId);
    return;
  }

  let action: ActionNode;
  let summary: string;
  let requireExistingOutput = false;

  switch (operation.type) {
    case "add_coil": {
      const address = normalizeDevice(operation.device);
      action = makeAction("coil", address);
      summary = "Add coil " + address + " to network " + networkId;
      break;
    }
    case "add_set": {
      const address = normalizeDevice(operation.device);
      action = makeAction("set", address);
      summary = "Add SET " + address + " to network " + networkId;
      break;
    }
    case "add_reset": {
      const address = normalizeDevice(operation.device);
      action = makeAction("reset", address);
      summary = "Add RST " + address + " to network " + networkId;
      break;
    }
    case "add_timer": {
      const address = normalizeDevice(operation.timer);
      if (!/^T\d+$/.test(address)) throw new Error("Timer target must use a T device, for example T0.");
      assertNonNegativeInteger(operation.preset, "Timer preset");
      action = {
        kind: "instruction",
        id: crypto.randomUUID(),
        opcode: "OUT",
        operands: [dev(address), { kind: "constant", radix: "decimal", value: operation.preset }],
      };
      summary = "Add timer " + address + " K" + operation.preset + " to network " + networkId;
      break;
    }
    case "add_counter": {
      const address = normalizeDevice(operation.counter);
      if (!/^C\d+$/.test(address)) throw new Error("Counter target must use a C device, for example C0.");
      assertNonNegativeInteger(operation.preset, "Counter preset");
      action = {
        kind: "instruction",
        id: crypto.randomUUID(),
        opcode: "OUT",
        operands: [dev(address), { kind: "constant", radix: "decimal", value: operation.preset }],
      };
      summary = "Add counter " + address + " K" + operation.preset + " to network " + networkId;
      break;
    }
    case "add_instruction": {
      const opcode = normalizeOpcode(operation.opcode);
      action = makeAction("instruction", opcode, operation.operands ?? []);
      summary = "Add " + opcode + " to network " + networkId;
      break;
    }
    case "add_parallel_action": {
      action = makeAction(operation.kind, operation.value, operation.operands ?? []);
      summary = "Add parallel " + operation.kind + " action to network " + networkId;
      requireExistingOutput = true;
      break;
    }
    default:
      throw new Error("Unsupported semantic operation.");
  }

  const root = requireSeriesRootFrom(target, networkId);
  const beforeChildren = cloneValue(root.children);
  appendActionTo(target, action, networkId, requireExistingOutput);
  const afterRoot = requireSeriesRootFrom(target, networkId);
  changes.push({
    path: `programs[0].networks[${networkId}].root.children`,
    before: beforeChildren,
    after: cloneValue(afterRoot.children),
  });
  summaries.push(summary);
}

export type ProjectConditionSpec =
  | { type: "series"; contacts: ContactSpec[] }
  | { type: "parallel"; branches: ContactSpec[][] };

export type ProjectActionSpec =
  | { type: "coil"; device: string }
  | { type: "set"; device: string }
  | { type: "reset"; device: string }
  | { type: "timer"; timer: string; preset: number }
  | { type: "counter"; counter: string; preset: number }
  | { type: "instruction"; opcode: string; operands?: string[] };

export type ProjectNetworkSpec = {
  network_id: number;
  comment?: string;
  condition: ProjectConditionSpec;
  actions: ProjectActionSpec[];
};

function contactFromSpec(spec: ContactSpec): Extract<LogicNode, { kind: "contact" }> {
  if ((spec.edge ?? "none") !== "none" && spec.mode === "NC") {
    throw new Error("Pulse edge contacts currently support NO mode only.");
  }
  return {
    kind: "contact",
    id: crypto.randomUUID(),
    device: dev(normalizeDevice(spec.device)),
    mode: spec.mode ?? "NO",
    edge: spec.edge ?? "none",
  };
}

function conditionFromSpec(spec: ProjectConditionSpec): LogicNode {
  if (spec.type === "series") {
    if (!spec.contacts.length) throw new Error("Series condition requires at least one contact.");
    const contacts = spec.contacts.map(contactFromSpec);
    return contacts.length === 1
      ? contacts[0]
      : { kind: "series", id: "condition-series-" + crypto.randomUUID(), children: contacts };
  }

  if (spec.branches.length < 2) throw new Error("Parallel condition requires at least two branches.");
  const branches = spec.branches.map(branch => {
    if (!branch.length) throw new Error("Each parallel condition branch requires at least one contact.");
    const contacts = branch.map(contactFromSpec);
    return contacts.length === 1
      ? contacts[0]
      : { kind: "series" as const, id: "condition-series-" + crypto.randomUUID(), children: contacts };
  });
  return { kind: "parallel", id: "condition-parallel-" + crypto.randomUUID(), branches };
}

function projectActionFromSpec(spec: ProjectActionSpec): ActionNode {
  switch (spec.type) {
    case "coil":
      return makeAction("coil", spec.device);
    case "set":
      return makeAction("set", spec.device);
    case "reset":
      return makeAction("reset", spec.device);
    case "timer": {
      const timer = normalizeDevice(spec.timer);
      if (!/^T\d+$/.test(timer)) throw new Error("Timer target must use a T device, for example T0.");
      assertNonNegativeInteger(spec.preset, "Timer preset");
      return {
        kind: "instruction",
        id: crypto.randomUUID(),
        opcode: "OUT",
        operands: [dev(timer), { kind: "constant", radix: "decimal", value: spec.preset }],
      };
    }
    case "counter": {
      const counter = normalizeDevice(spec.counter);
      if (!/^C\d+$/.test(counter)) throw new Error("Counter target must use a C device, for example C0.");
      assertNonNegativeInteger(spec.preset, "Counter preset");
      return {
        kind: "instruction",
        id: crypto.randomUUID(),
        opcode: "OUT",
        operands: [dev(counter), { kind: "constant", radix: "decimal", value: spec.preset }],
      };
    }
    case "instruction":
      return makeAction("instruction", spec.opcode, spec.operands ?? []);
  }
}

function networkFromSpec(spec: ProjectNetworkSpec): LadderNetworkV02 {
  if (!Number.isInteger(spec.network_id) || spec.network_id < 0) {
    throw new Error("network_id must be a non-negative integer.");
  }
  if (!spec.actions.length) throw new Error("Network " + spec.network_id + " requires at least one action.");

  const condition = conditionFromSpec(spec.condition);
  const actionNodes: LogicNode[] = spec.actions.map(actionSpec => {
    const action = projectActionFromSpec(actionSpec);
    return { kind: "action", id: "action-" + action.id, action };
  });
  const tail: LogicNode = actionNodes.length === 1
    ? actionNodes[0]
    : { kind: "parallel", id: "outputs-" + spec.network_id, branches: actionNodes };

  return {
    id: spec.network_id,
    root: {
      kind: "series",
      id: "network-" + spec.network_id,
      children: [condition, tail],
    },
    ...(spec.comment?.trim() ? { comment: spec.comment.trim() } : {}),
  };
}

export function proposeProjectDefinition(
  name: string,
  networks: ProjectNetworkSpec[],
  apply = false,
): EditResult {
  if (!name.trim()) throw new Error("Project name is required.");
  if (!networks.length) throw new Error("Project requires at least one network.");

  const ids = networks.map(network => network.network_id);
  if (new Set(ids).size !== ids.length) throw new Error("Project network_id values must be unique.");

  const next = newEmptyProject(name.trim());
  next.programs[0].networks = networks
    .map(networkFromSpec)
    .sort((a, b) => a.id - b.id);

  return editProject("propose_project", apply, draft => {
    const before = cloneValue(draft);
    Object.assign(draft, cloneValue(next));
    return {
      summary: "Create complete project " + next.name + " with " + next.programs[0].networks.length + " network(s)",
      changes: [{ path: "project", before, after: cloneValue(next) }],
    };
  });
}


export function proposeSemanticChanges(operations: SemanticOperation[], apply = false): EditResult {
  if (!operations.length) throw new Error("At least one semantic operation is required.");
  const createProjectIndex = operations.findIndex(operation => operation.type === "create_project");
  if (createProjectIndex > 0) throw new Error("create_project must be the first operation in a semantic batch.");
  if (createProjectIndex === 0 && operations.slice(1).some(operation => operation.type === "create_project")) {
    throw new Error("A semantic batch may contain create_project only once.");
  }

  const operationName = operations.length === 1 ? operations[0].type : "semantic_batch";
  return editProject(operationName, apply, draft => {
    const changes: EditChange[] = [];
    const summaries: string[] = [];
    for (const operation of operations) applySemanticOperation(draft, operation, changes, summaries);
    return {
      summary: operations.length === 1
        ? summaries[0]
        : "AI semantic batch: " + summaries.join("; "),
      changes,
    };
  });
}

export function proposeCreateNetwork(comment?: string, requestedId?: number, apply = false) {
  return proposeSemanticChanges([{ type: "create_network", comment, network_id: requestedId }], apply);
}

export function proposeAddContact(
  device: string,
  mode: "NO" | "NC",
  networkId = 0,
  apply = false,
  edge: "none" | "rising" | "falling" = "none",
) {
  return proposeSemanticChanges([{ type: "add_contact", device, mode, edge, network_id: networkId }], apply);
}

export function proposeAddCoil(device: string, networkId = 0, apply = false) {
  return proposeSemanticChanges([{ type: "add_coil", device, network_id: networkId }], apply);
}

export function proposeAddSet(device: string, networkId = 0, apply = false) {
  return proposeSemanticChanges([{ type: "add_set", device, network_id: networkId }], apply);
}

export function proposeAddReset(device: string, networkId = 0, apply = false) {
  return proposeSemanticChanges([{ type: "add_reset", device, network_id: networkId }], apply);
}

export function proposeAddTimer(timer: string, preset: number, networkId = 0, apply = false) {
  return proposeSemanticChanges([{ type: "add_timer", timer, preset, network_id: networkId }], apply);
}

export function proposeAddCounter(counter: string, preset: number, networkId = 0, apply = false) {
  return proposeSemanticChanges([{ type: "add_counter", counter, preset, network_id: networkId }], apply);
}

export function proposeAddInstruction(opcode: string, operands: string[], networkId = 0, apply = false) {
  return proposeSemanticChanges([{ type: "add_instruction", opcode, operands, network_id: networkId }], apply);
}

export function proposeAddParallelAction(
  kind: "coil" | "set" | "reset" | "instruction",
  value: string,
  operands: string[] = [],
  networkId = 0,
  apply = false,
) {
  return proposeSemanticChanges([{ type: "add_parallel_action", kind, value, operands, network_id: networkId }], apply);
}

export function proposeSetParallelConditions(branches: ContactSpec[][], networkId = 0, apply = false) {
  return proposeSemanticChanges([{ type: "set_parallel_conditions", branches, network_id: networkId }], apply);
}


function editProject(
  operation: string,
  apply: boolean,
  mutate: (draft: LadderProjectV02) => { summary: string; changes: EditChange[] },
): EditResult {
  const baseState = JSON.stringify(project);
  const draft = cloneValue(project);
  const { summary, changes } = mutate(draft);
  const validation = validateProjectState(draft);

  if (apply) {
    if (!validation.valid) {
      throw new Error(
        "Cannot apply an invalid semantic change: " +
        validation.issues.filter(issue => issue.severity === "error").map(issue => issue.message).join("; ")
      );
    }
    commitProject(draft, operation, summary, "direct");
    return { operation, applied: true, summary, changes, validation };
  }

  const id = crypto.randomUUID();
  pendingChanges.set(id, {
    id,
    operation,
    summary,
    changes: cloneValue(changes),
    validation,
    created_at: new Date().toISOString(),
    stale: false,
    base_state: baseState,
    next_project: cloneValue(draft),
  });
  return { operation, applied: false, summary, changes, validation, pending_change_id: id };
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireNetworkFrom(target: LadderProjectV02, id: number): LadderNetworkV02 {
  const network = target.programs[0]?.networks.find(n => n.id === id);
  if (!network) throw new Error(`Network ${id} not found`);
  return network;
}

function requireSeriesRootFrom(
  target: LadderProjectV02,
  id: number,
): Extract<LogicNode, { kind: "series" }> {
  const root = requireNetworkFrom(target, id).root;
  if (root.kind !== "series") throw new Error(`Network ${id} does not have a series root`);
  return root;
}

function replaceDeviceInNode(
  node: LogicNode,
  from: string,
  to: string,
  path: string,
  changes: EditChange[],
) {
  if (node.kind === "contact") {
    if (node.device.address === from) {
      changes.push({ path: `${path}.device.address`, before: from, after: to });
      node.device.address = to;
    }
    return;
  }

  if (node.kind === "series") {
    node.children.forEach((child, index) =>
      replaceDeviceInNode(child, from, to, `${path}.children[${index}]`, changes)
    );
    return;
  }

  if (node.kind === "parallel") {
    node.branches.forEach((branch, index) =>
      replaceDeviceInNode(branch, from, to, `${path}.branches[${index}]`, changes)
    );
    return;
  }

  if (node.kind === "wire") return;
  const action = node.action;
  if (action.kind === "instruction") {
    action.operands.forEach((operand, index) => {
      if (operand.kind === "device" && operand.address === from) {
        changes.push({ path: `${path}.action.operands[${index}].address`, before: from, after: to });
        operand.address = to;
      }
    });
    return;
  }

  if (action.device.address === from) {
    changes.push({ path: `${path}.action.device.address`, before: from, after: to });
    action.device.address = to;
  }
}

function requireNetwork(id: number): LadderNetworkV02 {
  const network = project.programs[0]?.networks.find(n => n.id === id);
  if (!network) throw new Error(`Network ${id} not found`);
  return network;
}

function requireSeriesRoot(id: number): Extract<LogicNode, { kind: "series" }> {
  const root = requireNetwork(id).root;
  if (root.kind !== "series") throw new Error(`Network ${id} does not have a series root`);
  return root;
}

function hasConditionPath(node: LogicNode): boolean {
  if (node.kind === "contact") return true;
  if (node.kind === "wire") return node.connected;
  if (node.kind === "action") return false;
  return (node.kind === "series" ? node.children : node.branches).some(hasConditionPath);
}

function isOutputNode(node: LogicNode) {
  return node.kind === "action" ||
    (node.kind === "parallel" && node.branches.every(branch => branch.kind === "action"));
}

function parseOperand(raw: string): Operand {
  const value = raw.trim().toUpperCase();
  const decimal = /^K(-?\d+)$/.exec(value);
  if (decimal) return { kind: "constant", radix: "decimal", value: Number(decimal[1]) };

  const hex = /^H([0-9A-F]+)$/.exec(value);
  if (hex) return { kind: "constant", radix: "hex", value: Number.parseInt(hex[1], 16) };

  if (/^[A-Z]+\d+$/.test(value)) return dev(normalizeDevice(value));

  throw new Error(`Invalid operand "${raw}". Use a PLC device (for example D0), decimal K constant, or hex H constant.`);
}

function normalizeOpcode(opcode: string) {
  const value = opcode.trim().toUpperCase();
  if (!value || !/^[A-Z0-9]+$/.test(value)) {
    throw new Error(`Invalid instruction opcode: ${opcode}`);
  }
  return value;
}

function normalizeDevice(device: string) {
  const value = device.trim().toUpperCase();
  if (!/^[A-Z]+\d+$/.test(value)) throw new Error(`Invalid PLC device: ${device}`);
  return value.replace(/^([A-Z]+)0+(\d+)$/, "$1$2");
}

function assertNonNegativeInteger(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer.`);
}

function samDevice(device: string) {
  return device.replace(/^([A-Z]+)0+(\d+)$/, "$1$2");
}

// Human-only legacy development edit. The application server authenticates this route.
// Preserve pending proposals so their existing stale check can reject an outdated base.
export function saveManualProject(baseSnapshot: unknown, snapshot: unknown) {
  const next = snapshotSchema.parse(snapshot);
  if (hash(baseSnapshot) !== hash(project)) throw new Error("STALE_MANUAL_PROJECT");
  if (hash(next) !== hash(project)) commitProject(next, "manual_project_edit", "Manual project/network edit", "direct");
  return { project: getProject(), history: getHistory() };
}
