import { rmSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), ".plc-ladder-test-smoke");
process.env.PLC_LADDER_DATA_DIR = dir;
rmSync(dir, { recursive: true, force: true });

try {
  await import("./project.smoke.js");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
