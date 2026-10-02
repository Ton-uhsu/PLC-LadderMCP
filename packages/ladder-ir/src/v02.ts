export type DeviceRef = { kind: "device"; address: string };
export type ConstantRef = { kind: "constant"; radix: "decimal" | "hex"; value: number };
export type Operand = DeviceRef | ConstantRef;

export type ContactNode = {
  kind: "contact";
  id: string;
  device: DeviceRef;
  mode: "NO" | "NC";
  edge?: "none" | "rising" | "falling";
};

export type ActionNode =
  | { kind: "coil"; id: string; device: DeviceRef }
  | { kind: "set"; id: string; device: DeviceRef }
  | { kind: "reset"; id: string; device: DeviceRef }
  | { kind: "instruction"; id: string; opcode: string; operands: Operand[] };

export type LogicNode =
  | ContactNode
  | { kind: "wire"; id: string; connected: boolean; erased?: boolean }
  | { kind: "series"; id: string; children: LogicNode[]; openEnd?: boolean; wireOffset?: number; leftBreak?: boolean; rightBreak?: boolean }
  | { kind: "parallel"; id: string; branches: LogicNode[] }
  | { kind: "action"; id: string; action: ActionNode };

export interface LadderNetworkV02 {
  id: number;
  root: LogicNode;
  comment?: string;
}

export interface LadderProgramV02 {
  name: string;
  networks: LadderNetworkV02[];
}

export interface LadderProjectV02 {
  version: "0.2";
  name: string;
  plc: { family: "Mitsubishi FX"; model: "FX3U" };
  programs: LadderProgramV02[];
}

export const m0ToY0Y5Fixture: LadderProjectV02 = {
  version: "0.2",
  name: "FX3U Parallel Output Fixture",
  plc: { family: "Mitsubishi FX", model: "FX3U" },
  programs: [{
    name: "Main",
    networks: [{
      id: 0,
      root: {
        kind: "series", id: "s0", children: [
          { kind: "contact", id: "m0", device: { kind: "device", address: "M0" }, mode: "NO" },
          { kind: "parallel", id: "p0", branches: Array.from({ length: 6 }, (_, i) => ({
            kind: "action" as const,
            id: `a${i}`,
            action: { kind: "coil" as const, id: `y${i}`, device: { kind: "device" as const, address: `Y${i}` } }
          })) }
        ]
      }
    }]
  }]
};
