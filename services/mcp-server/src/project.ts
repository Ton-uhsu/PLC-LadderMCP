import type {
  ActionNode,
  LadderNetworkV02,
  LadderProjectV02,
  LogicNode,
  Operand,
} from "@plc-ladder-mcp/ladder-ir";
import { generateGxWorks2ListText, validateFx3uV02 } from "@plc-ladder-mcp/ladder-ir";

const dev = (address: string) => ({ kind: "device" as const, address });

let project: LadderProjectV02 = {
  version: "0.2",
  name: "Untitled PLC Project",
  plc: { family: "Mitsubishi FX", model: "FX3U" },
  programs: [{
    name: "Main",
    networks: [{ id: 0, root: { kind: "series", id: "network-0", children: [] } }],
  }],
};

export function createProject(name: string, family: string, model: string): LadderProjectV02 {
  if (family !== "Mitsubishi FX" || model !== "FX3U") {
    throw new Error("Canonical IR v0.2 currently supports Mitsubishi FX3U only.");
  }
  project = {
    version: "0.2",
    name,
    plc: { family: "Mitsubishi FX", model: "FX3U" },
    programs: [{
      name: "Main",
      networks: [{ id: 0, root: { kind: "series", id: "network-0", children: [] } }],
    }],
  };
  return project;
}

export function getProject(): LadderProjectV02 { return project; }

export function createNetwork(comment?: string, requestedId?: number) {
  const networks = project.programs[0].networks;
  const nextId = networks.length ? Math.max(...networks.map(n => n.id)) + 1 : 0;
  const id = requestedId ?? nextId;
  if (!Number.isInteger(id) || id < 0) throw new Error("network_id must be a non-negative integer.");
  if (networks.some(n => n.id === id)) throw new Error(`Network ${id} already exists.`);

  const network: LadderNetworkV02 = {
    id,
    root: { kind: "series", id: `network-${id}`, children: [] },
    ...(comment?.trim() ? { comment: comment.trim() } : {}),
  };
  networks.push(network);
  networks.sort((a, b) => a.id - b.id);
  return network;
}

export function addContact(device: string, mode: "NO" | "NC", networkId = 0) {
  const root = requireSeriesRoot(networkId);
  const node: Extract<LogicNode, { kind: "contact" }> = {
    kind: "contact",
    id: crypto.randomUUID(),
    device: dev(normalizeDevice(device)),
    mode,
    edge: "none",
  };
  const outputIndex = root.children.findIndex(isOutputNode);
  if (outputIndex >= 0) root.children.splice(outputIndex, 0, node);
  else root.children.push(node);
  return node;
}

export function addCoil(device: string, networkId = 0) {
  return appendAction({
    kind: "coil",
    id: crypto.randomUUID(),
    device: dev(normalizeDevice(device)),
  }, networkId);
}

export function addSet(device: string, networkId = 0) {
  return appendAction({
    kind: "set",
    id: crypto.randomUUID(),
    device: dev(normalizeDevice(device)),
  }, networkId);
}

export function addReset(device: string, networkId = 0) {
  return appendAction({
    kind: "reset",
    id: crypto.randomUUID(),
    device: dev(normalizeDevice(device)),
  }, networkId);
}

export function addTimer(timer: string, preset: number, networkId = 0) {
  const address = normalizeDevice(timer);
  if (!/^T\d+$/.test(address)) throw new Error("Timer target must use a T device, for example T0.");
  assertNonNegativeInteger(preset, "Timer preset");
  return appendAction({
    kind: "instruction",
    id: crypto.randomUUID(),
    opcode: "OUT",
    operands: [dev(address), { kind: "constant", radix: "decimal", value: preset }],
  }, networkId);
}

export function addCounter(counter: string, preset: number, networkId = 0) {
  const address = normalizeDevice(counter);
  if (!/^C\d+$/.test(address)) throw new Error("Counter target must use a C device, for example C0.");
  assertNonNegativeInteger(preset, "Counter preset");
  return appendAction({
    kind: "instruction",
    id: crypto.randomUUID(),
    opcode: "OUT",
    operands: [dev(address), { kind: "constant", radix: "decimal", value: preset }],
  }, networkId);
}

export function addInstruction(opcode: string, operands: string[], networkId = 0) {
  const normalizedOpcode = normalizeOpcode(opcode);
  return appendAction({
    kind: "instruction",
    id: crypto.randomUUID(),
    opcode: normalizedOpcode,
    operands: operands.map(parseOperand),
  }, networkId);
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

  return appendAction(action, networkId, true);
}

export function validateProject() {
  const result = validateFx3uV02(project);
  const issues = [...result.issues];

  for (const program of project.programs) {
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
      if (!root.children.some(n => n.kind === "contact")) {
        issues.push({
          severity: "error" as const,
          code: "MISSING_CONDITION",
          message: `Network ${network.id} requires at least one contact condition.`,
          path: `network[${network.id}].root`,
        });
      }
      if (!root.children.some(isOutputNode)) {
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

export function exportGxWorks2Text() {
  const validation = validateProject();
  if (!validation.valid) {
    throw new Error(validation.issues.filter(i => i.severity === "error").map(i => i.message).join("; "));
  }
  return generateGxWorks2ListText(project);
}

export function exportSamSoar() {
  const validation = validateProject();
  if (!validation.valid) {
    throw new Error(validation.issues.filter(i => i.severity === "error").map(i => i.message).join("; "));
  }

  const lines: string[] = [];
  for (const program of project.programs) {
    lines.push(`Program,${program.name}`);
    for (const network of program.networks) {
      lines.push(`Network,${network.id}`);
      const root = network.root;
      if (root.kind !== "series") throw new Error("SamSoar adapter currently requires a series root.");

      const contacts = root.children.filter(
        (n): n is Extract<LogicNode, { kind: "contact" }> => n.kind === "contact",
      );
      contacts.forEach((contact, index) => {
        const mnemonic = index === 0
          ? (contact.mode === "NC" ? "LDI" : "LD")
          : (contact.mode === "NC" ? "ANI" : "AND");
        lines.push(`${mnemonic},${samDevice(contact.device.address)}`);
      });

      const tail = root.children[root.children.length - 1];
      const outputs = tail?.kind === "parallel" ? tail.branches : tail ? [tail] : [];
      for (const output of outputs) {
        if (output.kind !== "action" || output.action.kind !== "coil") {
          throw new Error("SamSoar adapter currently supports coil outputs only.");
        }
        lines.push(`OUT,${samDevice(output.action.device.address)}`);
      }
      lines.push("POP");
    }
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

function appendAction(action: ActionNode, networkId: number, requireExistingOutput = false) {
  const root = requireSeriesRoot(networkId);
  const node: Extract<LogicNode, { kind: "action" }> = {
    kind: "action",
    id: `action-${action.id}`,
    action,
  };

  const tail = root.children[root.children.length - 1];

  if (!tail || tail.kind === "contact") {
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
      throw new Error("Current semantic API only appends parallel output actions, not nested condition branches.");
    }
    tail.branches.push(node);
    return node;
  }

  throw new Error("Network tail is not a supported output topology.");
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
