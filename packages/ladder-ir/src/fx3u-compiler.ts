import type { ActionNode, LadderNetworkV02, LadderProjectV02, LogicNode } from "./v02.js";

export type ListInstruction = { instruction: string; device?: string };

function actionToList(action: ActionNode): ListInstruction[] {
  switch (action.kind) {
    case "coil": return [{ instruction: "OUT", device: action.device.address }];
    case "set": return [{ instruction: "SET", device: action.device.address }];
    case "reset": return [{ instruction: "RST", device: action.device.address }];
    case "instruction":
      return [{
        instruction: action.opcode,
        device: action.operands.map(o =>
          o.kind === "device" ? o.address : (o.radix === "hex" ? "H" : "K") + o.value
        ).join(" "),
      }];
  }
}

type CombineMode = "load" | "and" | "or";
type ContactNode = Extract<LogicNode, { kind: "contact" }>;

function contactMnemonic(node: ContactNode, mode: CombineMode) {
  const edge = node.edge ?? "none";
  if (mode === "load") {
    if (edge === "rising") return "LDP";
    if (edge === "falling") return "LDF";
    return node.mode === "NC" ? "LDI" : "LD";
  }
  if (mode === "and") {
    if (edge === "rising") return "ANP";
    if (edge === "falling") return "ANF";
    return node.mode === "NC" ? "ANI" : "AND";
  }
  if (edge === "rising") return "ORP";
  if (edge === "falling") return "ORF";
  return node.mode === "NC" ? "ORI" : "OR";
}

function compileCondition(node: LogicNode, mode: CombineMode): ListInstruction[] {
  if (node.kind === "action") throw new Error("Action node cannot be used as a condition.");

  if (node.kind === "contact") {
    return [{ instruction: contactMnemonic(node, mode), device: node.device.address }];
  }

  if (node.kind === "series") {
    if (!node.children.length) throw new Error("Condition series cannot be empty.");
    const out: ListInstruction[] = [];

    if (mode === "load") {
      out.push(...compileCondition(node.children[0], "load"));
      for (const child of node.children.slice(1)) {
        if (child.kind === "contact" || child.kind === "series") out.push(...compileCondition(child, "and"));
        else {
          out.push(...compileCondition(child, "load"));
          out.push({ instruction: "ANB" });
        }
      }
      return out;
    }

    if (mode === "and") {
      for (const child of node.children) {
        if (child.kind === "contact" || child.kind === "series") out.push(...compileCondition(child, "and"));
        else {
          out.push(...compileCondition(child, "load"));
          out.push({ instruction: "ANB" });
        }
      }
      return out;
    }

    // OR a multi-contact series block: load the block and OR it as a block.
    out.push(...compileCondition(node, "load"));
    out.push({ instruction: "ORB" });
    return out;
  }

  if (node.branches.length < 2) throw new Error("Parallel condition requires at least two branches.");

  if (mode === "and") {
    return [...compileCondition(node, "load"), { instruction: "ANB" }];
  }

  if (mode === "or") {
    return [...compileCondition(node, "load"), { instruction: "ORB" }];
  }

  const out: ListInstruction[] = [];
  out.push(...compileCondition(node.branches[0], "load"));

  for (const branch of node.branches.slice(1)) {
    if (branch.kind === "contact") {
      out.push(...compileCondition(branch, "or"));
    } else {
      out.push(...compileCondition(branch, "load"));
      out.push({ instruction: "ORB" });
    }
  }
  return out;
}

function isActionTail(node: LogicNode | undefined): boolean {
  return !!node && (
    node.kind === "action" ||
    (node.kind === "parallel" && node.branches.length > 0 && node.branches.every(branch => branch.kind === "action"))
  );
}

/**
 * FX3U List compiler.
 * Verified paths include series contacts, OR contacts, mixed ORB branches,
 * pulse contacts, and MPS/MRD/MPP output fanout.
 * ANB is used only when a parallel condition must be AND-composed after an
 * existing accumulator; that topology remains evidence-tracked separately.
 */
export function compileNetwork(network: LadderNetworkV02): ListInstruction[] {
  const root = network.root;
  if (root.kind !== "series") throw new Error("v0.2 compiler currently requires a series root.");

  const tail = root.children.at(-1);
  if (!isActionTail(tail)) throw new Error("Network must end in an action or parallel output actions.");

  const conditions = root.children.slice(0, -1);
  if (!conditions.length) throw new Error("Network requires at least one condition.");

  const out: ListInstruction[] = [];
  out.push(...compileCondition(conditions[0], "load"));
  for (const condition of conditions.slice(1)) {
    if (condition.kind === "contact" || condition.kind === "series") out.push(...compileCondition(condition, "and"));
    else {
      out.push(...compileCondition(condition, "load"));
      out.push({ instruction: "ANB" });
    }
  }

  if (!tail) throw new Error("Network has no output.");
  if (tail.kind === "action") return [...out, ...actionToList(tail.action)];
  if (tail.kind !== "parallel") throw new Error("Network output topology is unsupported.");

  const actions = tail.branches.map(branch => {
    if (branch.kind !== "action") throw new Error("Output parallel may only contain action branches.");
    return branch.action;
  });

  if (actions.length === 1) return [...out, ...actionToList(actions[0])];
  actions.forEach((action, index) => {
    out.push({ instruction: index === 0 ? "MPS" : index === actions.length - 1 ? "MPP" : "MRD" });
    out.push(...actionToList(action));
  });
  return out;
}

export function compileProject(project: LadderProjectV02): ListInstruction[] {
  return project.programs.flatMap(program => program.networks.flatMap(compileNetwork));
}
