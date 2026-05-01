import type { Argv } from "yargs"
import { EOL } from "os"
import { AgentStudioRoutes } from "../../server/routes/agent-studio"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import { cmd } from "./cmd"

type Artifact = {
  kind: string
  title: string
  markdownPath: string
  absoluteMarkdownPath: string
  jsonPath: string
  absoluteJsonPath: string
}

type Run = {
  sessionId: string
  sessionTitle: string
  workflowId: string
  directory: string
  prompt: string
  agentNames: string[]
  artifacts?: Artifact[]
}

type Check = {
  id: string
  label: string
  status: "ok" | "warn" | "fail"
  detail: string
}

type Acceptance = {
  workflowId: string
  sessionId: string
  ok: boolean
  generatedAt: string
  messageCount: number
  checks: Check[]
}

type Delivery = {
  sessionId: string
  workflowId: string
  workflowName: string
  version: number
  generatedAt: string
  directoryPath?: string
  absoluteDirectoryPath?: string
  markdownPath: string
  absoluteMarkdownPath: string
  manifestPath?: string
  absoluteManifestPath?: string
  fileCount?: number
  files?: {
    kind: "summary" | "manifest" | "artifact"
    label: string
    path: string
    absolutePath: string
    sourcePath?: string
    copied: boolean
  }[]
}

type WorkflowSession = {
  sessionId: string
  workflowId: string
  workflowName: string
  createdAt: string
  updatedAt: string
  artifacts?: Artifact[]
  acceptance?: Acceptance
  delivery?: Delivery
}

export type WorkflowRunResult = {
  run: Run
  acceptance?: Acceptance
  delivery?: Delivery
  ok: boolean
}

export type WorkflowExportResult = {
  session?: WorkflowSession
  acceptance?: Acceptance
  delivery?: Delivery
  ok: boolean
}

async function route<T>(input: { path: string; body?: Record<string, unknown> }) {
  const response = await AgentStudioRoutes().request(`http://railwise.test${input.path}`, {
    method: input.body ? "POST" : "GET",
    ...(input.body && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.body),
    }),
  })
  const data = (await response.json()) as unknown
  if (response.status >= 400) {
    const error = data as { error?: string }
    throw new Error(error.error ?? `workflow request failed with status ${response.status}`)
  }
  return data as T
}

function object(input?: string) {
  if (!input) return {}
  const data = JSON.parse(input) as unknown
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("--input-json must be a JSON object")
  return data as Record<string, unknown>
}

function payload(input: { input?: string[]; inputJson?: string; "--"?: string[] }) {
  const text = [...(input.input ?? []), ...(input["--"] ?? [])].join(" ").trim()
  const data = object(input.inputJson)
  const next = {
    ...(text && { prompt: text }),
    ...data,
  }
  if (!Object.keys(next).length) return undefined
  return next
}

function write(input: unknown) {
  process.stdout.write(`${JSON.stringify(input, null, 2)}${EOL}`)
}

export async function runWorkflow(input: {
  workflowId: string
  input?: Record<string, unknown>
  acceptance?: boolean
  archive?: boolean
}): Promise<WorkflowRunResult> {
  const run = await route<Run>({
    path: "/workflow/run",
    body: {
      workflowId: input.workflowId,
      ...(input.input && { input: input.input }),
    },
  })
  const acceptance =
    input.acceptance || input.archive
      ? await route<Acceptance>({
          path: "/workflow/acceptance",
          body: { workflowId: input.workflowId, sessionId: run.sessionId },
        })
      : undefined
  const delivery =
    input.archive && acceptance?.ok
      ? await route<Delivery>({
          path: "/workflow/delivery/archive",
          body: { workflowId: input.workflowId, sessionId: run.sessionId },
        })
      : undefined
  return {
    run,
    ...(acceptance && { acceptance }),
    ...(delivery && { delivery }),
    ok: acceptance?.ok ?? true,
  }
}

export async function exportWorkflow(input: { sessionId: string; workflowId?: string }): Promise<WorkflowExportResult> {
  const session = await route<WorkflowSession>({ path: `/workflow/session/${input.sessionId}` }).catch(() => undefined)
  const workflowId = input.workflowId ?? session?.workflowId
  if (!workflowId) throw new Error("--workflow is required when the session has no workflow metadata")
  const acceptance =
    session?.acceptance?.workflowId === workflowId
      ? session.acceptance
      : await route<Acceptance>({
          path: "/workflow/acceptance",
          body: { workflowId, sessionId: input.sessionId },
        })
  const delivery = acceptance.ok
    ? await route<Delivery>({
        path: "/workflow/delivery/archive",
        body: { workflowId, sessionId: input.sessionId },
      })
    : undefined
  return {
    ...(session && { session }),
    acceptance,
    ...(delivery && { delivery }),
    ok: acceptance.ok,
  }
}

const WorkflowRunCommand = cmd({
  command: "run <workflowID> [input..]",
  describe: "start a workflow preset and emit JSON for headless automation",
  builder: (yargs: Argv) =>
    yargs
      .positional("workflowID", {
        describe: "workflow preset id",
        type: "string",
        demandOption: true,
      })
      .positional("input", {
        describe: "optional workflow input text",
        type: "string",
        array: true,
        default: [],
      })
      .option("input-json", {
        describe: "workflow input as a JSON object",
        type: "string",
      })
      .option("wait", {
        alias: ["acceptance"],
        describe: "check delivery acceptance before exiting",
        type: "boolean",
        default: false,
      })
      .option("archive", {
        describe: "archive delivery package after acceptance passes",
        type: "boolean",
        default: false,
      })
      .option("dir", {
        describe: "project directory",
        type: "string",
      }),
  handler: async (args) => {
    const workflowId = args.workflowID
    if (!workflowId) throw new Error("workflowID is required")
    await bootstrap(args.dir ?? process.cwd(), async () => {
      const result = await runWorkflow({
        workflowId,
        input: payload(args),
        acceptance: Boolean(args.wait || args.archive),
        archive: Boolean(args.archive),
      })
      write(result)
      if (!result.ok) process.exitCode = 1
    })
  },
})

const WorkflowExportCommand = cmd({
  command: "export <sessionID>",
  describe: "export an accepted workflow delivery package by session id",
  builder: (yargs: Argv) =>
    yargs
      .positional("sessionID", {
        describe: "workflow session id",
        type: "string",
        demandOption: true,
      })
      .option("workflow", {
        describe: "workflow preset id, required when the session has no workflow metadata",
        type: "string",
      })
      .option("dir", {
        describe: "project directory",
        type: "string",
      }),
  handler: async (args) => {
    const sessionId = args.sessionID
    if (!sessionId) throw new Error("sessionID is required")
    await bootstrap(args.dir ?? process.cwd(), async () => {
      const result = await exportWorkflow({ sessionId, workflowId: args.workflow })
      write(result)
      if (!result.ok) process.exitCode = 1
    })
  },
})

export const WorkflowCommand = cmd({
  command: "workflow",
  describe: "run and export workflow delivery packages from CLI",
  builder: (yargs: Argv) => yargs.command(WorkflowRunCommand).command(WorkflowExportCommand).demandCommand(),
  handler: () => {
    UI.error("workflow requires a subcommand")
    process.exit(1)
  },
})
