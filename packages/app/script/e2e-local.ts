import fs from "node:fs/promises"
import net from "node:net"
import os from "node:os"
import path from "node:path"

async function freePort() {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.listen(0, () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to acquire a free port")))
        return
      }
      server.close((err) => {
        if (err) {
          reject(err)
          return
        }
        resolve(address.port)
      })
    })
  })
}

async function waitForHealth(url: string) {
  const timeout = Date.now() + 120_000
  const errors: string[] = []
  while (Date.now() < timeout) {
    const result = await fetch(url)
      .then((r) => ({ ok: r.ok, error: undefined }))
      .catch((error) => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }))
    if (result.ok) return
    if (result.error) errors.push(result.error)
    await new Promise((r) => setTimeout(r, 250))
  }
  const last = errors.length ? ` (last error: ${errors[errors.length - 1]})` : ""
  throw new Error(`Timed out waiting for server health: ${url}${last}`)
}

const appDir = process.cwd()
const repoDir = path.resolve(appDir, "../..")
const railwiseDir = path.join(repoDir, "packages", "railwise")
const models = path.join(railwiseDir, "test", "tool", "fixtures", "models-api.json")

async function body(req: Request) {
  return await req.json().catch(() => ({}))
}

function strings(input: unknown): string[] {
  if (typeof input === "string") return [input]
  if (Array.isArray(input)) return input.flatMap(strings)
  if (!input || typeof input !== "object") return []
  return Object.values(input).flatMap(strings)
}

function messages(input: unknown): unknown[] | undefined {
  if (!input || typeof input !== "object") return
  if ("messages" in input && Array.isArray(input.messages)) return input.messages
  for (const value of Object.values(input)) {
    const result = messages(value)
    if (result) return result
  }
}

function user(input: unknown) {
  const list = messages(input)
  if (!list) return strings(input).join("\n")
  const last = list.findLast((item) => !!item && typeof item === "object" && "role" in item && item.role === "user")
  return strings(last).join("\n")
}

function text(input: unknown) {
  return JSON.stringify(input).match(/E2E_(?:OK|ASYNC)_\d+/)?.[0] ?? "E2E mock response"
}

function json(input: string) {
  return JSON.parse(input.slice(input.indexOf("Use this JSON input: ") + "Use this JSON input: ".length).split("\n")[0])
}

function call(input: unknown) {
  const last = messages(input)?.at(-1)
  if (last && typeof last === "object" && "role" in last && last.role === "tool") return
  const prompt = user(input)
  if (prompt.includes("one question tool call")) return { name: "question", args: json(prompt) }
  if (prompt.includes("one bash tool call")) return { name: "bash", args: json(prompt) }
  if (prompt.includes("one todowrite tool call")) return { name: "todowrite", args: json(prompt) }
}

function stream(events: unknown[]) {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n", {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  })
}

async function mock(req: Request) {
  const url = new URL(req.url)
  if (url.pathname.endsWith("/chat/completions")) {
    const json = await body(req)
    const output = text(json)
    const tool = call(json)
    const id = `chatcmpl-${Date.now()}`
    const model = typeof json.model === "string" ? json.model : "e2e"
    if (json.stream === false) {
      return Response.json({
        id,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, message: { role: "assistant", content: output }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })
    }
    return stream([
      {
        id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
      },
      ...(tool
        ? [
            {
              id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [
                {
                  index: 0,
                  delta: {
                    tool_calls: [
                      {
                        index: 0,
                        id: `call_${Date.now()}`,
                        type: "function",
                        function: {
                          name: tool.name,
                          arguments: JSON.stringify(tool.args),
                        },
                      },
                    ],
                  },
                  finish_reason: null,
                },
              ],
            },
            {
              id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            },
          ]
        : [
            {
              id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{ index: 0, delta: { content: output }, finish_reason: null }],
            },
            {
              id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            },
          ]),
    ])
  }
  if (url.pathname.endsWith("/responses")) {
    const json = await body(req)
    const output = text(json)
    const id = `resp_${Date.now()}`
    const item = `msg_${Date.now()}`
    const model = typeof json.model === "string" ? json.model : "e2e"
    if (json.stream === false) {
      return Response.json({
        id,
        object: "response",
        created_at: Math.floor(Date.now() / 1000),
        status: "completed",
        model,
        output: [
          {
            id: item,
            type: "message",
            status: "completed",
            role: "assistant",
            content: [{ type: "output_text", text: output, annotations: [] }],
          },
        ],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      })
    }
    return stream([
      {
        type: "response.created",
        response: {
          id,
          object: "response",
          created_at: Math.floor(Date.now() / 1000),
          status: "in_progress",
          model,
          output: [],
        },
      },
      {
        type: "response.output_item.added",
        output_index: 0,
        item: { id: item, type: "message", status: "in_progress", role: "assistant", content: [] },
      },
      {
        type: "response.content_part.added",
        item_id: item,
        output_index: 0,
        content_index: 0,
        part: { type: "output_text", text: "", annotations: [] },
      },
      { type: "response.output_text.delta", item_id: item, output_index: 0, content_index: 0, delta: output },
      { type: "response.output_text.done", item_id: item, output_index: 0, content_index: 0, text: output },
      {
        type: "response.content_part.done",
        item_id: item,
        output_index: 0,
        content_index: 0,
        part: { type: "output_text", text: output, annotations: [] },
      },
      {
        type: "response.output_item.done",
        output_index: 0,
        item: {
          id: item,
          type: "message",
          status: "completed",
          role: "assistant",
          content: [{ type: "output_text", text: output, annotations: [] }],
        },
      },
      {
        type: "response.completed",
        response: {
          id,
          object: "response",
          created_at: Math.floor(Date.now() / 1000),
          status: "completed",
          model,
          output: [
            {
              id: item,
              type: "message",
              status: "completed",
              role: "assistant",
              content: [{ type: "output_text", text: output, annotations: [] }],
            },
          ],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        },
      },
    ])
  }
  return new Response("not found", { status: 404 })
}

const extraArgs = (() => {
  const args = process.argv.slice(2)
  if (args[0] === "--") return args.slice(1)
  return args
})()

const [serverPort, webPort, modelPort] = await Promise.all([freePort(), freePort(), freePort()])
const modelUrl = `http://127.0.0.1:${modelPort}/v1`
const catalog = await fs
  .readFile(models, "utf8")
  .then((data) => JSON.parse(data) as { railwise?: { models?: Record<string, unknown> } })
const modelOverrides = Object.fromEntries(
  Object.keys(catalog.railwise?.models ?? {}).map((model) => [
    model,
    { provider: { npm: "@ai-sdk/openai-compatible" } },
  ]),
)

const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "railwise-e2e-"))
const keepSandbox = process.env.RAILWISE_E2E_KEEP_SANDBOX === "1"

const serverEnv = {
  ...process.env,
  RAILWISE_CONFIG_CONTENT: JSON.stringify({
    enabled_providers: ["railwise"],
    disabled_providers: ["kilo"],
    permission: { todowrite: "allow" },
    provider: {
      railwise: {
        options: { apiKey: "e2e", baseURL: modelUrl },
        models: modelOverrides,
      },
    },
  }),
  RAILWISE_DISABLE_SHARE: process.env.RAILWISE_DISABLE_SHARE ?? "true",
  RAILWISE_DISABLE_LSP_DOWNLOAD: "true",
  RAILWISE_DISABLE_DEFAULT_PLUGINS: "true",
  RAILWISE_DISABLE_MODELS_FETCH: "true",
  RAILWISE_EXPERIMENTAL_DISABLE_FILEWATCHER: "true",
  RAILWISE_MODELS_PATH: models,
  RAILWISE_TEST_HOME: path.join(sandbox, "home"),
  XDG_DATA_HOME: path.join(sandbox, "share"),
  XDG_CACHE_HOME: path.join(sandbox, "cache"),
  XDG_CONFIG_HOME: path.join(sandbox, "config"),
  XDG_STATE_HOME: path.join(sandbox, "state"),
  RAILWISE_E2E_PROJECT_DIR: repoDir,
  RAILWISE_E2E_SESSION_TITLE: "E2E Session",
  RAILWISE_E2E_MESSAGE: "Seeded for UI e2e",
  RAILWISE_E2E_MODEL: "railwise/gpt-5-nano",
  RAILWISE_CLIENT: "app",
} satisfies Record<string, string>

const runnerEnv = {
  ...serverEnv,
  PLAYWRIGHT_SERVER_HOST: "127.0.0.1",
  PLAYWRIGHT_SERVER_PORT: String(serverPort),
  VITE_RAILWISE_SERVER_HOST: "127.0.0.1",
  VITE_RAILWISE_SERVER_PORT: String(serverPort),
  PLAYWRIGHT_PORT: String(webPort),
} satisfies Record<string, string>

let seed: ReturnType<typeof Bun.spawn> | undefined
let runner: ReturnType<typeof Bun.spawn> | undefined
let llm: ReturnType<typeof Bun.serve> | undefined
let server: { stop: () => Promise<void> | void } | undefined
let inst: { Instance: { disposeAll: () => Promise<void> | void } } | undefined
let cleaned = false

const cleanup = async () => {
  if (cleaned) return
  cleaned = true

  if (seed && seed.exitCode === null) seed.kill("SIGTERM")
  if (runner && runner.exitCode === null) runner.kill("SIGTERM")
  llm?.stop(true)

  const jobs = [
    inst?.Instance.disposeAll(),
    server?.stop(),
    keepSandbox ? undefined : fs.rm(sandbox, { recursive: true, force: true }),
  ].filter(Boolean)
  await Promise.allSettled(jobs)
}

const shutdown = (code: number, reason: string) => {
  process.exitCode = code
  void cleanup().finally(() => {
    console.error(`e2e-local shutdown: ${reason}`)
    process.exit(code)
  })
}

const reportInternalError = (reason: string, error: unknown) => {
  console.warn(`e2e-local ignored server error: ${reason}`)
  console.warn(error)
}

process.once("SIGINT", () => shutdown(130, "SIGINT"))
process.once("SIGTERM", () => shutdown(143, "SIGTERM"))
process.once("SIGHUP", () => shutdown(129, "SIGHUP"))
process.once("uncaughtException", (error) => {
  reportInternalError("uncaughtException", error)
})
process.once("unhandledRejection", (error) => {
  reportInternalError("unhandledRejection", error)
})

let code = 1

try {
  llm = Bun.serve({ port: modelPort, hostname: "127.0.0.1", fetch: mock })

  seed = Bun.spawn(["bun", "script/seed-e2e.ts"], {
    cwd: railwiseDir,
    env: serverEnv,
    stdout: "inherit",
    stderr: "inherit",
  })

  const seedExit = await seed.exited
  if (seedExit !== 0) {
    code = seedExit
  } else {
    Object.assign(process.env, serverEnv)
    process.env.AGENT = "1"
    process.env.RAILWISE = "1"

    const log = await import("../../railwise/src/util/log")
    const install = await import("../../railwise/src/installation")
    await log.Log.init({
      print: true,
      dev: install.Installation.isLocal(),
      level: "WARN",
    })

    const servermod = await import("../../railwise/src/server/server")
    inst = await import("../../railwise/src/project/instance")
    server = servermod.Server.listen({ port: serverPort, hostname: "127.0.0.1" })
    console.log(`railwise server listening on http://127.0.0.1:${serverPort}`)

    await waitForHealth(`http://127.0.0.1:${serverPort}/global/health`)
    runner = Bun.spawn(["bun", "test:e2e", ...extraArgs], {
      cwd: appDir,
      env: runnerEnv,
      stdout: "inherit",
      stderr: "inherit",
    })
    code = await runner.exited
  }
} catch (error) {
  console.error(error)
  code = 1
} finally {
  await cleanup()
}

process.exit(code)
