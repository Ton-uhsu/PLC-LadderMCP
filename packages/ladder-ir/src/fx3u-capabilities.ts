import type { Operand } from "./v02.js";

export type Fx3uEvidenceLevel = "verified" | "partial" | "documented";
export type Fx3uCapabilityForm = {
  opcode: string;
  operands: string[];
  level: Fx3uEvidenceLevel;
  evidence: string;
  notes?: string;
};

export const fx3uVerifiedForms: Fx3uCapabilityForm[] = [
  { opcode: "MOV", operands: ["K100", "D0"], level: "verified", evidence: "GX Works2 real editable import, 2026-09-28" },
  { opcode: "ADD", operands: ["D0", "D1", "D2"], level: "verified", evidence: "GX Works2 real editable import, 2026-09-28" },
  { opcode: "SUB", operands: ["D10", "D11", "D12"], level: "verified", evidence: "GX Works2 advanced batch, 2026-09-28" },
  { opcode: "MUL", operands: ["D20", "D21", "D22"], level: "verified", evidence: "GX Works2 advanced batch, 2026-09-28" },
  { opcode: "DIV", operands: ["D30", "D31", "D32"], level: "verified", evidence: "GX Works2 advanced batch, 2026-09-28" },
  { opcode: "INC", operands: ["D40"], level: "verified", evidence: "GX Works2 advanced batch, 2026-09-28" },
  { opcode: "DEC", operands: ["D41"], level: "verified", evidence: "GX Works2 advanced batch, 2026-09-28" },
  { opcode: "CMP", operands: ["D0", "D1", "M30"], level: "verified", evidence: "GX Works2 advanced batch, 2026-09-28" },
  { opcode: "ZCP", operands: ["K10", "K100", "D2", "M40"], level: "verified", evidence: "GX Works2 advanced batch, 2026-09-28" },
  { opcode: "WAND", operands: ["D50", "D51", "D52"], level: "verified", evidence: "GX Works2 advanced batch, 2026-09-28" },
  { opcode: "WOR", operands: ["D53", "D54", "D55"], level: "verified", evidence: "GX Works2 advanced batch, 2026-09-28" },
  { opcode: "WXOR", operands: ["D56", "D57", "D58"], level: "verified", evidence: "GX Works2 advanced batch, 2026-09-28" },
  { opcode: "ROL", operands: ["D62", "K1"], level: "verified", evidence: "GX Works2 next batch visible render, 2026-09-28" },
  { opcode: "ROR", operands: ["D63", "K1"], level: "verified", evidence: "GX Works2 next batch visible render, 2026-09-28" },
  { opcode: "BCD", operands: ["D64", "D65"], level: "verified", evidence: "GX Works2 next batch visible render, 2026-09-28" },
  { opcode: "BIN", operands: ["D66", "D67"], level: "verified", evidence: "GX Works2 next batch visible render, 2026-09-28" },
  { opcode: "NEG", operands: ["D68"], level: "verified", evidence: "GX Works2 focused retry, 25 steps, 2026-09-28" },
  { opcode: "SFTL", operands: ["M200", "M210", "K8", "K1"], level: "verified", evidence: "GX Works2 focused retry, 25 steps, 2026-09-28" },
  { opcode: "SFTR", operands: ["M220", "M230", "K8", "K1"], level: "verified", evidence: "GX Works2 focused retry, 25 steps, 2026-09-28" },
  { opcode: "DADD", operands: ["D70", "D72", "D74"], level: "partial", evidence: "GX Works2 next batch visibly rendered; batch had unrelated errors, 2026-09-28" },
  { opcode: "OUT", operands: ["T0", "K10"], level: "verified", evidence: "GX Works2 combined batch, 2026-09-28", notes: "Timer form" },
  { opcode: "OUT", operands: ["C0", "K10"], level: "verified", evidence: "GX Works2 combined batch, 2026-09-28", notes: "Counter form" },
];

export const fx3uRejectedExactForms = [
  { opcode: "SFTL", operands: ["D60", "K4", "K1"], reason: "Rejected/highlighted by real GX Works2 import." },
  { opcode: "SFTR", operands: ["D61", "K4", "K1"], reason: "Rejected/highlighted by real GX Works2 import." },
  { opcode: "NEG", operands: ["D68", "D69"], reason: "Rejected/highlighted by real GX Works2 import; NEG verified as in-place one-operand form." },
] as const;

export function operandToFxText(operand: Operand): string {
  if (operand.kind === "device") return operand.address.toUpperCase();
  return (operand.radix === "hex" ? "H" : "K") + operand.value;
}

function sameForm(opcode: string, operands: string[], candidate: { opcode: string; operands: readonly string[] }) {
  return candidate.opcode === opcode && candidate.operands.length === operands.length &&
    candidate.operands.every((value, index) => value === operands[index]);
}

export function inspectFx3uInstructionForm(opcodeRaw: string, operandsRaw: Operand[]) {
  const opcode = opcodeRaw.trim().toUpperCase();
  const operands = operandsRaw.map(operandToFxText);
  const rejected = fx3uRejectedExactForms.find(form => sameForm(opcode, operands, form));
  if (rejected) return { status: "rejected" as const, opcode, operands, evidence: rejected.reason };

  const match = fx3uVerifiedForms.find(form => sameForm(opcode, operands, form));
  if (match) return { status: match.level, opcode, operands, evidence: match.evidence, notes: match.notes };

  return {
    status: "unverified" as const,
    opcode,
    operands,
    evidence: "No exact real-GX-Works2 verification record for this operand combination.",
  };
}
