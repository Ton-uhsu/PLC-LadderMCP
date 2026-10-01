# Structured Ladder wire editing

**Status:** Implemented editor slice, 2026-10-01 (WORK-008 / TASK-005).
**Requirements:** REQ-037, REQ-039, REQ-040, REQ-095, REQ-097, REQ-100, REQ-111, REQ-126, REQ-127. Requirements V1.0 is unchanged.

## Canonical representation

The existing v0.2 implementation accepts an additive logic node `{ kind: "wire", id: string, connected: boolean }`. `connected: true` represents an explicit continuous path; `false` represents an incomplete disconnected segment. It has the same globally unique identity rules as other logic nodes. The canonical snapshot, logic/content hashes and immutable revision history retain this state; renderer coordinates and zoom are not persisted. An empty series remains an incomplete draft and never means a connected wire.

This is a backwards-compatible reader extension for existing saved v0.2 snapshots, not completion of the target V1 typed schema in TASK-003. Existing projects need no conversion or SQL migration. Older backends reject the new wire kind: update Web/backend together, rebuild/restart the backend before using wire edits. Forward compatibility with an older reader is not claimed.

## Directional operations

| Shortcut | Operation at selection |
|---|---|
| Ctrl+Right / Ctrl+Left | On a wire: toggle connected/gap with the same ID. On a condition: toggle an adjacent wire on that side, or insert one when absent. A series selection inserts at its condition boundary. |
| Ctrl+Down / Ctrl+Up | Add an incomplete wire branch below/above the selected condition, or remove an adjacent wire-only/empty branch. Use the nearest enclosing parallel when already in a branch. |

A vertical addition retains the original selection, so pressing the same shortcut again removes that empty branch. A two-branch wrapper is unwrapped when only its original branch remains. Original subtree IDs and unrelated networks remain unchanged. Occupied branches and outputs are never deleted by these commands; the editor reports why the operation is blocked. Select the new gap and use Ctrl+Left/Right to connect it, or insert a contact to replace its wire placeholder. Conditions inserted on a wire replace that segment; output tools retain the existing output fanout rules.

All commands pass through the existing human edit/autosave API and session Undo/Redo. Key repeat is ignored to prevent an accidental toggle loop. Shortcuts do not intercept text inputs, selects, contenteditable areas or symbol dialogs. This is structured series/parallel editing, not arbitrary coordinate-based wiring between unrelated nodes.

## Compile and adapter behavior

Disconnected wires produce `DISCONNECTED_WIRE` errors and block Compile/Apply/Export. They remain savable human drafts. Connected wires are Boolean TRUE: neutral in series, a bypass in parallel. Compile simplifies a temporary tree only; it preserves the saved IR, including bypassed contacts and wire IDs. It checks all branches for gaps/empty paths before simplification and rejects wire bypasses of actions.

If explicit wires bypass every condition, validation emits `ALWAYS_ON_OUTPUT`. The FX3U compiler uses `LD M8000` for that RUN-enabled path. Vendor reference: [Mitsubishi JY997D16601, section 37.2.1](https://dl.mitsubishielectric.com/dl/fa/document/manual/plc_fx/jy997d16601/jy997d16601r.pdf), with [Mitsubishi FAQ 12242](https://fa-faq.mitsubishielectric.co.jp/faq/show/12242) identifying the FX always-ON relay. This mapping is implementation inference from the vendor device semantics; it is not a new real-IDE verification record.

GX List serialization reflects the simplified instruction semantics; importing it does not restore the original wire layout or IDs. SamSoar's existing restricted serializer normalizes connected condition wires and emits its existing LD form for an unconditional path. It explicitly rejects remaining nested conditions instead of silently dropping them. Neither path establishes full IDE compatibility, retained artifact lineage or revision-bound Compile completion.

## Evidence

21 Web tests passed, including all directional operations, identity preservation, occupied-branch guards, disconnected hashing/schema/compile validation, wire-to-contact replacement, bypass warning, compile-only normalization and GX List semantic round-trip. SamSoar regressions cover neutral wires, unconditional paths, gap rejection and rejection of unsupported nested conditions. Web/backend production builds passed; semantic smoke, HTTP auth/MCP E2E and original FX3U fixture passed. Persistence suite: 7 passed, 2 native suites skipped.

Optional Chromium harness passed both local HTTP and PGlite-backed application modes: Ctrl+Left/Right toggles, Ctrl+Up/Down branch addition/removal, Undo/Redo and saved gap reload. Desktop/narrow workspace captures were inspected. Native PostgreSQL/Goose and real IDE wire acceptance remain separate evidence gates. The npm tsx CLI wrapper encountered an environment pipe permission error; the same smoke/E2E entrypoints passed using `node --import tsx`.
