import type { LadderProjectV02, LogicNode, ActionNode } from "@plc-ladder-mcp/ladder-ir";

export type LegacyElement =
  | { id: string; type: "contact"; mode: "NO" | "NC"; device: string }
  | { id: string; type: "coil"; device: string };

const dev = (address: string) => ({ kind: "device" as const, address });

export function legacyNetworkToV02(id: number, elements: LegacyElement[]): LogicNode {
  const contacts = elements.filter((e): e is Extract<LegacyElement,{type:"contact"}> => e.type === "contact");
  const coils = elements.filter((e): e is Extract<LegacyElement,{type:"coil"}> => e.type === "coil");
  const children: LogicNode[] = contacts.map(e => ({
    kind: "contact", id: e.id, device: dev(e.device), mode: e.mode, edge: "none"
  }));
  const actions = coils.map(e => ({
    kind: "action" as const, id: `action-${e.id}`,
    action: { kind: "coil" as const, id: e.id, device: dev(e.device) } satisfies ActionNode
  }));
  if (actions.length === 1) children.push(actions[0]);
  else if (actions.length > 1) children.push({ kind: "parallel", id: `outputs-${id}`, branches: actions });
  return { kind: "series", id: `network-${id}`, children };
}

export function legacyProjectToV02(project: {name:string; plc:{family:string;model:string}; programs:Array<{name:string;networks:Array<{id:number;elements:LegacyElement[]}>}>}): LadderProjectV02 {
  if (project.plc.family !== "Mitsubishi FX" || project.plc.model !== "FX3U")
    throw new Error("IR v0.2 migration currently supports Mitsubishi FX3U only.");
  return {
    version:"0.2", name:project.name, plc:{family:"Mitsubishi FX",model:"FX3U"},
    programs:project.programs.map(p=>({name:p.name,networks:p.networks.map(n=>({id:n.id,root:legacyNetworkToV02(n.id,n.elements)}))}))
  };
}
