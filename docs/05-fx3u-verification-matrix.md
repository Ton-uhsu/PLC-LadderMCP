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


## Next batch real GX Works2 result — partial PASS
Screenshot evidence shows the batch imported with 5 errors. Verified in this run: LDP, LDF, ANP, ANF, ORP, ORF; deeper ORB/AND boolean topology; ROL; ROR; BCD; BIN; and the visible 32-bit arithmetic beginning with DADD. The rejected/highlighted cases include the original SFTL D60 K4 K1, SFTR D61 K4 K1, and NEG D68 D69 forms. Those operand forms are invalid for this target and must not be marked verified.

A focused retry fixture now uses SFTL/SFTR bit-device source/destination ranges and in-place NEG D68. Remaining 32-bit arithmetic items should only be marked verified when visible/confirmed in GX Works2.
