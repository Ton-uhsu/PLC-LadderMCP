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
