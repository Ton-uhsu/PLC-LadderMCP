# FX3U Capability Catalog

Status: research baseline for PLC-LadderMCP IR v0.2.

Primary specification: Mitsubishi JY997D16601, *FX3S/FX3G/FX3GC/FX3U/FX3UC Programming Manual — Basic & Applied Instruction Edition*.
GX Works2 behavior is checked against SH-080780ENG, *GX Works2 Version 1 Operating Manual (Simple Project)*.

## Design rule

The engine must model FX3U program semantics first and serialize to GX Works2 second. A feature is not considered export-compatible until a generated fixture is imported and displayed correctly in GX Works2.

## Capability groups

| Group | Examples / concepts | IR v0.2 requirement |
|---|---|---|
| Contact/load logic | LD, LDI and edge/contact forms | contacts with execution/edge mode |
| Series/parallel logic | AND/ANI, OR/ORI, ANB/ORB | nested series + parallel topology |
| Branch stack | MPS, MRD, MPP | compiler concern; preserve topology in IR |
| Outputs | OUT, SET, RST, pulse-related output behavior | multiple output/action nodes |
| Master control | MC/MCR | scoped control node |
| Timer | T devices, presets | timer action + typed preset |
| Counter | C devices, presets | counter action + typed preset |
| Compare | equality/inequality/range comparisons | expression/condition nodes |
| Transfer/data | MOV and related data operations | generic instruction + typed operands |
| Arithmetic | add/subtract/multiply/divide families | typed instruction operands/results |
| Logical/bit | AND/OR/XOR-style data operations | typed instruction nodes |
| Shift/rotate | shift/rotate families | typed instruction nodes |
| Flow | jump/call/return/loop concepts | labels + control-flow nodes |
| Applied instructions | FX3U-supported application instructions | catalog-driven generic instruction |
| Special devices | M/D and other special-purpose devices | device metadata + restrictions |

This table is intentionally capability-oriented. Exact opcode spelling, operand count, supported devices, pulse variants, CPU restrictions and execution semantics must come from the Mitsubishi manual entry before an opcode is marked implemented.

## Device model

IR operands must distinguish at minimum:
- bit devices (X, Y, M, S and applicable special devices)
- timer/counter devices (T, C)
- word/data devices (D and applicable registers)
- constants (decimal K, hexadecimal H)
- indexed/indirect operands where supported by the target instruction

Do not validate addresses with one global regex. Validation is profile + opcode + operand-position specific.

## IR v0.2 topology

A network is a graph-like expression, not an array ending in exactly one coil.

```ts
type LogicNode =
  | { kind: "contact"; device: DeviceRef; mode: "NO" | "NC"; edge?: "none" | "rising" | "falling" }
  | { kind: "series"; children: LogicNode[] }
  | { kind: "parallel"; branches: LogicNode[] }
  | { kind: "action"; action: ActionNode };

type ActionNode =
  | { kind: "coil"; device: DeviceRef }
  | { kind: "set"; device: DeviceRef }
  | { kind: "reset"; device: DeviceRef }
  | { kind: "instruction"; opcode: string; operands: Operand[] };
```

Generic instruction nodes are required so the IR does not need a new TypeScript AST type for every applied instruction. The FX3U catalog supplies operand and availability rules.

## Acceptance levels

1. documented — confirmed in Mitsubishi documentation
2. modeled — representable in IR
3. validated — validator knows operand/device restrictions
4. serialized — GX Works2 adapter emits it
5. verified — user imported it into GX Works2 and confirmed the Ladder

Only level 5 may be described as GX Works2 verified.

## First integration fixture

Required Ladder behavior:

```text
       M0
--| |--+----------------(Y0)
       +----------------(Y1)
       +----------------(Y2)
       +----------------(Y3)
       +----------------(Y4)
       +----------------(Y5)
```

This fixture is specifically intended to force IR v0.2 to support parallel output topology rather than representing six unrelated networks.

## Research backlog

Build the machine-readable catalog directly from manual entries, recording:
- mnemonic/opcode and variants
- instruction group
- FX3U availability
- operand count/order
- operand data types
- legal device classes
- 16/32-bit behavior
- pulse/continuous execution behavior where applicable
- semantic description
- validation constraints
- GX Works2 serialization mapping
- verification fixture/status

Do not infer undocumented operand rules from mnemonic names.


## Verified GX Works2 fixture — 2026-09-28

**Status: VERIFIED**

The generated GX Works2 List CSV for the first IR v0.2 integration fixture was imported into GX Works2 successfully and rendered as one normally-open M0 contact driving six parallel output coils Y000 through Y005.

Observed GX Works2 program:
- M0 normally-open contact
- parallel outputs Y000, Y001, Y002, Y003, Y004, Y005
- END at step 13
- GX Works2 reports 14 steps including END

Compiler sequence used:
```text
LD M0
MPS
OUT Y0
MRD
OUT Y1
MRD
OUT Y2
MRD
OUT Y3
MRD
OUT Y4
MPP
OUT Y5
END
```

This verifies the current serializer/compiler path for this specific topology:
single series contact -> multiple parallel OUT coils.

It does **not** yet verify arbitrary nested branches, mixed branch conditions, timers, counters, applied instructions, or other topology forms. Each capability must advance through the same documented -> modeled -> validated -> serialized -> verified process.
