import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu"
import { type as ostype } from "@tauri-apps/plugin-os"
import { relaunch } from "@tauri-apps/plugin-process"
import { openUrl } from "@tauri-apps/plugin-opener"

import { runUpdater, UPDATER_ENABLED } from "./updater"
import { installCli } from "./cli"
import { initI18n, t } from "./i18n"
import { commands } from "./bindings"

const FEEDBACK_URL = "https://github.com/railwise-cn/RAILWISE-CLI/issues/new?template=feature_request.yml"
const BUG_URL = "https://github.com/railwise-cn/RAILWISE-CLI/issues/new?template=bug_report.yml"
const DOCS_URL = "https://railwise.ai/docs"
const FORUM_URL = "https://discord.com/invite/railwise"

export async function createMenu(trigger: (id: string) => void) {
  if (ostype() !== "macos") return

  await initI18n()

  const menu = await Menu.new({
    items: [
      await Submenu.new({
        text: t("desktop.menu.app"),
        items: [
          await PredefinedMenuItem.new({
            item: { About: null },
          }),
          await MenuItem.new({
            enabled: UPDATER_ENABLED,
            action: () => runUpdater({ alertOnFail: true }),
            text: t("desktop.menu.checkForUpdates"),
          }),
          await MenuItem.new({
            action: () => installCli(),
            text: t("desktop.menu.installCli"),
          }),
          await MenuItem.new({
            action: async () => window.location.reload(),
            text: t("desktop.menu.reloadWebview"),
          }),
          await MenuItem.new({
            action: async () => {
              await commands.killSidecar().catch(() => undefined)
              await relaunch().catch(() => undefined)
            },
            text: t("desktop.menu.restart"),
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Hide" }),
          await PredefinedMenuItem.new({ item: "HideOthers" }),
          await PredefinedMenuItem.new({ item: "ShowAll" }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Quit" }),
        ].filter(Boolean),
      }),
      await Submenu.new({
        text: t("desktop.menu.file"),
        items: [
          await MenuItem.new({
            text: t("desktop.menu.newSession"),
            accelerator: "Shift+Cmd+S",
            action: () => trigger("session.new"),
          }),
          await MenuItem.new({
            text: t("desktop.menu.openProject"),
            accelerator: "Cmd+O",
            action: () => trigger("project.open"),
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "CloseWindow" }),
        ],
      }),
      await Submenu.new({
        text: t("desktop.menu.edit"),
        items: [
          await PredefinedMenuItem.new({ item: "Undo" }),
          await PredefinedMenuItem.new({ item: "Redo" }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await PredefinedMenuItem.new({ item: "Cut" }),
          await PredefinedMenuItem.new({ item: "Copy" }),
          await PredefinedMenuItem.new({ item: "Paste" }),
          await PredefinedMenuItem.new({ item: "SelectAll" }),
        ],
      }),
      await Submenu.new({
        text: t("desktop.menu.view"),
        items: [
          await MenuItem.new({
            action: () => trigger("sidebar.toggle"),
            text: t("desktop.menu.toggleSidebar"),
            accelerator: "Cmd+B",
          }),
          await MenuItem.new({
            action: () => trigger("terminal.toggle"),
            text: t("desktop.menu.toggleTerminal"),
            accelerator: "Ctrl+`",
          }),
          await MenuItem.new({
            action: () => trigger("fileTree.toggle"),
            text: t("desktop.menu.toggleFileTree"),
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await MenuItem.new({
            action: () => trigger("common.goBack"),
            text: t("desktop.menu.back"),
          }),
          await MenuItem.new({
            action: () => trigger("common.goForward"),
            text: t("desktop.menu.forward"),
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await MenuItem.new({
            action: () => trigger("session.previous"),
            text: t("desktop.menu.previousSession"),
            accelerator: "Option+ArrowUp",
          }),
          await MenuItem.new({
            action: () => trigger("session.next"),
            text: t("desktop.menu.nextSession"),
            accelerator: "Option+ArrowDown",
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
        ],
      }),
      await Submenu.new({
        text: t("desktop.menu.help"),
        items: [
          await MenuItem.new({
            action: () => openUrl(DOCS_URL),
            text: t("desktop.menu.documentation"),
          }),
          await MenuItem.new({
            action: () => openUrl(FORUM_URL),
            text: t("desktop.menu.supportForum"),
          }),
          await PredefinedMenuItem.new({ item: "Separator" }),
          await MenuItem.new({
            action: () => openUrl(FEEDBACK_URL),
            text: t("desktop.menu.shareFeedback"),
          }),
          await MenuItem.new({
            action: () => openUrl(BUG_URL),
            text: t("desktop.menu.reportBug"),
          }),
        ],
      }),
    ],
  })
  menu.setAsAppMenu()
}
