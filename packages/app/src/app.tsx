import "@/index.css"
import "@/styles/railwise-theme.css"
import { Code } from "@railwise/ui/code"
import { I18nProvider } from "@railwise/ui/context"
import { CodeComponentProvider } from "@railwise/ui/context/code"
import { DialogProvider } from "@railwise/ui/context/dialog"
import { DiffComponentProvider } from "@railwise/ui/context/diff"
import { MarkedProvider } from "@railwise/ui/context/marked"
import { Diff } from "@railwise/ui/diff"
import { Font } from "@railwise/ui/font"
import { ThemeProvider } from "@railwise/ui/theme"
import { MetaProvider } from "@solidjs/meta"
import { Navigate, Route, Router, useLocation } from "@solidjs/router"
import { createMemo, ErrorBoundary, type JSX, lazy, type ParentProps, Show, Suspense } from "solid-js"
import { ConnectionStatus } from "@/components/ConnectionStatus"
import { TelemetryConsent } from "@/components/telemetry-consent"
import { CommandProvider } from "@/context/command"
import { CommentsProvider } from "@/context/comments"
import { EventsProvider } from "@/context/events"
import { FileProvider } from "@/context/file"
import { GlobalSDKProvider } from "@/context/global-sdk"
import { GlobalSyncProvider } from "@/context/global-sync"
import { HighlightsProvider } from "@/context/highlights"
import { LanguageProvider, useLanguage } from "@/context/language"
import { LayoutProvider } from "@/context/layout"
import { ModelsProvider } from "@/context/models"
import { NotificationProvider } from "@/context/notification"
import { PermissionProvider } from "@/context/permission"
import { usePlatform } from "@/context/platform"
import { PromptProvider } from "@/context/prompt"
import { type ServerConnection, ServerProvider, useServer } from "@/context/server"
import { SettingsProvider } from "@/context/settings"
import { TerminalProvider } from "@/context/terminal"
import DirectoryLayout from "@/pages/directory-layout"
import Layout from "@/pages/layout"
import { ErrorPage } from "./pages/error"

const Workbench = lazy(() => import("@/pages/workbench"))
const Session = lazy(() => import("@/pages/session"))
const AgentsIndex = lazy(() => import("@/pages/agents/index"))
const AgentDetail = lazy(() => import("@/pages/agents/[name]"))
const Loading = () => <div class="size-full" />

const WorkbenchRoute = () => (
  <Suspense fallback={<Loading />}>
    <Workbench />
  </Suspense>
)

const SessionRoute = () => (
  <SessionProviders>
    <Suspense fallback={<Loading />}>
      <Session />
    </Suspense>
  </SessionProviders>
)

const SessionIndexRoute = () => <Navigate href="session" />

const AgentsIndexRoute = () => (
  <Suspense fallback={<Loading />}>
    <AgentsIndex />
  </Suspense>
)

const AgentDetailRoute = () => (
  <Suspense fallback={<Loading />}>
    <AgentDetail />
  </Suspense>
)

function UiI18nBridge(props: ParentProps) {
  const language = useLanguage()
  return <I18nProvider value={{ locale: language.locale, t: language.t }}>{props.children}</I18nProvider>
}

declare global {
  interface Window {
    __RAILWISE__?: {
      browserHarness?: boolean
      updatesEnabled?: boolean
      deepLinks?: string[]
      wsl?: boolean
    }
    __TAURI_INVOKE__?: (command: string, args?: Record<string, unknown>) => Promise<unknown>
  }
}

function MarkedProviderWithNativeParser(props: ParentProps) {
  const platform = usePlatform()
  return <MarkedProvider nativeParser={platform.parseMarkdown}>{props.children}</MarkedProvider>
}

function standaloneMatch(pattern: string, pathname: string) {
  if (!pattern.includes(":")) return pathname === pattern || pathname.startsWith(`${pattern}/`)

  const parts = pattern.split("/").filter(Boolean)
  const path = pathname.split("/").filter(Boolean)
  if (path.length < parts.length) return false
  return parts.every((part, index) => part.startsWith(":") || part === path[index])
}

function AppShellProviders(props: ParentProps<{ standalonePaths?: string[] }>) {
  const location = useLocation()
  const standalone = createMemo(
    () => props.standalonePaths?.some((path) => standaloneMatch(path, location.pathname)) ?? false,
  )

  return (
    <SettingsProvider>
      <TelemetryConsent />
      <PermissionProvider>
        <LayoutProvider>
          <EventsProvider>
            <NotificationProvider>
              <ModelsProvider>
                <CommandProvider>
                  <HighlightsProvider>
                    <Show when={!standalone()} fallback={props.children}>
                      <Layout>{props.children}</Layout>
                    </Show>
                  </HighlightsProvider>
                </CommandProvider>
              </ModelsProvider>
            </NotificationProvider>
          </EventsProvider>
        </LayoutProvider>
      </PermissionProvider>
    </SettingsProvider>
  )
}

function SessionProviders(props: ParentProps) {
  return (
    <TerminalProvider>
      <FileProvider>
        <PromptProvider>
          <CommentsProvider>{props.children}</CommentsProvider>
        </PromptProvider>
      </FileProvider>
    </TerminalProvider>
  )
}

function RouterRoot(props: ParentProps<{ appChildren?: JSX.Element; standalonePaths?: string[] }>) {
  return (
    <AppShellProviders standalonePaths={props.standalonePaths}>
      {props.appChildren}
      {props.children}
    </AppShellProviders>
  )
}

export function AppBaseProviders(props: ParentProps) {
  return (
    <MetaProvider>
      <Font />
      <ThemeProvider>
        <LanguageProvider>
          <UiI18nBridge>
            <ErrorBoundary fallback={(error) => <ErrorPage error={error} />}>
              <DialogProvider>
                <MarkedProviderWithNativeParser>
                  <DiffComponentProvider component={Diff}>
                    <CodeComponentProvider component={Code}>{props.children}</CodeComponentProvider>
                  </DiffComponentProvider>
                </MarkedProviderWithNativeParser>
              </DialogProvider>
            </ErrorBoundary>
          </UiI18nBridge>
        </LanguageProvider>
      </ThemeProvider>
    </MetaProvider>
  )
}

function ServerKey(props: ParentProps) {
  const server = useServer()
  return (
    <Show when={server.key} keyed>
      {props.children}
    </Show>
  )
}

export function AppInterface(props: {
  children?: JSX.Element
  defaultServer: ServerConnection.Key
  defaultPath?: string
  routes?: JSX.Element
  standalonePaths?: string[]
  sessionRoutes?: boolean
  workbenchRoutes?: boolean
  servers?: Array<ServerConnection.Any>
}) {
  const standalone = createMemo(() => ["/home", "/marketplace", "/harness", "/agents", ...(props.standalonePaths ?? [])])

  return (
    <ServerProvider defaultServer={props.defaultServer} servers={props.servers}>
      <ServerKey>
        <GlobalSDKProvider>
          <GlobalSyncProvider>
            <Router
              root={(routerProps) => (
                <RouterRoot appChildren={props.children} standalonePaths={standalone()}>
                  {routerProps.children}
                </RouterRoot>
              )}
            >
              <Route path="/" component={() => <Navigate href={props.defaultPath ?? "/home"} />} />
              <Route path="/home" component={WorkbenchRoute} />
              <Route path="/agents" component={AgentsIndexRoute} />
              <Route path="/agents/:name" component={AgentDetailRoute} />
              {props.routes}
              {((props.workbenchRoutes ?? true) || props.sessionRoutes) && (
                <>
                  <Route path="/:dir" component={DirectoryLayout}>
                    <Route path="/" component={SessionIndexRoute} />
                    <Route path="/session/:id?" component={SessionRoute} />
                  </Route>
                </>
              )}
            </Router>
            <ConnectionStatus />
          </GlobalSyncProvider>
        </GlobalSDKProvider>
      </ServerKey>
    </ServerProvider>
  )
}
