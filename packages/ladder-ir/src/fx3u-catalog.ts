export type Fx3uSupport = "documented" | "modeled" | "validated" | "serialized" | "verified";
export type InstructionGroup =
  | "contact" | "logic" | "branch" | "output" | "timer" | "counter"
  | "compare" | "data" | "arithmetic" | "bit" | "shift" | "flow" | "applied";

export interface Fx3uInstruction {
  mnemonic: string;
  group: InstructionGroup;
  support: Fx3uSupport;
  notes: string;
}

/**
 * Seed catalog only. Operand/device constraints are deliberately not guessed.
 * Entries advance beyond "documented" only after implementation/testing.
 */
export const fx3uInstructionCatalog: Fx3uInstruction[] = [
  { mnemonic: "LD", group: "contact", support: "documented", notes: "Load/contact family baseline." },
  { mnemonic: "LDI", group: "contact", support: "documented", notes: "Inverse load/contact family baseline." },
  { mnemonic: "AND", group: "logic", support: "documented", notes: "Series logic family baseline." },
  { mnemonic: "ANI", group: "logic", support: "documented", notes: "Inverse series logic family baseline." },
  { mnemonic: "OR", group: "logic", support: "documented", notes: "Parallel logic family baseline." },
  { mnemonic: "ORI", group: "logic", support: "documented", notes: "Inverse parallel logic family baseline." },
  { mnemonic: "ANB", group: "branch", support: "documented", notes: "Branch composition; compiler may derive from topology." },
  { mnemonic: "ORB", group: "branch", support: "documented", notes: "Branch composition; compiler may derive from topology." },
  { mnemonic: "MPS", group: "branch", support: "documented", notes: "Branch stack; prefer topology in canonical IR." },
  { mnemonic: "MRD", group: "branch", support: "documented", notes: "Branch stack; prefer topology in canonical IR." },
  { mnemonic: "MPP", group: "branch", support: "documented", notes: "Branch stack; prefer topology in canonical IR." },
  { mnemonic: "OUT", group: "output", support: "documented", notes: "Output/action family baseline." },
  { mnemonic: "SET", group: "output", support: "documented", notes: "Latched set action." },
  { mnemonic: "RST", group: "output", support: "documented", notes: "Reset action." },
  { mnemonic: "MOV", group: "data", support: "documented", notes: "Data transfer family baseline; constraints pending catalog extraction." },
];
