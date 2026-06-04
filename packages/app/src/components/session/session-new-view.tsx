import { createMemo } from "solid-js"
import { DateTime } from "luxon"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { useLanguage } from "@/context/language"
import { Icon } from "@railwise/ui/icon"
import { getFilename } from "@railwise/util/path"

const MAIN_WORKTREE = "main"
const CREATE_WORKTREE = "create"
const ROOT_CLASS =
  "size-full flex flex-col justify-end items-start flex-[1_0_0] self-stretch max-w-200 mx-auto 2xl:max-w-[1000px] px-6 pb-16"

interface NewSessionViewProps {
  worktree: string
  onWorktreeChange: (value: string) => void
}

export function NewSessionView(props: NewSessionViewProps) {
  const sync = useSync()
  const sdk = useSDK()
  const language = useLanguage()

  const sandboxes = createMemo(() => sync.project?.sandboxes ?? [])
  const options = createMemo(() => [MAIN_WORKTREE, ...sandboxes(), CREATE_WORKTREE])
  const current = createMemo(() => {
    const selection = props.worktree
    if (options().includes(selection)) return selection
    return MAIN_WORKTREE
  })
  const projectRoot = createMemo(() => sync.project?.worktree ?? sdk.directory)
  const isWorktree = createMemo(() => {
    const project = sync.project
    if (!project) return false
    return sdk.directory !== project.worktree
  })
  const projectName = createMemo(() => sync.project?.name || getFilename(projectRoot()) || language.t("session.new.project.untitled"))
  const updated = createMemo(() => {
    const project = sync.project
    if (!project) return language.t("session.new.lastModified.empty")
    return (
      DateTime.fromMillis(project.time.updated ?? project.time.created)
        .setLocale(language.locale())
        .toRelative() ?? language.t("session.new.lastModified.empty")
    )
  })

  const label = (value: string) => {
    if (value === MAIN_WORKTREE) {
      if (isWorktree()) return language.t("session.new.worktree.main")
      const branch = sync.data.vcs?.branch
      if (branch) return language.t("session.new.worktree.mainWithBranch", { branch })
      return language.t("session.new.worktree.main")
    }

    if (value === CREATE_WORKTREE) return language.t("session.new.worktree.create")

    return getFilename(value)
  }

  return (
    <div class={ROOT_CLASS} data-testid="session-new-view">
      <section
        class="w-full max-w-[540px] rounded-lg border border-border-subtle bg-surface-base px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        data-testid="session-new-project-card"
      >
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-2">
            <span class="grid size-8 shrink-0 place-items-center rounded-md bg-[rgba(15,118,110,0.08)] text-[rgb(17,94,89)]">
              <Icon name="new-session" size="small" />
            </span>
            <div class="min-w-0">
              <div class="truncate text-14-medium text-text-strong" data-testid="session-new-project-name">
                {projectName()}
              </div>
              <div class="text-12-medium text-text-weak">{language.t("session.new.project.ready")}</div>
            </div>
          </div>
          <span class="shrink-0 rounded-md border border-border-subtle bg-surface-raised-base px-2 py-1 text-11-medium text-text-weak">
            {language.t("command.session.new")}
          </span>
        </div>

        <div class="grid gap-2 sm:grid-cols-3">
          <div class="rounded-md border border-border-subtle bg-background-stronger px-3 py-2">
            <div class="flex items-center gap-1.5 text-11-medium text-text-weaker">
              <Icon name="folder" size="small" />
              {language.t("session.new.project.label")}
            </div>
            <div class="mt-1 truncate text-12-medium text-text-strong">{projectName()}</div>
          </div>
          <div class="rounded-md border border-border-subtle bg-background-stronger px-3 py-2">
            <div class="flex items-center gap-1.5 text-11-medium text-text-weaker">
              <Icon name="branch" size="small" />
              {language.t("session.new.branch.label")}
            </div>
            <div class="mt-1 truncate text-12-medium text-text-strong">{label(current())}</div>
          </div>
          <div class="rounded-md border border-border-subtle bg-background-stronger px-3 py-2">
            <div class="flex items-center gap-1.5 text-11-medium text-text-weaker">
              <Icon name="pencil-line" size="small" />
              {language.t("session.new.lastModified")}
            </div>
            <div class="mt-1 truncate text-12-medium text-text-strong">{updated()}</div>
          </div>
        </div>
      </section>
    </div>
  )
}
