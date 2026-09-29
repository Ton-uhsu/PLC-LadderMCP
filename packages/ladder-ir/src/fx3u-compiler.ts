import type { ActionNode, LadderNetworkV02, LadderProjectV02, LogicNode } from "./v02.js";

export type ListInstruction = { instruction: string; device?: string };

function actionToList(action: ActionNode): ListInstruction[] {
  switch (action.kind) {
    case "coil": return [{ instruction: "OUT", device: action.device.address }];
    case "set": return [{ instruction: "SET", device: action.device.address }];
    case "reset": return [{ instruction: "RST", device: action.device.address }];
    case "instruction":
      return [{ instruction: action.opcode, device: action.operands.map(o => o.kind === "device" ? o.address : (o.radix === "hex" ? "H" : "K") + o.value).join(" ") }];
  }
}

function contactMnemonic(node: Extract<LogicNode,{kind:"contact"}>, first:boolean) {
  if (node.edge && node.edge !== "none") throw new Error("Edge contact compilation is not implemented yet.");
  if (first) return node.mode === "NC" ? "LDI" : "LD";
  return node.mode === "NC" ? "ANI" : "AND";
}

/**
 * FX list compiler, first verified topology slice.
 * Supports a series condition followed by one action or a parallel set of actions.
 * For multiple output branches Mitsubishi's documented stack pattern is:
 * condition, MPS, OUT, MRD, OUT ... MPP, OUT.
 */
export function compileNetwork(network: LadderNetworkV02): ListInstruction[] {
  const root=network.root;
  if(root.kind!=="series") throw new Error("v0.2 compiler currently requires a series root.");
  const conditions=root.children.filter(n=>n.kind==="contact") as Extract<LogicNode,{kind:"contact"}>[];
  const tail=root.children[root.children.length-1];
  if(!conditions.length) throw new Error("Network requires at least one contact condition.");
  const out:ListInstruction[]=conditions.map((c,i)=>({instruction:contactMnemonic(c,i===0),device:c.device.address}));

  if(tail.kind==="action") return [...out,...actionToList(tail.action)];
  if(tail.kind!=="parallel") throw new Error("Network must end in an action or parallel actions.");
  const actions=tail.branches.map(b=>{
    if(b.kind!=="action") throw new Error("Nested condition branches are not compiled yet.");
    return b.action;
  });
  if(actions.length===1) return [...out,...actionToList(actions[0])];
  actions.forEach((a,i)=>{
    out.push({instruction:i===0?"MPS":i===actions.length-1?"MPP":"MRD"});
    out.push(...actionToList(a));
  });
  return out;
}

export function compileProject(project:LadderProjectV02):ListInstruction[]{
  return project.programs.flatMap(p=>p.networks.flatMap(compileNetwork));
}
