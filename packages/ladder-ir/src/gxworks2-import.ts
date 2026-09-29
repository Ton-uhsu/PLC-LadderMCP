import type { ActionNode, LadderProjectV02, LogicNode, Operand } from "./v02.js";

type ListRow = { instruction: string; device: string };

function splitQuotedTsv(line: string): string[] {
  const cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "\t" && !quoted) {
      cells.push(value);
      value = "";
    } else {
      value += ch;
    }
  }
  cells.push(value);
  return cells;
}

function normalizeText(raw: string) {
  return raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function device(address: string) {
  return { kind: "device" as const, address: address.toUpperCase() };
}

function parseOperand(raw: string): Operand {
  const value = raw.trim().toUpperCase();
  const decimal = /^K(-?\d+)$/.exec(value);
  if (decimal) return { kind: "constant", radix: "decimal", value: Number(decimal[1]) };
  const hex = /^H([0-9A-F]+)$/.exec(value);
  if (hex) return { kind: "constant", radix: "hex", value: Number.parseInt(hex[1], 16) };
  if (/^[A-Z]+\d+$/.test(value)) return device(value);
  throw new Error("Unsupported GX Works2 operand: " + raw);
}

function contactFrom(op: string, address: string): Extract<LogicNode, { kind: "contact" }> {
  const upper = op.toUpperCase();
  const mode = ["LDI", "ANI", "ORI"].includes(upper) ? "NC" as const : "NO" as const;
  const edge =
    ["LDP", "ANP", "ORP"].includes(upper) ? "rising" as const :
    ["LDF", "ANF", "ORF"].includes(upper) ? "falling" as const :
    "none" as const;
  return {
    kind: "contact",
    id: crypto.randomUUID(),
    device: device(address),
    mode,
    edge,
  };
}

function series(left: LogicNode, right: LogicNode): LogicNode {
  const children: LogicNode[] = [];
  if (left.kind === "series") children.push(...left.children); else children.push(left);
  if (right.kind === "series") children.push(...right.children); else children.push(right);
  return { kind: "series", id: crypto.randomUUID(), children };
}

function parallel(left: LogicNode, right: LogicNode): LogicNode {
  const branches: LogicNode[] = [];
  if (left.kind === "parallel" && left.branches.every(b => b.kind !== "action")) branches.push(...left.branches);
  else branches.push(left);
  if (right.kind === "parallel" && right.branches.every(b => b.kind !== "action")) branches.push(...right.branches);
  else branches.push(right);
  return { kind: "parallel", id: crypto.randomUUID(), branches };
}

function parseCondition(rows: ListRow[]): LogicNode {
  const stack: LogicNode[] = [];

  for (const row of rows) {
    const op = row.instruction.toUpperCase();
    if (["LD", "LDI", "LDP", "LDF"].includes(op)) {
      stack.push(contactFrom(op, row.device));
      continue;
    }

    if (["AND", "ANI", "ANP", "ANF"].includes(op)) {
      const current = stack.pop();
      if (!current) throw new Error(op + " has no active condition block.");
      stack.push(series(current, contactFrom(op, row.device)));
      continue;
    }

    if (["OR", "ORI", "ORP", "ORF"].includes(op)) {
      const current = stack.pop();
      if (!current) throw new Error(op + " has no active condition block.");
      stack.push(parallel(current, contactFrom(op, row.device)));
      continue;
    }

    if (op === "ORB" || op === "ANB") {
      const right = stack.pop();
      const left = stack.pop();
      if (!left || !right) throw new Error(op + " requires two condition blocks.");
      stack.push(op === "ORB" ? parallel(left, right) : series(left, right));
      continue;
    }

    throw new Error("Unsupported GX Works2 condition instruction: " + op);
  }

  if (stack.length !== 1) throw new Error("GX Works2 condition expression did not reduce to one topology node.");
  return stack[0];
}

function parseAction(row: ListRow): ActionNode {
  const op = row.instruction.toUpperCase();
  const tokens = row.device.trim() ? row.device.trim().split(/\s+/) : [];

  if (op === "OUT" && tokens.length === 1) {
    return { kind: "coil", id: crypto.randomUUID(), device: device(tokens[0]) };
  }
  if (op === "SET" && tokens.length === 1) {
    return { kind: "set", id: crypto.randomUUID(), device: device(tokens[0]) };
  }
  if (op === "RST" && tokens.length === 1) {
    return { kind: "reset", id: crypto.randomUUID(), device: device(tokens[0]) };
  }

  return {
    kind: "instruction",
    id: crypto.randomUUID(),
    opcode: op,
    operands: tokens.map(parseOperand),
  };
}

const conditionOps = new Set([
  "LD", "LDI", "LDP", "LDF", "AND", "ANI", "ANP", "ANF",
  "OR", "ORI", "ORP", "ORF", "ORB", "ANB",
]);
const branchStackOps = new Set(["MPS", "MRD", "MPP"]);
const loadOps = new Set(["LD", "LDI", "LDP", "LDF"]);

function splitNetworks(rows: ListRow[]): ListRow[][] {
  const networks: ListRow[][] = [];
  let current: ListRow[] = [];
  let actionSeen = false;

  for (const row of rows) {
    const op = row.instruction.toUpperCase();
    if (op === "END") break;

    if (actionSeen && loadOps.has(op)) {
      if (current.length) networks.push(current);
      current = [];
      actionSeen = false;
    }

    current.push(row);
    if (!conditionOps.has(op) && !branchStackOps.has(op)) actionSeen = true;
  }

  if (current.length) networks.push(current);
  return networks;
}

function networkFromRows(rows: ListRow[], id: number) {
  const firstAction = rows.findIndex(row =>
    branchStackOps.has(row.instruction.toUpperCase()) ||
    !conditionOps.has(row.instruction.toUpperCase())
  );
  if (firstAction <= 0) throw new Error("Network " + id + " has no valid condition/action boundary.");

  const condition = parseCondition(rows.slice(0, firstAction));
  const actions = rows.slice(firstAction)
    .filter(row => !branchStackOps.has(row.instruction.toUpperCase()))
    .map(parseAction);
  if (!actions.length) throw new Error("Network " + id + " has no output/action.");

  const actionNodes: LogicNode[] = actions.map(action => ({
    kind: "action" as const,
    id: "action-" + action.id,
    action,
  }));

  const tail: LogicNode = actionNodes.length === 1
    ? actionNodes[0]
    : { kind: "parallel", id: "outputs-" + id, branches: actionNodes };

  return {
    id,
    root: {
      kind: "series" as const,
      id: "network-" + id,
      children: [condition, tail],
    },
  };
}

export function parseGxWorks2ListText(raw: string): LadderProjectV02 {
  const lines = normalizeText(raw).split("\n").filter(line => line.length > 0);
  if (lines.length < 4) throw new Error("GX Works2 List file is too short.");

  const first = splitQuotedTsv(lines[0])[0] || "Imported GX Works2";
  const name = first.startsWith("(") && first.endsWith(")") ? first.slice(1, -1) : first;
  const plcInfo = splitQuotedTsv(lines[1]).join(" ");
  if (!/FX3U|FX3UC/i.test(plcInfo)) throw new Error("Only FX3U/FX3UC GX Works2 List files are supported.");

  const rows: ListRow[] = [];
  for (const line of lines.slice(3)) {
    const cells = splitQuotedTsv(line);
    if (cells.length < 4) continue;
    const instruction = (cells[2] || "").trim().toUpperCase();
    if (!instruction) continue;
    rows.push({ instruction, device: (cells[3] || "").trim() });
  }

  const networks = splitNetworks(rows).map((networkRows, index) => networkFromRows(networkRows, index));
  if (!networks.length) throw new Error("No Ladder networks were found in the GX Works2 List file.");

  return {
    version: "0.2",
    name: name || "Imported GX Works2",
    plc: { family: "Mitsubishi FX", model: "FX3U" },
    programs: [{ name: "Main", networks }],
  };
}
