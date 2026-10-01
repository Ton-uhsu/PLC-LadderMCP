import type { LogicNode, Operand } from '@plc-ladder-mcp/ladder-ir';
export type OperandInput = { kind: 'device' | 'decimal' | 'hex'; value: string };
export function readOperand(input: OperandInput): Operand {
  const value = input.value.trim();
  if (input.kind === 'device') {
    if (!value) throw new Error('Device operand cannot be empty.');
    return { kind: 'device', address: value.toUpperCase() };
  }
  if (!(input.kind === 'hex' ? /^[0-9a-f]+$/i : /^-?\d+$/).test(value)) throw new Error('Enter an integer constant in the selected radix.');
  const number = input.kind === 'hex' ? Number.parseInt(value, 16) : Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Constant exceeds the safe integer range.');
  return { kind: 'constant', radix: input.kind, value: number };
}
export function operandInput(operand: Operand): OperandInput {
  return operand.kind === 'device' ? { kind: 'device', value: operand.address } : { kind: operand.radix, value: operand.value.toString(operand.radix === 'hex' ? 16 : 10).toUpperCase() };
}
export type NewElement = 'contact' | 'coil' | 'set' | 'reset' | 'timer' | 'counter' | 'instruction' | 'series' | 'parallel';
export function newElement(kind: NewElement, id: () => string): LogicNode {
  if (kind === 'series' || kind === 'parallel') return kind === 'series' ? { kind, id: id(), children: [] } : { kind, id: id(), branches: [{ kind: 'series', id: id(), children: [] }, { kind: 'series', id: id(), children: [] }] };
  if (kind === 'contact') return { kind, id: id(), mode: 'NO', edge: 'none', device: { kind: 'device', address: 'X0' } };
  const actionId = id();
  return { kind: 'action', id: id(), action: kind === 'timer' || kind === 'counter' || kind === 'instruction'
    ? { kind: 'instruction', id: actionId, opcode: kind === 'instruction' ? 'MOV' : 'OUT', operands: kind === 'instruction'
      ? [{ kind: 'constant', radix: 'decimal', value: 0 }, { kind: 'device', address: 'D0' }]
      : [{ kind: 'device', address: kind === 'timer' ? 'T0' : 'C0' }, { kind: 'constant', radix: 'decimal', value: 10 }] }
    : { kind, id: actionId, device: { kind: 'device', address: 'Y0' } } };
}
