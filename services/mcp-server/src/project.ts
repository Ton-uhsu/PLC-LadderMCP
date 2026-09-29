import type { ActionNode, LadderNetworkV02, LadderProjectV02, LogicNode } from "@plc-ladder-mcp/ladder-ir";
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
  const root = requireSeriesRoot(networkId);
  const action: ActionNode = {
    kind: "coil",
    id: crypto.randomUUID(),
    device: dev(normalizeDevice(device)),
  };
  const node: Extract<LogicNode, { kind: "action" }> = {
    kind: "action",
    id: `action-${action.id}`,
    action,
  };

  const tail = root.children[root.children.length - 1];
  if (!tail || tail.kind === "contact") {
    root.children.push(node);
  } else if (tail.kind === "action") {
    root.children[root.children.length - 1] = {
      kind: "parallel",
      id: `outputs-${networkId}`,
      branches: [tail, node],
    };
  } else if (tail.kind === "parallel") {
    if (!tail.branches.every(branch => branch.kind === "action")) {
      throw new Error("add_coil only supports an output-action parallel tail in the current v0.2 mutation API.");
    }
    tail.branches.push(node);
  } else {
    throw new Error("Network tail is not a supported output topology.");
  }
  return node;
}

export function validateProject() {
  const result = validateFx3uV02(project);
  const issues = [...result.issues];
  for (const program of project.programs) {
    for (const network of program.networks) {
      const root = network.root;
      if (root.kind !== "series") {
        issues.push({ severity: "error" as const, code: "ROOT_TOPOLOGY", message: "Current FX3U mutation/compiler slice requires a series root.", path: `network[${network.id}].root` });
        continue;
      }
      if (!root.children.some(n => n.kind === "contact")) {
        issues.push({ severity: "error" as const, code: "MISSING_CONDITION", message: `Network ${network.id} requires at least one contact condition.`, path: `network[${network.id}].root` });
      }
      if (!root.children.some(isOutputNode)) {
        issues.push({ severity: "error" as const, code: "MISSING_OUTPUT", message: `Network ${network.id} requires at least one output action.`, path: `network[${network.id}].root` });
      }
    }
  }
  return { valid: !issues.some(i => i.severity === "error"), issues };
}

export function exportGxWorks2Text() {
  const validation = validateProject();
  if (!validation.valid) throw new Error(validation.issues.filter(i => i.severity === "error").map(i => i.message).join("; "));
  return generateGxWorks2ListText(project);
}

export function exportSamSoar() {
  const validation = validateProject();
  if (!validation.valid) throw new Error(validation.issues.filter(i => i.severity === "error").map(i => i.message).join("; "));

  const lines: string[] = [];
  for (const program of project.programs) {
    lines.push(`Program,${program.name}`);
    for (const network of program.networks) {
      lines.push(`Network,${network.id}`);
      const root = network.root;
      if (root.kind !== "series") throw new Error("SamSoar adapter currently requires a series root.");
      const contacts = root.children.filter((n): n is Extract<LogicNode, { kind: "contact" }> => n.kind === "contact");
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

function normalizeDevice(device: string) {
  const value = device.trim().toUpperCase();
  if (!/^[A-Z]+\d+$/.test(value)) throw new Error(`Invalid PLC device: ${device}`);
  return value.replace(/^([A-Z]+)0+(\d+)$/, "$1$2");
}

function samDevice(device: string) {
  return device.replace(/^([A-Z]+)0+(\d+)$/, "$1$2");
}
