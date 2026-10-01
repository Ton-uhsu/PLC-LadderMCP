import type {
  ActionNode,
  ContactNode,
  LadderNetworkV02,
  LadderProjectV02,
  LogicNode,
} from "@plc-ladder-mcp/ladder-ir";
import {
  compileProject,
  operandToFxText,
  generateGxWorks2ListText,
  validateFx3uV02,
} from "@plc-ladder-mcp/ladder-ir";

export type LadderProject = LadderProjectV02;

const dev = (address: string) => ({ kind: "device" as const, address });

export const demoProject: LadderProjectV02 = {
  version: "0.2",
  name: "Untitled PLC Project",
  plc: { family: "Mitsubishi FX", model: "FX3U" },
  programs: [{
    name: "Main",
    networks: [{
      id: 0,
      root: {
        kind: "series",
        id: "network-0",
        children: [
          { kind: "contact", id: "e1", mode: "NO", edge: "none", device: dev("M0") },
          {
            kind: "action",
            id: "action-e2",
            action: { kind: "coil", id: "e2", device: dev("M1") },
          },
        ],
      },
    }],
  }],
};

export type PreviewNetwork = {
  supported: boolean;
  reason?: string;
  condition: LogicNode | null;
  contacts: ContactNode[];
  actions: ActionNode[];
  conditionText: string;
};

function isActionTail(node: LogicNode | undefined) {
  return !!node && (
    node.kind === "action" ||
    (node.kind === "parallel" && node.branches.length > 0 && node.branches.every(branch => branch.kind === "action"))
  );
}

function contactsOnly(node: LogicNode): ContactNode[] | null {
  if (node.kind === "contact") return [node];
  if (node.kind !== "series") return null;
  const out: ContactNode[] = [];
  for (const child of node.children) {
    if (child.kind !== "contact") return null;
    out.push(child);
  }
  return out;
}

function contactText(contact: ContactNode) {
  const edge = contact.edge === "rising" ? "↑" : contact.edge === "falling" ? "↓" : "";
  return (contact.mode === "NC" ? "NOT " : "") + contact.device.address + edge;
}

export function logicText(node: LogicNode): string {
  if (node.kind === "contact") return contactText(node);
  if (node.kind === "action") return actionLabel(node.action);
  if (node.kind === "series") return node.children.map(logicText).join(" AND ");
  return "(" + node.branches.map(logicText).join(") OR (") + ")";
}

export function getPreviewNetwork(network: LadderNetworkV02): PreviewNetwork {
  if (network.root.kind !== "series") {
    return { supported: false, reason: "Preview expects a series-root network.", condition: null, contacts: [], actions: [], conditionText: "" };
  }

  const tail = network.root.children.at(-1);
  if (!isActionTail(tail)) {
    return { supported: false, reason: "Network has no supported output tail.", condition: null, contacts: [], actions: [], conditionText: "" };
  }

  const conditionChildren = network.root.children.slice(0, -1);
  if (!conditionChildren.length) {
    return { supported: false, reason: "Network has no condition.", condition: null, contacts: [], actions: [], conditionText: "" };
  }

  const condition: LogicNode = conditionChildren.length === 1
    ? conditionChildren[0]
    : { kind: "series", id: "preview-series", children: conditionChildren };

  const actions: ActionNode[] = tail?.kind === "action"
    ? [tail.action]
    : tail?.kind === "parallel"
      ? tail.branches.flatMap(branch => branch.kind === "action" ? [branch.action] : [])
      : [];

  const contacts = contactsOnly(condition);
  return {
    supported: contacts !== null,
    reason: contacts === null ? "Nested condition topology is shown as a logic block in this preview." : undefined,
    condition,
    contacts: contacts ?? [],
    actions,
    conditionText: logicText(condition),
  };
}

export function validateProject(project: LadderProjectV02) {
  const base = validateFx3uV02(project);
  const issues = base.issues.filter(issue => issue.severity === "error").map(issue => issue.message);
  if (!project.programs.length) issues.push("Project requires at least one program.");

  try {
    compileProject(project);
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }

  return { valid: issues.length === 0, issues };
}

function samDevice(device: string) {
  return device.replace(/^([A-Z]+)0+(\d+)$/, "$1$2");
}

export function generateSamSoar(project: LadderProjectV02) {
  const validation = validateProject(project);
  if (!validation.valid) throw new Error(validation.issues.join("; "));

  const lines: string[] = [];
  for (const program of project.programs) {
    lines.push(`Program,${program.name}`);
    for (const network of program.networks) {
      const preview = getPreviewNetwork(network);
      if (!preview.supported) throw new Error("SamSoar web adapter currently supports simple series-contact conditions only.");

      lines.push(`Network,${network.id}`);
      preview.contacts.forEach((contact, index) => {
        const mnemonic = index === 0
          ? (contact.mode === "NC" ? "LDI" : "LD")
          : (contact.mode === "NC" ? "ANI" : "AND");
        lines.push(`${mnemonic},${samDevice(contact.device.address)}`);
      });

      for (const action of preview.actions) {
        if (action.kind !== "coil") throw new Error("SamSoar web adapter currently supports coil actions only.");
        lines.push(`OUT,${samDevice(action.device.address)}`);
      }
      lines.push("POP");
    }
  }

  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export function generateGxWorks2(project: LadderProjectV02): Uint8Array {
  const validation = validateProject(project);
  if (!validation.valid) throw new Error(validation.issues.join("; "));

  const text = generateGxWorks2ListText(project);
  const out = new Uint8Array(2 + text.length * 2);
  out[0] = 0xff;
  out[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out[2 + i * 2] = code & 0xff;
    out[3 + i * 2] = code >> 8;
  }
  return out;
}

export function actionLabel(action: ActionNode) {
  if (action.kind === "instruction") {
    const operands = action.operands.map(operandToFxText).join(" ");
    return `${action.opcode}${operands ? ` ${operands}` : ""}`;
  }
  return action.kind === "coil"
    ? action.device.address
    : `${action.kind === "set" ? "SET" : "RST"} ${action.device.address}`;
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadBytes(filename: string, bytes: Uint8Array, mime = "text/csv") {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
