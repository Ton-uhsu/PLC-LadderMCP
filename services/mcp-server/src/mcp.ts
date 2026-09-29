import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { addCoil, addContact, createProject, exportGxWorks2Text, exportSamSoar, getProject, validateProject } from "./project.js";

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

export function createMcpServer() {
  const server = new McpServer({ name: "plc-ladder-mcp", version: "0.1.0" });

  server.tool("create_project", "Create/reset the current Ladder project.", {
    name: z.string().min(1),
    plc_family: z.string().default("Mitsubishi FX"),
    plc_model: z.string().default("FX3U"),
  }, async ({ name, plc_family, plc_model }) => json(createProject(name, plc_family, plc_model)));

  server.tool("get_project", "Return the canonical Ladder IR for the current project.", {},
    async () => json(getProject()));

  server.tool("add_contact", "Add a NO/NC contact before the output coil.", {
    device: z.string(),
    mode: z.enum(["NO", "NC"]).default("NO"),
    network_id: z.number().int().nonnegative().default(0),
  }, async ({ device, mode, network_id }) =>
    json({ added: addContact(device, mode, network_id), project: getProject() }));

  server.tool("add_coil", "Add an output coil.", {
    device: z.string(),
    network_id: z.number().int().nonnegative().default(0),
  }, async ({ device, network_id }) =>
    json({ added: addCoil(device, network_id), project: getProject() }));

  server.tool("validate_project", "Validate Ladder IR and MVP topology rules.", {},
    async () => json(validateProject()));

  server.tool("export_project", "Compile the project to a supported PLC IDE interchange format.", {
    target: z.enum(["samsoar2022", "gxworks2"]),
  }, async ({ target }) => target === "gxworks2" ? json({
    target,
    filename: "plc-ladder-gxworks2.csv",
    encoding: "UTF-16 LE with BOM required at file boundary",
    content: exportGxWorks2Text(),
  }) : json({
    target,
    filename: "plc-ladder-samsoar.csv",
    encoding: "UTF-8 with BOM",
    content: exportSamSoar(),
  }));

  return server;
}
