import { Tool } from "./tool"
import { errorMessage } from "../util/error"
import z from "zod"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"
import { Identifier } from "../id/id"
import { Agent } from "../agent/agent"
import { SessionPrompt } from "../session/prompt"
import { iife } from "@/util/iife"
import { defer } from "@/util/defer"
import { Config } from "../config/config"
import { PermissionNext } from "@/permission/next"

const MAX_PARALLEL = 10

const parameters = z.object({
  tasks: z
    .array(
      z.object({
        description: z.string().describe("Short description (3-5 words) of this subtask"),
        prompt: z.string().describe("Detailed task instructions for the subagent"),
        subagent_type: z.string().describe("Which specialized agent to use for this subtask"),
      }),
    )
    .min(1)
    .max(MAX_PARALLEL)
    .describe(`Array of subtasks to execute in parallel (max ${MAX_PARALLEL})`),
})

const description = `Launch multiple agents in parallel to execute independent subtasks simultaneously.

This tool is designed for situations where multiple subtasks are independent and can run concurrently. Use this instead of multiple sequential task calls when:
- Subtasks operate on different data/files (no shared state)
- Subtasks use different expert agents (e.g., one data analyst, one technical writer)
- Maximum parallelism is needed for performance

Available agents:
- solution_architect: Technical solution design and instrument selection
- data_analyst: Data adjustment calculation and trend analysis
- technical_writer: Report writing and formatting
- qa_reviewer: Specification compliance final review
- commercial_specialist: Commercial bidding and contract review
- qa_inspector: Field data first inspection and closure check
- ppt_master: Presentation design and PPT generation

Usage notes:
1. All subtasks execute in parallel — independence is required
2. Results are collected and returned as a structured summary
3. Each subtask gets its own task_id for potential continuation
4. If any subtask fails, others continue; failed tasks are marked in output
5. Aborting this tool cancels all running subtasks`

export const ParallelAgentTool = Tool.define("parallel_agent", async (ctx) => {
  const agents = await Agent.list().then((x) => x.filter((a) => a.mode !== "primary"))

  // Build agent description string for the main description
  const agentList = agents
    .map((a) => `- ${a.name}: ${a.description ?? "No description"}`)
    .join("\n")

  return {
    description: description.replace("Available agents:", `Available agents:\n${agentList}\n\nThis tool accepts these agents too:`),
    parameters,
    formatValidationError(error) {
      const formattedErrors = error.issues
        .map((issue) => {
          const path = issue.path.length > 0 ? issue.path.join(".") : "root"
          return `  - ${path}: ${issue.message}`
        })
        .join("\n")
      return `Invalid parameters for parallel_agent:\n${formattedErrors}\n\nExpected: { "tasks": [{ "description": "...", "prompt": "...", "subagent_type": "..." }, ...] }`
    },
    async execute(params: z.infer<typeof parameters>, ctx) {
      const config = await Config.get()

      // Permission check
      if (!ctx.extra?.bypassAgentCheck) {
        await ctx.ask({
          permission: "task",
          patterns: params.tasks.map((t) => t.subagent_type),
          always: ["*"],
          metadata: {
            description: `parallel_agent: ${params.tasks.length} subtasks`,
            subtask_count: params.tasks.length,
          },
        })
      }

      const msg = await MessageV2.get({ sessionID: ctx.sessionID, messageID: ctx.messageID })
      if (msg.info.role !== "assistant") {
        throw new Error("Not an assistant message")
      }
      const info = msg.info

      // Helper: create and run a single subtask
      async function runSubtask(
        subtask: (typeof params.tasks)[0],
        index: number,
      ): Promise<{
        index: number
        description: string
        subagent_type: string
        task_id: string
        success: boolean
        output: string
        error?: string
      }> {
        const agent = await Agent.get(subtask.subagent_type).catch(() => null)
        if (!agent) {
          return {
            index,
            description: subtask.description,
            subagent_type: subtask.subagent_type,
            task_id: "",
            success: false,
            output: "",
            error: `Unknown agent type: ${subtask.subagent_type}`,
          }
        }

        const hasTaskPermission = agent.permission.some((rule) => rule.permission === "task")

        const session = await Session.create({
          parentID: ctx.sessionID,
          title: `[${index + 1}] ${subtask.description} (@${agent.name})`,
          permission: [
            { permission: "todowrite", pattern: "*", action: "deny" },
            { permission: "todoread", pattern: "*", action: "deny" },
            ...(hasTaskPermission
              ? []
              : [{ permission: "task" as const, pattern: "*" as const, action: "deny" as const }]),
            ...(config.experimental?.primary_tools?.map((t) => ({
              pattern: "*",
              action: "allow" as const,
              permission: t,
            })) ?? []),
          ],
        })

        const model = agent.model ?? {
          modelID: info.modelID,
          providerID: info.providerID,
        }

        const messageID = Identifier.ascending("message")

        const abortHandler = () => SessionPrompt.cancel(session.id)
        ctx.abort.addEventListener("abort", abortHandler)
        using _ = defer(() => ctx.abort.removeEventListener("abort", abortHandler))

        try {
          const promptParts = await SessionPrompt.resolvePromptParts(subtask.prompt)

          const result = await SessionPrompt.prompt({
            messageID,
            sessionID: session.id,
            model: {
              modelID: model.modelID,
              providerID: model.providerID,
            },
            agent: agent.name,
            tools: {
              todowrite: false,
              todoread: false,
              ...(hasTaskPermission ? {} : { task: false }),
              ...Object.fromEntries((config.experimental?.primary_tools ?? []).map((t) => [t, false])),
            },
            parts: promptParts,
          })

          const text = result.parts.findLast((x) => x.type === "text")?.text ?? ""

          return {
            index,
            description: subtask.description,
            subagent_type: subtask.subagent_type,
            task_id: session.id,
            success: true,
            output: text,
          }
        } catch (error) {
          return {
            index,
            description: subtask.description,
            subagent_type: subtask.subagent_type,
            task_id: session.id,
            success: false,
            output: "",
            error: errorMessage(error),
          }
        }
      }

      // Execute all subtasks in parallel
      const results = await Promise.all(params.tasks.map((task, i) => runSubtask(task, i)))

      // Build structured output
      const successful = results.filter((r) => r.success)
      const failed = results.filter((r) => !r.success)

      const lines: string[] = [
        `## Parallel Agent Results (${successful.length}/${params.tasks.length} succeeded)`,
        "",
      ]

      for (const r of results) {
        lines.push(`### [${r.index + 1}] ${r.description} (${r.subagent_type})`)
        lines.push(`- task_id: \`${r.task_id}\``)
        lines.push(`- status: ${r.success ? "✅ success" : "❌ failed"}`)
        if (r.success) {
          const preview = r.output.slice(0, 500)
          lines.push(`- output:\n\`\`\`\n${preview}${r.output.length > 500 ? "\n... (truncated)" : ""}\n\`\`\``)
        } else {
          lines.push(`- error: ${r.error}`)
        }
        lines.push("")
      }

      if (failed.length > 0) {
        lines.push(`⚠️  ${failed.length} subtask(s) failed. See details above.`)
      }

      return {
        title: `Parallel execution (${successful.length}/${params.tasks.length} succeeded)`,
        metadata: {
          totalTasks: params.tasks.length,
          successful: successful.length,
          failed: failed.length,
          task_ids: results.map((r) => ({ description: r.description, task_id: r.task_id, success: r.success })),
        },
        output: lines.join("\n"),
      }
    },
  }
})
