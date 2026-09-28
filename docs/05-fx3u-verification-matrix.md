# FX3U Verification Matrix

The first multi-output branch fixture is verified in GX Works2. The next batch intentionally advances one capability at a time.

| Fixture | Expected list intent | Status |
|---|---|---|
| NC M0 -> Y0 | LDI M0 / OUT Y0 | serialized, pending GX verification |
| M0 AND M1 -> Y0 | LD M0 / AND M1 / OUT Y0 | serialized, pending GX verification |
| M0 -> SET Y0 | LD M0 / SET Y0 | serialized, pending GX verification |
| M0 -> RST Y0 | LD M0 / RST Y0 | serialized, pending GX verification |
| M0 -> T0 K10 | timer OUT form | modeled; serializer verification pending |
| M0 -> C0 K10 | counter OUT form | modeled; serializer verification pending |
| M0 -> MOV K100 D0 | applied data transfer | modeled; serializer verification pending |
| M0 -> ADD D0 D1 D2 | applied arithmetic | modeled; serializer verification pending |

## Rule

Do not mark a row verified from compilation alone. Export it, import into GX Works2, and confirm the rendered Ladder/instruction and step count.

## Next topology work

After the simple rows pass:
1. OR contact branch.
2. Nested branch.
3. Parallel branches containing conditions and outputs.
4. Multiple action branches mixed with SET/RST/instructions.
5. Compare contacts / compare instructions according to the FX3U manual.


## Verified combined batch — 2026-09-28
GX Works2 real import/render PASS: NC, series AND, SET, RST, T0 K10, C0 K10, MOV K100 D0, ADD D0 D1 D2, END. Imported as editable Ladder.

## Advanced batch
Pending real GX Works2 verification: OR, mixed AND/OR/NC using ORB, MPS/MRD/MPP with mixed actions, CMP, ZCP, SUB, MUL, DIV, INC, DEC, WAND, WOR, WXOR.


## Verified advanced batch — 2026-09-28
Status: GX WORKS2 VERIFIED from real import/render screenshot (91 steps including END).

Verified editable Ladder forms/instructions:
- OR branch: M10 OR M11 -> Y010
- mixed branch: (M12 AND M13) OR (M14 AND NOT M15) -> Y011, compiled with ORB
- MPS/MRD/MPP mixed action branch: M16 -> Y012 / SET M20 / RST M21
- CMP D0 D1 M30
- ZCP K10 K100 D2 M40
- SUB D10 D11 D12
- MUL D20 D21 D22
- DIV D30 D31 D32
- INC D40
- DEC D41
- WAND D50 D51 D52
- WOR D53 D54 D55
- WXOR D56 D57 D58
- END at step 90; GX Works2 reports 91 steps.

This verification applies to the exact operand forms above; it does not imply every FX3U operand/device variant is verified.


## Next batch — pulse, nested, shift, conversion, 32-bit math
Pending real GX Works2 verification:
- LDP, LDF, ANP, ANF, ORP, ORF
- deeper boolean topology using ORB + AND
- SFTL, SFTR, ROL, ROR
- BCD, BIN, NEG
- DADD, DSUB, DMUL, DDIV

Do not mark these verified until real GX Works2 import/render is confirmed. Flow-control instructions are intentionally deferred to a separate fixture because they require label/pointer/subroutine structure rather than only an opcode row.
