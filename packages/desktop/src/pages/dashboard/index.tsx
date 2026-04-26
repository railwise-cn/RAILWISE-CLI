import "./dashboard.css"
import { A } from "@solidjs/router"
import { Icon } from "@railwise/ui/icon"
import { base64Encode } from "@railwise/util/encode"
import { createMemo, For, Show } from "solid-js"
import { VList } from "virtua/solid"
import { ActiveAgents } from "../../components/dashboard/active-agents"
import { AlertFeed } from "../../components/dashboard/alert-feed"
import { MonitorMap } from "../../components/dashboard/monitor-map"
import { ProjectCard } from "../../components/dashboard/project-card"
import { ProjectList } from "../../components/dashboard/project-list"
import { SettlementChart } from "../../components/dashboard/settlement-chart"
import { useDashboard } from "./use-dashboard"

export default function DashboardPage() {
  const db = useDashboard()
  const active = createMemo(() => db.projects.find((project) => project.status === "active") ?? db.projects[0])

  return (
    <main class="rw-dashboard" data-testid="dashboard-container">
      <aside class="rw-col-left">
        <ProjectList projects={db.projects} loading={db.loading} />
        <div class="dashboard-shortcuts dashboard-shortcuts--left">
          <button type="button" data-testid="new-project-btn">
            <Icon name="folder-add-left" size="small" />
            新建项目
          </button>
          <A href="/workspace" data-testid="import-data-link">
            <Icon name="arrow-up" size="small" />
            导入外业数据
          </A>
        </div>
      </aside>

      <section class="rw-col-center">
        <header class="dashboard-hero">
          <div>
            <p>/dashboard</p>
            <h1>项目驾驶舱</h1>
          </div>
          <div class="dashboard-hero__stats">
            <span>{db.projects.length} 项目</span>
            <span>{db.alerts.length} 告警</span>
            <span>{db.activeAgents.length} Agent</span>
          </div>
        </header>

        <Show when={db.offline}>
          <div class="dashboard-offline">离线模式：显示本地缓存数据。</div>
        </Show>

        <MonitorMap projects={db.projects} />

        <section class="dashboard-project-wall" data-testid="dashboard-project-cards">
          <div class="dashboard-section-title">
            <h2>项目卡片</h2>
            <span>行业类型、监测点、最新数据与告警</span>
          </div>
          <Show
            when={db.projects.length > 100}
            fallback={
              <div class="dashboard-project-grid">
                <For each={db.projects}>{(project) => <ProjectCard card={project} />}</For>
              </div>
            }
          >
            <VList data={db.projects} style={{ height: "420px" }}>
              {(project) => <ProjectCard card={project} />}
            </VList>
          </Show>
        </section>
      </section>

      <aside class="rw-col-right">
        <AlertFeed alerts={db.alerts} />
        <section class="dashboard-panel" data-testid="dashboard-session-list">
          <div class="dashboard-panel__head">
            <h2>最近会话</h2>
            <span>{db.recentSessions.length}</span>
          </div>
          <Show when={db.recentSessions.length > 0} fallback={<p class="dashboard-muted">暂无会话记录。</p>}>
            <ul class="dashboard-sessions">
              <For each={db.recentSessions}>
                {(session) => (
                  <li>
                    <A href={`/${base64Encode(session.directory)}/session/${session.id}`}>{session.title}</A>
                    <time>{new Date(session.time.updated).toLocaleDateString("zh-CN")}</time>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>
        <ActiveAgents agents={db.activeAgents} />
        <Show when={active()}>
          {(project) => (
            <section class="dashboard-panel dashboard-panel--chart">
              <div class="dashboard-panel__head">
                <h2>近 30 天沉降</h2>
                <span>{project().name}</span>
              </div>
              <SettlementChart projectId={project().id} days={30} />
            </section>
          )}
        </Show>
        <section class="dashboard-panel">
          <div class="dashboard-panel__head">
            <h2>快捷入口</h2>
          </div>
          <div class="dashboard-shortcuts">
            <button type="button" data-testid="primary-btn">
              <Icon name="folder-add-left" size="small" />
              新建项目
            </button>
            <A href="/workspace">
              <Icon name="arrow-up" size="small" />
              导入外业数据
            </A>
            <button type="button">
              <Icon name="file-tree" size="small" />
              生成月报
            </button>
          </div>
        </section>
      </aside>
    </main>
  )
}
