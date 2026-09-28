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
