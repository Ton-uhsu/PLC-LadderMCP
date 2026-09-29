import { compileProject } from "./fx3u-compiler.js";
import { generateGxWorks2ListText } from "./gxworks2-list.js";
import { validateFx3uV02 } from "./fx3u-validator.js";
import { m0ToY0Y5Fixture } from "./v02.js";

const validation=validateFx3uV02(m0ToY0Y5Fixture);
if(!validation.valid) throw new Error(JSON.stringify(validation.issues));
const list=compileProject(m0ToY0Y5Fixture);
const expected=["LD M0","MPS","OUT Y0","MRD","OUT Y1","MRD","OUT Y2","MRD","OUT Y3","MRD","OUT Y4","MPP","OUT Y5"];
const actual=list.map(x=>[x.instruction,x.device].filter(Boolean).join(" "));
if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error(`Unexpected compile: ${actual.join(", ")}`);
const csv=generateGxWorks2ListText(m0ToY0Y5Fixture);
if(csv.includes("\r\n\r\n"))throw new Error("GX list output contains an unexpected blank row.");
console.log("IR v0.2 FX3U fixture PASS");
console.log(actual.join("\n"));
