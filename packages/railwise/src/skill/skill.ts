import z from "zod"
import path from "path"
import os from "os"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import { NamedError } from "@railwise/util/error"
import { ConfigMarkdown } from "../config/markdown"
import { Log } from "../util/log"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { Flag } from "@/flag/flag"
import { Bus } from "@/bus"
import { Discovery } from "./discovery"
import { Glob } from "../util/glob"
import { BusEvent } from "@/bus/bus-event"

export namespace Skill {
  const log = Log.create({ service: "skill" })
  const Error = BusEvent.define(
    "session.error",
    z.object({
      sessionID: z.string().optional(),
      error: z.unknown(),
    }),
  )

  export const Info = z.object({
    name: z.string(),
    description: z.string(),
    location: z.string(),
    content: z.string(),
  })
  export type Info = z.infer<typeof Info>

  export const InvalidError = NamedError.create(
    "SkillInvalidError",
    z.object({
      path: z.string(),
      message: z.string().optional(),
      issues: z.custom<z.core.$ZodIssue[]>().optional(),
    }),
  )

  export const NameMismatchError = NamedError.create(
    "SkillNameMismatchError",
    z.object({
      path: z.string(),
      expected: z.string(),
      actual: z.string(),
    }),
  )

  // External skill directories to search for (project-level and global)
  // These follow the directory layout used by Claude Code and other agents.
  const EXTERNAL_DIRS = [".claude", ".agents"]
  const EXTERNAL_SKILL_PATTERN = "skills/**/SKILL.md"
  const RAILWISE_SKILL_PATTERN = "{skill,skills}/**/SKILL.md"
  const SKILL_PATTERN = "**/SKILL.md"
  const BUILTIN_DIRS = [
    process.env.RAILWISE_BUILTIN_SKILL_DIR,
    path.join(import.meta.dirname, "../../skill"),
    path.join(path.dirname(process.execPath), "skill"),
    path.join(path.dirname(process.execPath), "..", "share", "railwise", "skill"),
  ].filter((item): item is string => !!item)

  function disabled() {
    const value = process.env.RAILWISE_DISABLE_BUILTIN_SKILLS?.toLowerCase()
    return value === "true" || value === "1"
  }

  export const state = Instance.state(async () => {
    const skills: Record<string, Info> = {}
    const dirs = new Set<string>()
    const duplicates: Array<{ name: string; existing: string; duplicate: string }> = []

    const addSkill = async (match: string) => {
      const md = await ConfigMarkdown.parse(match).catch((err) => {
        const message = ConfigMarkdown.FrontmatterError.isInstance(err)
          ? err.data.message
          : `Failed to parse skill ${match}`
        Bus.publish(Error, { error: new NamedError.Unknown({ message }).toObject() })
        log.error("failed to load skill", { skill: match, err })
        return undefined
      })

      if (!md) return

      const parsed = Info.pick({ name: true, description: true }).safeParse(md.data)
      if (!parsed.success) return

      if (skills[parsed.data.name]) {
        duplicates.push({
          name: parsed.data.name,
          existing: skills[parsed.data.name].location,
          duplicate: match,
        })
      }

      dirs.add(path.dirname(match))

      skills[parsed.data.name] = {
        name: parsed.data.name,
        description: parsed.data.description,
        location: match,
        content: md.content,
      }
    }

    const scan = async (root: string, pattern: string, scope: "builtin" | "global" | "project" | "config") => {
      return Glob.scan(pattern, {
        cwd: root,
        absolute: true,
        include: "file",
        dot: true,
        symlink: true,
      })
        .then((matches) => Promise.all(matches.map(addSkill)))
        .catch((error) => {
          log.error(`failed to scan ${scope} skills`, { dir: root, error })
        })
    }

    // Built-in RAILWISE business skills are loaded first so user/project skills can override them by name.
    if (!disabled()) {
      for (const root of [...new Set(BUILTIN_DIRS.map((item) => path.resolve(item)))]) {
        if (!(await Filesystem.isDir(root))) continue
        await scan(root, SKILL_PATTERN, "builtin")
      }
    }

    // Scan external skill directories (.claude/skills/, .agents/skills/, etc.)
    // Load global (home) first, then project-level (so project-level overwrites)
    if (!Flag.RAILWISE_DISABLE_EXTERNAL_SKILLS) {
      for (const dir of EXTERNAL_DIRS) {
        const root = path.join(Global.Path.home, dir)
        if (!(await Filesystem.isDir(root))) continue
        await scan(root, EXTERNAL_SKILL_PATTERN, "global")
      }

      for await (const root of Filesystem.up({
        targets: EXTERNAL_DIRS,
        start: Instance.directory,
        stop: Instance.worktree,
      })) {
        await scan(root, EXTERNAL_SKILL_PATTERN, "project")
      }
    }

    // Scan .railwise/skill/ directories
    for (const dir of await Config.directories()) {
      const matches = await Glob.scan(RAILWISE_SKILL_PATTERN, {
        cwd: dir,
        absolute: true,
        include: "file",
        symlink: true,
      })
      for (const match of matches) {
        await addSkill(match)
      }
    }

    // Scan additional skill paths from config
    const config = await Config.get()
    for (const skillPath of config.skills?.paths ?? []) {
      const expanded = skillPath.startsWith("~/") ? path.join(os.homedir(), skillPath.slice(2)) : skillPath
      const resolved = path.isAbsolute(expanded) ? expanded : path.join(Instance.directory, expanded)
      if (!(await Filesystem.isDir(resolved))) {
        log.warn("skill path not found", { path: resolved })
        continue
      }
      const matches = await Glob.scan(SKILL_PATTERN, {
        cwd: resolved,
        absolute: true,
        include: "file",
        symlink: true,
      })
      for (const match of matches) {
        await addSkill(match)
      }
    }

    // Download and load skills from URLs
    for (const url of config.skills?.urls ?? []) {
      const list = await Discovery.pull(url)
      for (const dir of list) {
        dirs.add(dir)
        const matches = await Glob.scan(SKILL_PATTERN, {
          cwd: dir,
          absolute: true,
          include: "file",
          symlink: true,
        })
        for (const match of matches) {
          await addSkill(match)
        }
      }
    }

    if (duplicates.length > 0) {
      log.debug("duplicate skill names resolved by override", {
        count: duplicates.length,
        sample: duplicates.slice(0, 20),
      })
    }

    return {
      skills,
      dirs: Array.from(dirs),
    }
  })

  export async function get(name: string) {
    return state().then((x) => x.skills[name])
  }

  export async function all() {
    return state().then((x) => Object.values(x.skills))
  }

  export async function dirs() {
    return state().then((x) => x.dirs)
  }
}
