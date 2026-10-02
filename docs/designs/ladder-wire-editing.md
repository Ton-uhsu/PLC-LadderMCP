# Structured Ladder wire editing

**Status:** Implemented editor slice, 2026-10-01 (WORK-008, WORK-009, WORK-011, WORK-012 / TASK-005).
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
| Ctrl+Right / Ctrl+Left | Move to the adjacent column and ensure that wire segment is connected. Existing connected segments remain connected. Occupied contact/output cells are protected. |
| Ctrl+Down / Ctrl+Up | Draw into the adjacent row and move the cursor there. Crossing the top or bottom edge creates a connected row automatically. Wrapping applies at that cell rather than widening an unrelated whole branch. |

Directional drawing is additive and does not create or toggle disconnected `Gap` nodes. Existing disconnected nodes remain readable for saved-draft compatibility and become connected when drawn into. Original subtree IDs and unrelated networks remain unchanged. Contact insertion replaces a selected condition wire; coil/instruction insertion replaces an output branch placeholder. Output branches require an output symbol; a bare wire cannot bypass or substitute for a coil. Horizontal wires before/after outputs and wire-only lead-in forks preserve the existing action IDs.

All edits pass through the existing human edit/autosave API and session Undo/Redo. Key repeat is ignored to prevent accidental repeated segments. Shortcuts do not intercept text inputs, selects, contenteditable areas or symbol dialogs. Cell clipboard operations materialize the selected connection rather than copying its neighboring symbol. Compound subtree operations remain available through Rung structure.

## Rectangular cell selection

Pointer drag selects a rectangular range of cells inside one network. Shift-click extends the range from its stable anchor; a normal click or keyboard navigation starts a new one-cell range. The canvas overlays one visible selection rectangle and the Properties/status areas show the covered cell count. Escape clears the range.

Delete clears the entire range through one project edit, so one Undo restores it. Contacts and actions intersecting the range are removed once even when they span multiple columns. Explicit connected wires become disconnected gaps; projected connection padding is materialized only for the selected cells and then disconnected. Blank-only ranges do not create an edit. Multi-cell insert, branch, edit, copy, cut, paste and duplicate operations are disabled for this slice; multi-cell clipboard semantics remain future work.

## Compile and adapter behavior

Disconnected wires produce `DISCONNECTED_WIRE` errors and block Compile/Apply/Export. They remain savable human drafts. Connected wires are Boolean TRUE: neutral in series, a bypass in parallel. Compile simplifies a temporary tree only; it preserves the saved IR, including bypassed contacts and wire IDs. It checks all branches for gaps/empty paths before simplification. Output paths are validated separately: connected wires are neutral connections around actions, every output branch must terminate in a supported action, and condition-bearing output paths or action-free output branches are rejected. Parallel outputs retain branch order through MPS/MRD/MPP; wires never remove or bypass output actions.

If explicit wires bypass every condition, validation emits `ALWAYS_ON_OUTPUT`. The FX3U compiler uses `LD M8000` for that RUN-enabled path. Vendor reference: [Mitsubishi JY997D16601, section 37.2.1](https://dl.mitsubishielectric.com/dl/fa/document/manual/plc_fx/jy997d16601/jy997d16601r.pdf), with [Mitsubishi FAQ 12242](https://fa-faq.mitsubishielectric.co.jp/faq/show/12242) identifying the FX always-ON relay. This mapping is implementation inference from the vendor device semantics; it is not a new real-IDE verification record.

GX List serialization reflects the simplified instruction semantics; importing it does not restore the original wire layout or IDs. SamSoar's existing restricted serializer normalizes connected condition wires and emits its existing LD form for an unconditional path. It explicitly rejects remaining nested conditions instead of silently dropping them. Neither path establishes full IDE compatibility, retained artifact lineage or revision-bound Compile completion.

## Evidence

WORK-008 established wire snapshot/schema/hash validation, compile-only condition normalization and GX List semantic round-trip; SamSoar regressions cover neutral wires, unconditional paths, gaps and unsupported nested conditions. WORK-009 extends this to fixed-cell geometry and output connections. 24 Web tests passed, including viewport-independent layout, one-cell wire width, column-preserving materialization (including empty-root distant cells), exact adjacent-cell edits, occupied-symbol protection, output gap completion/fanout, stable IDs and coil suffix alignment. Web/backend production builds, semantic smoke, HTTP auth/MCP E2E and the original FX3U fixture passed. Persistence suite: 7 passed, 2 native suites skipped.

The optional Chromium harness passed both local HTTP and PGlite-backed application modes: actual cell/ruler center alignment, one-column wire selection width, Ctrl-arrow edits, coil-side gaps, output branch filling, occupied branch protection, Undo/Redo and saved gap reload. Desktop and narrow workspace captures were inspected. Native PostgreSQL/Goose and real IDE acceptance remain separate evidence gates. The npm tsx CLI wrapper encountered an environment pipe permission error; the same smoke/E2E entrypoints passed using `node --import tsx`.

WORK-011 changed directional grid input from gap toggling to additive connected drawing. Unit coverage proves left/right connectivity, vertical cursor movement, continuation across newly created rows and automatic top/bottom row creation. Isolated localhost browser QA exercised down/right/down/right/up/left across three rows with no disconnected wire nodes or UI errors. The repository Playwright scenario was updated for the new interaction; it was not executed in this environment because the optional Playwright package is absent.

WORK-012 adds rectangular selection and atomic range clearing. Unit coverage proves reverse-drag normalization, symbol/wire clearing, projected-wire gap materialization, unrelated-network preservation and blank-range no-op behavior. Isolated localhost browser QA exercised Shift-click, pointer drag, visual range/count feedback and Escape. The optional Playwright scenario now covers Delete plus one-step Undo, but could not run here because the optional Playwright package is absent.

TASK-005 remains Partial for the target typed IR, rendered Review and revision-bound Compile integration. The legacy AI proposal builders still have narrower topology support; this editor slice does not establish proposal generation for every wired output form.

## WORK-013 — rectangular clipboard and explicit Compile, 2026-10-01

Readiness: PASS under the user-confirmed editing → Compile → export scope. No V1 baseline requirement was changed.

Ctrl+C/X/V and toolbar/context actions now support rectangular selection. Copy captures symbols, projected/explicit wires, instruction spans and branch edges. Cut clears cells in one edit and retains vacated columns as explicit gaps; output padding is materialized before removing its output so it cannot collapse left. Copy allocates new identities; same-project Cut retains absent identities, while undo collisions and cross-project moves remap conflicting identities. A complete nested rung can be pasted into an empty network, preserving its original subtree and joints. A matching blank subtree can be replaced. Other ranges paste into connected destination cells and verify relative coordinates, original symbols and branch edges before committing. Symbol collisions, partial instructions, unmatched branch topology and unsupported allocations fail atomically, with a visible explanation. For arbitrary partial branch regions, draw matching destination branches first; this is still structured IR, not an unrestricted graph editor.

Explicit Compile uses the server-side shared validator/compiler. Local runs pin the exact human-authenticated snapshot; PostgreSQL runs pin the exact saved revision and retain runs, diagnostics and audit rows. Errors navigate to their network/node and highlight the canvas; warnings do not automatically fail Compile. Logic edits invalidate the visible result and export eligibility. Database history reloads from durable runs; local history is session-only.

Export is now server-gated in both modes. The local gate requires a passing run for the exact current snapshot. The database gate requires a passing Compile for the exact current saved revision and compiler version, then separately validates the selected adapter. It creates one logical export version per revision, separate export events, and immutable retained bytes with BOM/encoding/SHA-256. Replaying an identical request returns the same artifact; incompatible reuse is rejected. Failed adapters retain a failed event/diagnostic without a successful artifact. The target IDE version is recorded from user input, not invented.

Verification: 38 Web tests passed; persistence tests passed 8 with 2 native PostgreSQL/Goose checks skipped. Web/backend builds, semantic smoke and HTTP/MCP E2E passed. Chromium browser QA passed local and PGlite application modes for rectangular Copy/Cut/Paste, atomic Undo/Redo, collision rejection, Compile invalidation, gap navigation/highlight, actual GX download bytes and database Compile history reload, plus the existing editor regression suite. Desktop/narrow and diagnostic/export screenshots inspected. GX Unicode UTF-16LE BOM output round-trips through the importer with equivalent instruction fanout.

Limits: SamSoar remains an explicitly labelled intermediate CSV adapter for series contacts/coil outputs; edge contacts, nested conditions and unsupported outputs are rejected. This run did not establish native SamSoar import or launch either Windows IDE. Real IDE import/Convert/editable-Ladder evidence, native PostgreSQL/Goose, V1 instruction completeness, metadata-equivalent Compile reuse, asynchronous interruption recovery and historical artifact browsing remain separate gates. Generated bytes and embedded-engine/browser tests are not IDE or native PostgreSQL certification.

## WORK-014 — cursor-first classic editing (2026-10-01)

User prioritizes editing behavior resembling GX Works2 before native export. Reference: Mitsubishi GX Works2 Simple Project manual SH080780ENG AG, https://dl.mitsubishielectric.com/dl/fa/document/manual/plc/sh080780eng/sh080780engag.pdf (shortcut appendix and Ladder input chapters). This slice implements a white fixed-cell sheet, neutral compact menus/toolbar, program navigation, optional properties, and modal input from the cursor. F5/F6/F7/F8 select NO contact/NC contact/coil/application instruction. Enter edits the selected symbol; double-click a blank cell opens input. Overwrite replaces a leaf at its coordinate, preserving identity when the kind is unchanged; Insert retains structured insertion. Accepted overwrite input moves the cursor past the symbol. Shift+arrows extends a rectangular selection; Escape cancels input without saving; Insert toggles mode. Existing Ctrl-arrow wire drawing remains the established project shortcut.

Scope is a working interaction prototype, not complete GX Works2 parity: vendor-specific insertion/deletion rules, arbitrary graph branches, instruction autocomplete/help, monitor mode, native project import/export and exact full keyboard equivalence still need separate work. Browser QA covers the cursor workflow and existing clipboard/Compile workflows in local and PGlite modes; native Windows IDE opening remains unverified.


## WORK-015 — restore original colors (2026-10-02)

User requests the original dark theme while retaining the cursor-first IDE layout. Remove the white workspace overrides, restore the renderer's dark symbols, and style the newly added menu/program tree/input dialog using the existing navy/charcoal palette. Editing semantics are unchanged. Web build and full local/PGlite Chromium workflow pass; dark desktop, symbol-dialog and narrow screenshots inspected.
