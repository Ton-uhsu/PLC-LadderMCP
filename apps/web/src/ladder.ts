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
    if (coils.length !== 1) issues.push(`Network ${network.id} must contain exactly one output coil in MVP`);
    if (network.elements.at(-1)?.type !== "coil") issues.push(`Network ${network.id} must end with a coil`);
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
