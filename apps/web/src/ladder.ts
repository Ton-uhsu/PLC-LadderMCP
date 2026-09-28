import { z } from "zod";

export const ElementSchema = z.discriminatedUnion("type", [
  z.object({ id: z.string(), type: z.literal("contact"), mode: z.enum(["NO", "NC"]), device: z.string().regex(/^[A-Z]+\d+$/) }),
  z.object({ id: z.string(), type: z.literal("coil"), device: z.string().regex(/^[A-Z]+\d+$/) }),
]);

export const ProjectSchema = z.object({
  version: z.literal("0.1"),
  name: z.string().min(1),
  plc: z.object({ family: z.string(), model: z.string() }),
  programs: z.array(z.object({
    name: z.string(),
    networks: z.array(z.object({
      id: z.number().int().nonnegative(),
      elements: z.array(ElementSchema).min(2),
    })),
  })).min(1),
});

export type LadderProject = z.infer<typeof ProjectSchema>;

export const demoProject: LadderProject = {
  version: "0.1",
  name: "Untitled PLC Project",
  plc: { family: "Mitsubishi FX", model: "FX3U" },
  programs: [{
    name: "Main",
    networks: [{
      id: 0,
      elements: [
        { id: "e1", type: "contact", mode: "NO", device: "M0" },
        { id: "e2", type: "coil", device: "M1" },
      ],
    }],
  }],
};

export function validateProject(project: LadderProject) {
  const schema = ProjectSchema.safeParse(project);
  const issues: string[] = [];
  if (!schema.success) issues.push(...schema.error.issues.map(i => i.message));
  for (const program of project.programs) for (const network of program.networks) {
    const coils = network.elements.filter(e => e.type === "coil");
    if (coils.length < 1) issues.push(`Network ${network.id} must contain at least one output coil`);
    const firstCoil = network.elements.findIndex(e => e.type === "coil");
    if (firstCoil >= 0 && network.elements.slice(firstCoil).some(e => e.type !== "coil"))
      issues.push(`Network ${network.id} cannot place contacts after output coils in the current topology subset`);
  }
  return { valid: issues.length === 0, issues };
}

function samDevice(device: string) {
  return device.replace(/^([A-Z]+)0+(\d+)$/, "$1$2");
}

export function generateSamSoar(project: LadderProject) {
  const lines = [`Program,${project.programs[0].name}`];
  for (const network of project.programs[0].networks) {
    lines.push(`Network,${network.id}`);
    for (const element of network.elements) {
      if (element.type === "contact") lines.push(`${element.mode === "NO" ? "LD" : "LDI"},${samDevice(element.device)}`);
      if (element.type === "coil") lines.push(`OUT,${samDevice(element.device)}`);
    }
    lines.push("POP");
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


export function generateGxWorks2(project: LadderProject): Uint8Array {
  const network = project.programs[0]?.networks[0];
  if (!network) throw new Error("No network to export.");

  const contacts = network.elements.filter((e: any) => e.type === "contact") as any[];
  const coils = network.elements.filter((e: any) => e.type === "coil") as any[];
  if (!contacts.length || !coils.length) throw new Error("GX Works2 export requires at least one contact and one coil.");

  const instructions: Array<[string,string]> = [];
  contacts.forEach((e: any, i: number) => {
    const no = e.mode !== "NC";
    instructions.push([i === 0 ? (no ? "LD" : "LDI") : (no ? "AND" : "ANI"), e.device]);
  });

  if (coils.length === 1) {
    instructions.push(["OUT", coils[0].device]);
  } else {
    coils.forEach((e: any, i: number) => {
      instructions.push([i === 0 ? "MPS" : i === coils.length - 1 ? "MPP" : "MRD", ""]);
      instructions.push(["OUT", e.device]);
    });
  }

  const q = (v: string) => '"' + String(v).replace(/"/g, '""') + '"';
  const rows: string[][] = [
    ["(" + project.name + ")"],
    ["PLC Information:", "FXCPU FX3U/FX3UC"],
    ["Step No.", "Line Statement", "Instruction", "I/O(Device)", "Blank", "PI Statement", "Note"],
  ];
  instructions.forEach(([op, dev], step) => rows.push([String(step), "", op, dev, "", "", ""]));
  rows.push([String(instructions.length), "", "END", "", "", "", ""]);
  const text = rows.map(r => r.map(q).join("\t")).join("\r\n") + "\r\n";

  // GX Works2 list CSV fixture is UTF-16 LE with BOM.
  const out = new Uint8Array(2 + text.length * 2);
  out[0] = 0xff; out[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    out[2 + i * 2] = code & 0xff;
    out[3 + i * 2] = code >> 8;
  }
  return out;
}

export function downloadBytes(filename: string, bytes: Uint8Array, mime = "text/csv") {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}


export function generateGxWorks2AdvancedVerificationSuite(): Uint8Array {
  // Advanced FX3U/GX Works2 verification batch. Each logical case is separated
  // by a new LD/LDI instruction so GX renders it as a separate rung.
  const rows: string[][] = [
    ["(FX3U Advanced Verification Suite)"],
    ["PLC Information:", "FXCPU FX3U/FX3UC"],
    ["Step No.", "Line Statement", "Instruction", "I/O(Device)", "Blank", "PI Statement", "Note"],
  ];
  const ins: Array<[string,string]> = [
    // OR: (M10 OR M11) -> Y10
    ["LD","M10"],["OR","M11"],["OUT","Y10"],
    // Mixed: (M12 AND M13) OR (M14 AND NOT M15) -> Y11
    ["LD","M12"],["AND","M13"],["LD","M14"],["ANI","M15"],["ORB",""],["OUT","Y11"],
    // Branch stack: M16 -> Y12, SET M20, RST M21
    ["LD","M16"],["MPS",""],["OUT","Y12"],["MRD",""],["SET","M20"],["MPP",""],["RST","M21"],
    // Compare instructions / data path candidates
    ["LD","M17"],["CMP","D0 D1 M30"],
    ["LD","M18"],["ZCP","K10 K100 D2 M40"],
    // More arithmetic
    ["LD","M19"],["SUB","D10 D11 D12"],
    ["LD","M22"],["MUL","D20 D21 D22"],
    ["LD","M23"],["DIV","D30 D31 D32"],
    // Bit/data
    ["LD","M24"],["INC","D40"],
    ["LD","M25"],["DEC","D41"],
    ["LD","M26"],["WAND","D50 D51 D52"],
    ["LD","M27"],["WOR","D53 D54 D55"],
    ["LD","M28"],["WXOR","D56 D57 D58"],
    ["END",""],
  ];
  const q=(v:string)=>'"'+String(v).replace(/"/g,'""')+'"';
  ins.forEach(([op,dev],step)=>rows.push([String(step),"",op,dev,"","",""]));
  const text=rows.map(r=>r.map(q).join("\t")).join("\r\n")+"\r\n";
  const out=new Uint8Array(2+text.length*2); out[0]=0xff; out[1]=0xfe;
  for(let j=0;j<text.length;j++){const n=text.charCodeAt(j);out[2+j*2]=n&255;out[3+j*2]=n>>8;}
  return out;
}


export function generateGxWorks2NextVerificationSuite(): Uint8Array {
  // Focused retry for the five cases rejected by the previous real GX Works2 import.
  // FX3U SFTL/SFTR shift bit-device ranges; NEG is an in-place negation.
  const rows:string[][]=[
    ["(FX3U Retry Verification Suite)"],
    ["PLC Information:","FXCPU FX3U/FX3UC"],
    ["Step No.","Line Statement","Instruction","I/O(Device)","Blank","PI Statement","Note"]
  ];
  const ins:Array<[string,string]>=[
    ["LD","M115"],["SFTL","M200 M210 K8 K1"],
    ["LD","M116"],["SFTR","M220 M230 K8 K1"],
    ["LD","M121"],["NEG","D68"],
    ["END",""]
  ];
  const q=(v:string)=>'"'+String(v).replace(/"/g,'""')+'"';
  ins.forEach(([op,dev],step)=>rows.push([String(step),"",op,dev,"","",""]));
  const text=rows.map(r=>r.map(q).join("\t")).join("\r\n")+"\r\n";
  const out=new Uint8Array(2+text.length*2);out[0]=255;out[1]=254;
  for(let j=0;j<text.length;j++){const n=text.charCodeAt(j);out[2+j*2]=n&255;out[3+j*2]=n>>8;}
  return out;
}
