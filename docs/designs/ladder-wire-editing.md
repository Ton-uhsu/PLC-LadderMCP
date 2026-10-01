# Structured Ladder wire editing

**Status:** Implemented editor slice, 2026-10-01 (WORK-008, WORK-009 / TASK-005).
**Requirements:** REQ-037, REQ-039, REQ-040, REQ-095, REQ-097, REQ-100, REQ-111, REQ-126, REQ-127. Requirements V1.0 is unchanged.

## Canonical representation

The existing v0.2 implementation accepts an additive logic node `{ kind: "wire", id: string, connected: boolean }`. `connected: true` represents an explicit continuous path; `false` represents an incomplete disconnected segment. It has the same globally unique identity rules as other logic nodes. The canonical snapshot, logic/content hashes and immutable revision history retain this state; renderer coordinates and zoom are not persisted. An empty series remains an incomplete draft and never means a connected wire.

This is a backwards-compatible reader extension for existing saved v0.2 snapshots, not completion of the target V1 typed schema in TASK-003. Existing projects need no conversion or SQL migration. Older backends reject the new wire kind: update Web/backend together, rebuild/restart the backend before using wire edits. Forward compatibility with an older reader is not claimed.

## Grid projection and directional operations

Columns are fixed at 120px and rows at 88px, independent of viewport width. A wire/contact/coil occupies one column; long instructions span an integer number of columns. Series adds columns, parallel adds rows; split/join lines follow cell boundaries. The column ruler uses the same grid origin and spacing. The minimum rung has ten columns, with outputs aligned to the final column unless explicit wires follow them or a wider path requires expansion. Wire suffixes reserve columns after the output without shifting other branch coils. Zoom scales the complete grid; narrower windows scroll horizontally instead of stretching wires.

A cell cursor selects canonical nodes, projected connection padding or blank cells. Projected connected padding is split into one-column segments and materialized with fresh wire IDs when edited. Blank skipped cells become disconnected placeholders, preserving the requested column without silently connecting them. Empty groups remain incomplete drafts. Coordinates/cursor are transient projection state, never an alternative authoritative graph. Blank cells without a structured insertion position require creating a branch first; arbitrary floating connections are not supported.

| Shortcut | Operation at cell cursor |
|---|---|
| Arrow keys / Home / End | Move one column/row, including padding/blank cells; Home/End select the first/last column. Up/Down may cross adjacent networks. |
| Ctrl+Right / Ctrl+Left | Move to the adjacent column and add/toggle exactly its wire segment. Existing wire IDs remain stable. Occupied contact/output cells are protected. |
| Ctrl+Down / Ctrl+Up | Add an incomplete branch below/above the selected cell, or remove an adjacent wire-only/empty branch. Wrapping applies at that cell rather than widening an unrelated whole branch. |

A vertical addition retains the original selection, so pressing the same shortcut again removes that empty branch. A two-branch wrapper is unwrapped when only its original branch remains. Original subtree IDs and unrelated networks remain unchanged. Filled branches are never removed by these shortcuts. To reconnect a gap, start one cell beside it and Ctrl+Left/Right toward it. Contact insertion replaces a selected condition wire; coil/instruction insertion replaces an output branch placeholder. Output branches require an output symbol; a bare wire cannot bypass or substitute for a coil. Horizontal wires before/after outputs and wire-only lead-in forks preserve the existing action IDs.

All edits pass through the existing human edit/autosave API and session Undo/Redo. Key repeat is ignored to prevent accidental toggle loops. Shortcuts do not intercept text inputs, selects, contenteditable areas or symbol dialogs. Cell clipboard operations materialize the selected connection rather than copying its neighboring symbol. Compound subtree operations remain available through Rung structure.

## Compile and adapter behavior

Disconnected wires produce `DISCONNECTED_WIRE` errors and block Compile/Apply/Export. They remain savable human drafts. Connected wires are Boolean TRUE: neutral in series, a bypass in parallel. Compile simplifies a temporary tree only; it preserves the saved IR, including bypassed contacts and wire IDs. It checks all branches for gaps/empty paths before simplification. Output paths are validated separately: connected wires are neutral connections around actions, every output branch must terminate in a supported action, and condition-bearing output paths or action-free output branches are rejected. Parallel outputs retain branch order through MPS/MRD/MPP; wires never remove or bypass output actions.

If explicit wires bypass every condition, validation emits `ALWAYS_ON_OUTPUT`. The FX3U compiler uses `LD M8000` for that RUN-enabled path. Vendor reference: [Mitsubishi JY997D16601, section 37.2.1](https://dl.mitsubishielectric.com/dl/fa/document/manual/plc_fx/jy997d16601/jy997d16601r.pdf), with [Mitsubishi FAQ 12242](https://fa-faq.mitsubishielectric.co.jp/faq/show/12242) identifying the FX always-ON relay. This mapping is implementation inference from the vendor device semantics; it is not a new real-IDE verification record.

GX List serialization reflects the simplified instruction semantics; importing it does not restore the original wire layout or IDs. SamSoar's existing restricted serializer normalizes connected condition wires and emits its existing LD form for an unconditional path. It explicitly rejects remaining nested conditions instead of silently dropping them. Neither path establishes full IDE compatibility, retained artifact lineage or revision-bound Compile completion.

## Evidence

WORK-008 established wire snapshot/schema/hash validation, compile-only condition normalization and GX List semantic round-trip; SamSoar regressions cover neutral wires, unconditional paths, gaps and unsupported nested conditions. WORK-009 extends this to fixed-cell geometry and output connections. 24 Web tests passed, including viewport-independent layout, one-cell wire width, column-preserving materialization (including empty-root distant cells), exact adjacent-cell edits, occupied-symbol protection, output gap completion/fanout, stable IDs and coil suffix alignment. Web/backend production builds, semantic smoke, HTTP auth/MCP E2E and the original FX3U fixture passed. Persistence suite: 7 passed, 2 native suites skipped.

The optional Chromium harness passed both local HTTP and PGlite-backed application modes: actual cell/ruler center alignment, one-column wire selection width, Ctrl-arrow edits, coil-side gaps, output branch filling, occupied branch protection, Undo/Redo and saved gap reload. Desktop and narrow workspace captures were inspected. Native PostgreSQL/Goose and real IDE acceptance remain separate evidence gates. The npm tsx CLI wrapper encountered an environment pipe permission error; the same smoke/E2E entrypoints passed using `node --import tsx`.

TASK-005 remains Partial for the target typed IR, rendered Review and revision-bound Compile integration. The legacy AI proposal builders still have narrower topology support; this editor slice does not establish proposal generation for every wired output form.
