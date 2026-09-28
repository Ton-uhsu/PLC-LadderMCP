# PLC-LadderMCP Technical Research

**Document:** `docs/02-research.md`  
**Status:** Research / Architecture Input  
**Version:** 0.2  
**Research date:** 2026-09-28

## 1. Research Question

The first technical question for PLC-LadderMCP is:

> How can an AI-generated program become a **real Ladder program** that GX Works and SamSoar2022 can open as Ladder, without asking the user to redraw AI-generated text manually?

This document records confirmed import/export paths, constraints, unknowns, and the recommended MVP direction.

---

## 2. Executive Finding

A viable MVP does **not** need to reverse-engineer proprietary PLC project binaries first.

Both target environments expose a text-based import/export route:

- **GX Works2:** Mitsubishi documents a List Format program import/export through CSV for Ladder programs in Simple Projects without labels. A program read from the supported CSV format is displayed as a Ladder program.
- **SamSoar2022:** Its documented File menu includes project data Import/Export in CSV format, and publicly available SamSoar2022 examples are distributed as CSV files intended for File -> Import.

Therefore the recommended first architecture is:

```text
AI Agent
   |
   | MCP structured operations
   v
Ladder Intermediate Representation (IR)
   |
   +-------------------------+
   |                         |
   v                         v
GX Works2 Adapter       SamSoar2022 Adapter
   |                         |
   v                         v
List-format CSV            CSV
   |                         |
   v                         v
GX Works2                SamSoar2022
   |                         |
   v                         v
Real Ladder UI           Real Ladder UI
```

The CSV files are **transport formats**, not the AI-facing programming model.

The AI should manipulate a structured Ladder IR. Vendor adapters should generate the exact import format.

---

## 3. GX Works2 Research

### 3.1 Confirmed capability

The Mitsubishi GX Works2 Version 1 Operating Manual (Simple Project), section 6.16, documents **Writing/Reading List Format Programs**.

The documented behavior is:

1. A Ladder program can be written to a CSV file in list format.
2. A program saved in list format can be read from a CSV file.
3. After reading, GX Works2 displays the imported program as a Ladder program.
4. The manual marks this section as applicable to Q CPU, L CPU, and FX.

This is the strongest currently confirmed route for PLC-LadderMCP.

### 3.2 Important limitation

The same manual explicitly states that this List Format CSV function is supported for:

> Ladder program in Simple project (without labels)

Therefore we must **not** assume that the same route covers every GX Works2 project type.

For the MVP, the supported target should initially be described narrowly as:

```text
GX Works2
  -> Simple Project
  -> Ladder
  -> without labels
  -> List Format CSV import
```

FX-family support is particularly relevant to this project because FX is included in the manual's applicability for this feature.

### 3.3 Confirmed GX Works2 file encoding

The GX Works2 manual specifies the list-format file details:

- Unicode
- UTF-16 Little Endian
- BOM
- Tab-delimited fields
- Each item enclosed in double quotes
- Embedded double quotes represented as doubled quotes
- CR + LF line endings

Therefore the adapter must not simply call a normal UTF-8 CSV writer.

A dedicated GX Works2 serializer is required.

Conceptually:

```text
Ladder IR
   |
   v
Instruction/List representation
   |
   v
GXWorks2ListSerializer
   |
   +-- UTF-16 LE
   +-- BOM
   +-- TAB delimiter
   +-- quoted fields
   +-- CRLF
   v
.csv
```

### 3.4 Confirmed GX Works2 structure

The manual's example identifies these conceptual portions of the generated file:

- Project name
- PLC/PC information
- Header
- Instruction list

The instruction list example contains fields such as:

- Step number
- Line statement
- Instruction
- I/O (Device)
- PI statement
- Note

The exact serializer layout must be captured from real exported files before implementation is considered production-ready.

### 3.5 Ladder and instruction-list relationship

GX Works2 can display/edit Ladder blocks in list format. This is useful for the architecture because a graphical rung can be represented internally as logical structure and compiled into an instruction sequence.

Example conceptual conversion:

```text
Ladder:

|----[ X0 ]----[/ X1 ]------------( Y0 )----|

Instruction form:

LD   X0
ANI  X1
OUT  Y0
```

The AI should **not** be asked to generate this final vendor instruction list directly.

Instead:

```text
AI
 -> add normally-open contact X0
 -> add normally-closed contact X1
 -> add coil Y0

Ladder Engine
 -> validates graph
 -> compiles graph to instruction sequence

GX Works2 Adapter
 -> serializes instruction sequence to GX Works2 list-format CSV
```

### 3.6 Validation strategy for GX Works2

PLC-LadderMCP should provide two validation layers.

#### Internal validation

Before export:

- Ladder topology is valid.
- Instruction is supported by selected PLC.
- Device type is valid.
- Device range is valid.
- Required operands are present.
- Duplicate/conflicting outputs can be reported.
- Branch structure can be compiled.

#### IDE validation

After import, GX Works2 remains the authoritative final compiler/checker for the actual target.

The Mitsubishi manual documents error/warning checking inside GX Works2.

The MVP should not claim full equivalence with Mitsubishi's compiler.

---

## 4. SamSoar2022 Research

### 4.1 Confirmed CSV import/export

The SamSoar2022 manual documents:

```text
File
  -> Import
     Import CSV data into current project

File
  -> Export
     Export current project data to CSV
```

This provides a supported data path instead of requiring binary project modification for the first version.

### 4.2 Evidence of Ladder-oriented CSV workflow

Public SamSoar2022 programming examples are distributed as `.csv` files with instructions to use:

```text
File -> Import -> select .csv
```

Examples include Ladder topics such as:

- state machines
- timers
- comparison instructions
- RTC logic
- communication instructions

This is strong evidence that CSV can be used as a practical Ladder interchange route.

### 4.3 SamSoar instruction representation

The SamSoar documentation also presents Ladder programs using instruction-table forms such as:

```text
NETWORK 000
LD X000
...
```

This supports the same architectural direction as GX Works2:

```text
Graphical Ladder IR
      |
      v
Instruction compiler
      |
      v
Vendor serializer
```

A real CSV exported from the user's installed SamSoar2022 instance was captured and tested on 2026-09-28.

For the minimal Ladder:

```text
X000
--| |--------------------( Y000 )
```

the exported program contained the following essential structure:

```csv
Program,Main
Network,0
LD,X000
OUT,Y000
POP
Network,1
...
```

Observed characteristics:

- UTF-8 with BOM
- `Program,Main` identifies the program
- `Network,<n>` identifies networks
- `LD,<device>` represents the tested normally-open contact
- `OUT,<device>` represents the tested output coil
- `POP` appears at the end of the populated network in this fixture
- Empty networks may remain in the exported file

The exact meaning and behavior of `POP`, complex branch encoding, and other instructions still require dedicated experiments.

### 4.4 SamSoar2022 versions

Samkoon currently distributes SamSoar2022 for its FAs/FAT/S-series related PLC environment.

Version behavior and CSV compatibility should be tested against a pinned version during development.

The repository should eventually document a tested compatibility matrix rather than claiming support for every SamSoar2022 release.

---

## 5. Recommended Intermediate Representation

The core system should use a vendor-neutral Ladder IR.

A first conceptual model:

```text
Project
├── metadata
│   ├── project_id
│   ├── name
│   ├── vendor
│   ├── plc_family
│   └── plc_model
│
├── programs[]
│   └── Program
│       ├── name
│       └── networks[]
│           └── Network
│               ├── id
│               ├── comment
│               └── graph
│
├── symbols/comments
└── version
```

A network should represent actual topology rather than only a string of instructions.

Example:

```json
{
  "id": "N001",
  "type": "rung",
  "logic": {
    "type": "series",
    "items": [
      {
        "type": "contact",
        "mode": "NO",
        "device": "X0"
      },
      {
        "type": "contact",
        "mode": "NC",
        "device": "X1"
      },
      {
        "type": "coil",
        "device": "Y0"
      }
    ]
  }
}
```

This is only a conceptual draft. The final schema should support branches without awkward vendor-specific assumptions.

---

## 6. Why the IR Must Preserve Topology

Storing only:

```text
LD X0
ANI X1
OUT Y0
```

would be easier initially, but it would make several future features harder:

- Visual Ladder preview
- Editing a single contact
- Branch insertion
- Rung-level diff
- AI tools such as `add_contact`
- Vendor translation
- Validation before compilation

Therefore the canonical source should be a Ladder graph/tree representation.

Instruction lists should be a compiled representation.

Recommended relationship:

```text
             Canonical
                |
                v
           Ladder IR
          /         \
         /           \
        v             v
 Web Renderer    Instruction Compiler
                      |
             +--------+--------+
             |                 |
             v                 v
        GX Adapter       SamSoar Adapter
```

---

## 7. Proposed MCP Boundary

MCP should expose semantic PLC operations rather than raw file manipulation.

Good examples:

```text
create_project
get_project
get_networks
get_network
insert_network
delete_network

add_contact
add_coil
add_timer
add_counter
add_instruction
add_branch

update_element
delete_element

validate_project
compile_project
get_diff
export_project
```

Bad primary interface:

```text
write_csv_line
replace_bytes
write_project_binary
```

The AI should express intent in Ladder terms.

The deterministic Ladder Engine should handle file-format details.

---

## 8. Proposed Export Pipeline

### 8.1 GX Works2

```text
Ladder IR
   |
   v
IR Validator
   |
   v
Mitsubishi FX Instruction Compiler
   |
   v
GX Works2 List Format Model
   |
   v
GX Works2 Serializer
   |
   v
UTF-16 LE List-format CSV
   |
   v
GX Works2 -> Read from CSV File
   |
   v
Ladder displayed in GX Works2
```

### 8.2 SamSoar2022

```text
Ladder IR
   |
   v
IR Validator
   |
   v
Samkoon Instruction Compiler
   |
   v
SamSoar CSV Model
   |
   v
SamSoar Serializer
   |
   v
CSV
   |
   v
SamSoar2022 -> File -> Import
   |
   v
Ladder project
```

---

## 9. Importing Existing Projects

Creating new Ladder is only half of the requirement.

PLC-LadderMCP also needs:

```text
Existing IDE project
       |
       v
Export from IDE
       |
       v
CSV/List format
       |
       v
Vendor Parser
       |
       v
Instruction representation
       |
       v
Ladder decompiler/parser
       |
       v
Ladder IR
       |
       v
AI can inspect/modify
```

This means adapters eventually need both directions:

```text
IR <-> Vendor interchange format
```

For MVP, export/generation may be implemented before full round-trip import if necessary.

---

## 10. Web Application Role

The web application should render the canonical Ladder IR directly.

It should **not** render screenshots of GX Works or SamSoar.

The renderer should support at least:

- left/right power rails
- normally-open contacts
- normally-closed contacts
- coils
- SET/RST
- timers
- counters
- instruction/function blocks
- series connections
- parallel branches
- network/rung comments
- device labels/comments

This allows the user to inspect the exact logic before export.

---

## 11. Safety Boundary

The initial system should stop at project generation/export.

It should not directly:

- write to a running PLC
- force I/O
- change RUN/STOP state
- perform online program changes

Mitsubishi's own manual warns that online operations and program changes to a running PLC require appropriate safety measures and can have serious consequences.

Therefore the MVP flow remains:

```text
AI -> Generate -> Validate -> Human Review -> Export -> PLC IDE
```

The PLC IDE and human operator remain responsible for final compile/check/download.

---

## 12. MVP Technical Scope

### Phase 1 target

Support one narrow, testable path extremely well:

```text
PLC family:
Mitsubishi FX

IDE:
GX Works2

Project:
Simple Project / Ladder / without labels

Operations:
- NO contact
- NC contact
- coil
- SET/RST
- timer
- counter
- basic MOV
- basic comparisons
- simple branches

Output:
GX Works2 List Format CSV

UI:
Web Ladder preview

AI:
MCP tools
```

### Phase 2

Add:

- SamSoar2022 CSV adapter
- Round-trip import
- richer branches
- comments
- project diff
- undo/version history

### Phase 3

Investigate:

- GX Works2 labeled projects
- full project formats
- additional Mitsubishi families
- additional Samkoon PLC models
- additional instructions
- other PLC IDEs

---

## 13. Required Experiments

Before implementing the complete adapter, create a small reference project manually in each IDE and export it.

### EXP-001 - GX Works2 minimal exports

Create separate Ladder projects containing:

1. `X0 -> Y0`
2. `X0 AND X1 -> Y0`
3. `X0 OR X1 -> Y0`
4. `X0 AND NOT X1 -> Y0`
5. Timer
6. Counter
7. SET/RST
8. MOV
9. Comparison
10. Nested branch

Export each using GX Works2's list-format CSV.

Then compare the files byte-for-byte and document:

- header
- PLC information
- instruction rows
- step numbering
- branch encoding
- comments/statements
- END handling
- encoding

### EXP-002 - GX Works2 generated import — PASS (2026-09-28)

A real GX Works2 export containing `X000 -> Y000` was used as the known-good fixture.

The file was inspected and confirmed to use the expected GX Works2 list-format encoding:

- UTF-16 LE
- BOM
- tab-separated fields
- quoted fields
- CRLF line endings

For the first generated-import test, only the device values were changed while preserving the exact exported structure:

```text
X000 -> M000
Y000 -> M001
```

The resulting file represented:

```text
M000
--| |--------------------( M001 )
```

The generated file was imported back into the user's GX Works2 installation successfully. GX Works2 displayed a real Ladder rung with `M0` contact driving `M1` coil, followed by `END`.

GX Works2 normalized the displayed device names from `M000/M001` to `M0/M1`.

**Result: PASS.**

This proves that PLC-LadderMCP can produce a modified list-format file outside GX Works2 and have GX Works2 reconstruct it as editable Ladder logic.

The next stronger test is to generate the complete file from scratch rather than modifying a known-good fixture.

Original verification target:

```text
generated file
 -> GX Works2 Read from CSV
 -> no import error
 -> correct visual Ladder
 -> compile/check succeeds
```

### EXP-003 - SamSoar2022 minimal export — PARTIAL PASS (2026-09-28)

A minimal program was exported from the user's installed SamSoar2022 instance.

Test Ladder:

```text
X000
--| |--------------------( Y000 )
```

Observed exported representation:

```csv
Program,Main
Network,0
LD,X000
OUT,Y000
POP
```

Additional empty `Network` rows were also present in the project export.

The file was observed as UTF-8 with BOM.

**Result: PASS for the minimal NO-contact + OUT-coil export.**

The larger instruction set remains untested. Future fixtures are still required for NC, AND, OR/branches, timer, counter, SET/RST, MOV, comparison, and nested branches.

### EXP-004 - SamSoar generated import — PASS (2026-09-28)

Using the real SamSoar2022 export as the known-good fixture, PLC devices were changed:

```text
X000 -> M000
Y000 -> M001
```

This produced a test program whose essential instruction representation was:

```csv
Program,Main
Network,0
LD,M000
OUT,M001
POP
```

The generated/modified CSV was imported into the user's SamSoar2022 installation successfully and reconstructed as Ladder logic:

```text
M000
--| |--------------------( M001 )
```

**Result: PASS.**

This confirms that an externally produced SamSoar2022-compatible CSV can be imported as real Ladder logic.

As with GX Works2, the next stronger test is a serializer that creates the complete file from scratch rather than modifying a fixture.

Original verification target:

```text
generated CSV
 -> File -> Import
 -> correct Ladder
 -> project validation succeeds
```

### EXP-005 - Round-trip

For both IDEs:

```text
IDE
 -> export
 -> parser
 -> IR
 -> serializer
 -> import into IDE
```

Compare the resulting Ladder semantically.

---

## 14. Open Questions

The following remain unresolved and require testing or additional documentation.

### GX Works2

- Exact list-format behavior for every FX model.
- Exact handling of complex branches.
- Exact representation of all applied instructions.
- How much project metadata can be reconstructed through list-format import.
- Best strategy for comments/device comments.
- Labeled-project support.
- Whether additional supported interchange routes provide advantages over list-format CSV.

### SamSoar2022

- Full CSV schema beyond the minimal tested fixture.
- Network/rung representation for complex logic.
- Branch representation.
- Project metadata fields.
- Device comment representation.
- Compatibility differences between versions.
- Compatibility differences between Samkoon PLC families.

### Cross-vendor

- Common timer semantics.
- Counter semantics.
- Edge/pulse instructions.
- Retentive devices.
- Special relays/registers.
- Vendor-specific applied instructions.
- Address validation rules.

---

## 15. Current Architecture Decision Candidate

Based on current research, the strongest candidate architecture is:

```text
                    AI
                     |
                    MCP
                     |
                     v
              Ladder Service
                     |
       +-------------+-------------+
       |                           |
       v                           v
 Project/Version Store        Ladder Validator
       |                           |
       +-------------+-------------+
                     |
                     v
                 Ladder IR
                /         \
               /           \
              v             v
       Web Renderer      Compiler Layer
                              |
                   +----------+----------+
                   |                     |
                   v                     v
            GX Works2 Adapter    SamSoar2022 Adapter
                   |                     |
                   v                     v
             List CSV                 CSV
```

### Key decision

**Do not reverse-engineer proprietary project binaries for the MVP unless testing proves the documented interchange formats are insufficient.**

The documented CSV/list-format routes provide a much safer and more maintainable first path.

---

## 16. Sources

### Mitsubishi Electric

- GX Works2 Version 1 Operating Manual (Simple Project), section 6.16, Writing/Reading List Format Programs:
  https://dl.mitsubishielectric.com/dl/fa/document/manual/plc/sh080780eng/sh080780engaf.pdf
- Mitsubishi Electric GX Works2 product information / CSV data interoperability:
  https://www.mitsubishielectric.com/fa/products/cnt/plceng/smerit/gx_works2/maintenance/index.html

### SamSoar2022 / Samkoon ecosystem

- SamSoar2022 Manual - Menu Bar (CSV Import/Export):
  https://factonation.com/manual/samsoar2022/edit/menubar
- SamSoar2022 example programs distributed for CSV import:
  https://factonation.com/plc-examples
- Samkoon PLC software downloads:
  https://www.samkoon.store/plc-software/

---

## 17. Research Conclusion

The project appears technically feasible without requiring the AI to generate screenshots, ASCII Ladder, or proprietary binary project files.

The most promising first implementation is:

> **AI semantic tool calls -> canonical Ladder IR -> deterministic instruction compiler -> vendor-specific CSV serializer -> import into PLC IDE as real Ladder.**

For GX Works2, this route is directly supported by Mitsubishi documentation for Ladder programs in Simple Projects without labels.

For SamSoar2022, a real export from the user's installation has now been captured. A minimal `LD + OUT` program was successfully modified externally and imported back as real Ladder.

As of 2026-09-28, **minimal generated-import POCs have passed for both GX Works2 and SamSoar2022**.

What has been proven so far:

```text
GX Works2:
real export -> external device modification -> import -> real Ladder  PASS

SamSoar2022:
real export -> external device modification -> import -> real Ladder  PASS
```

What has **not** yet been proven is full from-scratch serialization or complex Ladder topology.

The next engineering task should therefore be a **from-scratch serializer test**, first reproducing the already verified rung:

```text
M0 ----| |----------------( M1 )
```

The serializer should create the entire output without reading or modifying the original fixture. That generated file should then be imported into each IDE and compared against the expected Ladder.
