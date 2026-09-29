import type {
  ActionNode,
  ContactNode,
  LadderNetworkV02,
  LadderProjectV02,
} from "@plc-ladder-mcp/ladder-ir";
import { generateGxWorks2ListText, validateFx3uV02 } from "@plc-ladder-mcp/ladder-ir";

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
  contacts: ContactNode[];
  actions: ActionNode[];
};

export function getPreviewNetwork(network: LadderNetworkV02): PreviewNetwork {
  if (network.root.kind !== "series") {
    return { supported: false, reason: "Preview currently expects a series root.", contacts: [], actions: [] };
  }

  const contacts: ContactNode[] = [];
  const actions: ActionNode[] = [];
  let outputSeen = false;

  for (const node of network.root.children) {
    if (node.kind === "contact" && !outputSeen) {
      contacts.push(node);
      continue;
    }

    if (node.kind === "action" && !outputSeen) {
      outputSeen = true;
      actions.push(node.action);
      continue;
    }

    if (node.kind === "parallel" && !outputSeen) {
      if (!node.branches.every(branch => branch.kind === "action")) {
        return {
          supported: false,
          reason: "Nested condition branches are not rendered by the current preview yet.",
          contacts,
          actions: [],
        };
      }
      outputSeen = true;
      actions.push(...node.branches.map(branch => {
        if (branch.kind !== "action") throw new Error("Unreachable");
        return branch.action;
      }));
      continue;
    }

    return {
      supported: false,
      reason: "Preview supports series contacts followed by one action or parallel actions.",
      contacts,
      actions,
    };
  }

  return { supported: true, contacts, actions };
}

export function validateProject(project: LadderProjectV02) {
  const base = validateFx3uV02(project);
  const issues = base.issues.map(issue => issue.message);

  if (!project.programs.length) issues.push("Project requires at least one program.");

  for (const program of project.programs) {
    for (const network of program.networks) {
      const preview = getPreviewNetwork(network);
      if (!preview.supported && preview.reason) issues.push(`Network ${network.id}: ${preview.reason}`);
      if (!preview.contacts.length) issues.push(`Network ${network.id} must contain at least one contact condition.`);
      if (!preview.actions.length) issues.push(`Network ${network.id} must contain at least one output action.`);
    }
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
      if (!preview.supported) throw new Error(preview.reason ?? "Unsupported SamSoar topology");

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
    const operands = action.operands.map(operand =>
      operand.kind === "device"
        ? operand.address
        : `${operand.radix === "hex" ? "H" : "K"}${operand.value}`
    ).join(" ");
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
