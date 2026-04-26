import uPlot, { type AlignedData } from "uplot"
import "uplot/dist/uPlot.min.css"
import { createEffect, onCleanup, onMount } from "solid-js"
import { usePlatform, useServer } from "@railwise/app"

const colors = {
  bg: "#191815",
  grid: "rgba(255,255,255,0.08)",
  tick: "rgba(255,255,255,0.18)",
  label: "rgba(255,255,255,0.58)",
  line: "#e5b567",
  fill: "rgba(229,181,103,0.12)",
}

function options(width: number, metric: "settlement" | "displacement", height: number): uPlot.Options {
  return {
    width,
    height,
    cursor: {
      show: true,
      sync: { key: "rw-settlement" },
      points: { show: true },
    },
    scales: { x: { time: true }, y: {} },
    axes: [
      {
        stroke: colors.label,
        grid: { stroke: colors.grid, width: 1 },
        ticks: { stroke: colors.tick, width: 1 },
        font: "11px PingFang SC, sans-serif",
        values: (_plot, splits) =>
          splits.map((value) => new Date(value * 1000).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" })),
        space: 48,
      },
      {
        label: metric === "displacement" ? "位移(mm)" : "沉降(mm)",
        stroke: colors.label,
        grid: { stroke: colors.grid, width: 1 },
        ticks: { stroke: colors.tick, width: 1 },
        font: "11px PingFang SC, sans-serif",
        space: 34,
      },
    ],
    series: [
      {},
      {
        label: metric === "displacement" ? "位移量" : "沉降量",
        stroke: colors.line,
        fill: colors.fill,
        width: 2,
        points: { show: true, size: 4, fill: colors.line },
      },
    ],
  }
}

export function SettlementChart(props: {
  projectId: string
  days?: number
  metric?: "settlement" | "displacement"
  height?: number
}) {
  const server = useServer()
  const platform = usePlatform()
  let root: HTMLDivElement | undefined
  let plot: uPlot | undefined
  let observer: ResizeObserver | undefined

  async function load() {
    if (!plot || !server.current) return
    const metric = props.metric ?? "settlement"
    const headers = new Headers()
    if (server.current.http.password) {
      headers.set(
        "Authorization",
        `Basic ${btoa(`${server.current.http.username ?? "railwise"}:${server.current.http.password}`)}`,
      )
    }
    await (platform.fetch ?? globalThis.fetch)(
      `${server.current.http.url}/dashboard/projects/${props.projectId}/timeseries?metric=${metric}&days=${props.days ?? 30}`,
      { headers },
    )
      .then(async (response) => plot?.setData((await response.json()) as AlignedData))
      .catch(() => undefined)
  }

  onMount(() => {
    if (!root) return
    const height = props.height ?? 180
    plot = new uPlot(options(root.offsetWidth || 260, props.metric ?? "settlement", height), [[], []] as AlignedData, root)
    observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width)
      if (width > 0) plot?.setSize({ width, height })
    })
    observer.observe(root)
    void load()
  })

  createEffect(() => {
    props.projectId
    props.days
    props.metric
    void load()
  })

  onCleanup(() => {
    observer?.disconnect()
    plot?.destroy()
  })

  return <div ref={root} class="dashboard-chart" data-testid="dashboard-settlement-chart" />
}
