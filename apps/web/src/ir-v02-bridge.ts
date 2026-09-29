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


export function v02ProjectToLegacy(project: LadderProjectV02) {
  return {
    version: "0.1" as const,
    name: project.name,
    plc: { family: project.plc.family, model: project.plc.model },
    programs: project.programs.map(program => ({
      name: program.name,
      networks: program.networks.map(network => {
        if (network.root.kind !== "series") throw new Error("Web legacy view currently requires a series root.");
        const elements: LegacyElement[] = [];
        for (const node of network.root.children) {
          if (node.kind === "contact") {
            elements.push({ id: node.id, type: "contact", mode: node.mode, device: node.device.address });
          } else if (node.kind === "action") {
            if (node.action.kind !== "coil") throw new Error("Web legacy view currently renders coil actions only.");
            elements.push({ id: node.action.id, type: "coil", device: node.action.device.address });
          } else if (node.kind === "parallel") {
            for (const branch of node.branches) {
              if (branch.kind !== "action" || branch.action.kind !== "coil")
                throw new Error("Web legacy view currently renders parallel coil actions only.");
              elements.push({ id: branch.action.id, type: "coil", device: branch.action.device.address });
            }
          } else {
            throw new Error("Web legacy view cannot flatten nested condition topology yet.");
          }
        }
        return { id: network.id, elements };
      }),
    })),
  };
}
