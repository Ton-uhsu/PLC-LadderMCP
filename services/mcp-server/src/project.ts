import { z } from "zod";

export const ElementSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("contact"),
    mode: z.enum(["NO", "NC"]),
    device: z.string().regex(/^[A-Z]+\d+$/),
  }),
  z.object({
    id: z.string(),
    type: z.literal("coil"),
    device: z.string().regex(/^[A-Z]+\d+$/),
  }),
]);

export const ProjectSchema = z.object({
  version: z.literal("0.1"),
  name: z.string().min(1),
  plc: z.object({ family: z.string().min(1), model: z.string().min(1) }),
  programs: z.array(z.object({
    name: z.string().min(1),
    networks: z.array(z.object({
      id: z.number().int().nonnegative(),
      elements: z.array(ElementSchema),
    })),
  })).min(1),
});

export type LadderProject = z.infer<typeof ProjectSchema>;

let project: LadderProject = createProject("Untitled PLC Project", "Mitsubishi FX", "FX3U");

export function createProject(name: string, family: string, model: string): LadderProject {
  project = {
    version: "0.1",
    name,
    plc: { family, model },
    programs: [{ name: "Main", networks: [{ id: 0, elements: [] }] }],
  };
  return project;
}

export function getProject() { return project; }

export function addContact(device: string, mode: "NO" | "NC", networkId = 0) {
  const network = requireNetwork(networkId);
  const element = { id: crypto.randomUUID(), type: "contact" as const, mode, device: normalizeDevice(device) };
  const coilIndex = network.elements.findIndex(e => e.type === "coil");
  if (coilIndex >= 0) network.elements.splice(coilIndex, 0, element);
  else network.elements.push(element);
  return element;
}

export function addCoil(device: string, networkId = 0) {
  const network = requireNetwork(networkId);
  if (network.elements.some(e => e.type === "coil")) throw new Error(`Network ${networkId} already has an output coil in MVP`);
  const element = { id: crypto.randomUUID(), type: "coil" as const, device: normalizeDevice(device) };
  network.elements.push(element);
  return element;
}

export function validateProject() {
  const schema = ProjectSchema.safeParse(project);
  const issues: string[] = [];
  if (!schema.success) issues.push(...schema.error.issues.map(i => `${i.path.join(".")}: ${i.message}`));
  for (const program of project.programs) for (const network of program.networks) {
    const coils = network.elements.filter(e => e.type === "coil");
    if (coils.length !== 1) issues.push(`Network ${network.id} must contain exactly one output coil in MVP`);
    if (network.elements.length && network.elements.at(-1)?.type !== "coil") issues.push(`Network ${network.id} must end with a coil`);
  }
  return { valid: issues.length === 0, issues };
}

export function exportSamSoar() {
  const validation = validateProject();
  if (!validation.valid) throw new Error(validation.issues.join("; "));
  const lines: string[] = [];
  for (const program of project.programs) {
    lines.push(`Program,${program.name}`);
    for (const network of program.networks) {
      lines.push(`Network,${network.id}`);
      for (const element of network.elements) {
        if (element.type === "contact") lines.push(`${element.mode === "NO" ? "LD" : "LDI"},${element.device}`);
        else lines.push(`OUT,${element.device}`);
      }
      lines.push("POP");
    }
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

function requireNetwork(id: number) {
  const network = project.programs[0].networks.find(n => n.id === id);
  if (!network) throw new Error(`Network ${id} not found`);
  return network;
}

function normalizeDevice(device: string) {
  const value = device.trim().toUpperCase();
  if (!/^[A-Z]+\d+$/.test(value)) throw new Error(`Invalid PLC device: ${device}`);
  return value.replace(/^([A-Z]+)0+(\d+)$/, "$1$2");
}
