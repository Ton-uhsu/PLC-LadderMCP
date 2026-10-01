import { operandToFxText } from "./fx3u-capabilities.js";
import { childNodes, containsAction } from "./structured-edit.js";
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
        device: action.operands.map(operandToFxText).join(" "),
      }];
  }
}

type CombineMode = "load" | "and" | "or";
type ContactNode = Extract<LogicNode, { kind: "contact" }>;

function contactMnemonic(node: ContactNode, mode: CombineMode) {
  const edge = node.edge ?? "none";
  if (edge !== "none" && node.mode === "NC") throw new Error("NC edge contacts are not supported by this compiler.");
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
  if (node.kind === "wire") throw new Error("Wire must be normalized before condition compilation.");
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

// Output wiring is connectivity, not a Boolean condition bypass. Each path must end in an action.
export function outputActions(node: LogicNode): ActionNode[] {
  if (node.kind === 'action') return [node.action];
  if (node.kind === 'wire') { if (!node.connected) throw new Error('Disconnected wire: complete the output path before Compile/Export.'); throw new Error('Output branch requires an output symbol. Insert a coil or instruction on its wire.'); }
  if (node.kind === 'contact') throw new Error('Conditional output branches are not supported by this compiler.');
  const children = childNodes(node)!;
  if (!children.length) throw new Error('Output branch is incomplete. Insert an output symbol.');
  if (node.kind === 'parallel') return children.flatMap(outputActions);
  function connection(item: LogicNode): void {
    if(item.kind === 'contact') throw new Error('Conditional output branches are not supported by this compiler.');
    if (item.kind === 'wire') { if (!item.connected) throw new Error('Disconnected wire: complete the output path before Compile/Export.'); return; }
    const parts = childNodes(item);
    if (!parts?.length) throw new Error('Output wiring path is incomplete.');
    parts.forEach(connection);
  }
  for (const child of children) if (!containsAction(child)) connection(child);
  const outputs = children.filter(containsAction);
  if (outputs.length !== 1) throw new Error('Output path requires exactly one output symbol or parallel output group.');
  return outputActions(outputs[0]);
}

/**
 * FX3U List compiler.
 * Verified paths include series contacts, OR contacts, mixed ORB branches,
 * pulse contacts, and MPS/MRD/MPP output fanout.
 * ANB is used only when a parallel condition must be AND-composed after an
 * existing accumulator; that topology remains evidence-tracked separately.
 */
// Connected wires are Boolean TRUE in conditions; gaps always block compile.
// Normalization is compile-only and never rewrites the authoritative snapshot.
export function normalizeWires(node: LogicNode): LogicNode | null {
  if (node.kind === 'wire') { if (!node.connected) throw new Error('Disconnected wire: complete the path before Compile/Export.'); return null; }
  if (node.kind === 'contact' || node.kind === 'action') return node;
  const children = (node.kind === 'series' ? node.children : node.branches).map(normalizeWires);
  if (!children.length) throw new Error("Empty condition group: complete the path before Compile/Export.");
  const hasAction = (item: LogicNode): boolean => item.kind === "action" || (item.kind === "series" ? item.children : item.kind === "parallel" ? item.branches : []).some(hasAction);
  if (node.kind === "parallel" && children.some(child => child === null) && node.branches.some(hasAction)) throw new Error("A wire cannot bypass an output action.");
  if (node.kind === 'parallel' && children.some(child => child === null)) return null;
  const kept = children.filter((child): child is LogicNode => child !== null);
  if (!kept.length) return null;
  const originalChildren = node.kind === "series" ? node.children : node.branches;
  if (kept.length === originalChildren.length && kept.every((child, index) => child === originalChildren[index])) return node;
  if (kept.length === 1) return kept[0];
  return node.kind === 'series' ? { ...node, children: kept } : { ...node, branches: kept };
}
export function compileNetwork(network: LadderNetworkV02): ListInstruction[] {
  const original = network.root;
  if (original.kind !== 'series') throw new Error('v0.2 compiler currently requires a series root.');
  const outputIndex = original.children.findIndex(containsAction);
  if (outputIndex < 0) throw new Error('Network requires an output symbol.');
  const sourceConditions = original.children.slice(0, outputIndex);
  const conditions = sourceConditions.map(normalizeWires).filter((child): child is LogicNode => child !== null);
  if (!sourceConditions.length) throw new Error('Network requires at least one condition or explicit connected condition wire.');
  const actions = outputActions({ kind: 'series', id: original.id, children: original.children.slice(outputIndex) });

  const out: ListInstruction[] = [];
  if (conditions.length) out.push(...compileCondition(conditions[0], "load"));
  else out.push({ instruction: "LD", device: "M8000" });
  for (const condition of conditions.slice(1)) {
    if (condition.kind === "contact" || condition.kind === "series") out.push(...compileCondition(condition, "and"));
    else {
      out.push(...compileCondition(condition, "load"));
      out.push({ instruction: "ANB" });
    }
  }

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
