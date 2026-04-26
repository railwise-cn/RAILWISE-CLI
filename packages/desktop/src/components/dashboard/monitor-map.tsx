import maplibregl, { type GeoJSONSource, type Map, type Popup } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import { usePlatform, useServer } from "@railwise/app"
import type { ProjectCard } from "./types"

const TileUrl =
  "https://wprd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}"

const statusColor: maplibregl.ExpressionSpecification = [
  "match",
  ["get", "status"],
  "green",
  "#52c41a",
  "yellow",
  "#faad14",
  "red",
  "#ff4d4f",
  "#8c8c8c",
]

export function MonitorMap(props: { projects: ProjectCard[] }) {
  const server = useServer()
  const platform = usePlatform()
  const [ready, setReady] = createSignal(false)
  const [online, setOnline] = createSignal(navigator.onLine)
  let root: HTMLDivElement | undefined
  let map: Map | undefined
  let popup: Popup | undefined

  function tileUrl() {
    if (online() || !server.current) return TileUrl
    return `${server.current.http.url}/tiles/{z}/{x}/{y}`
  }

  function authorization() {
    if (!server.current?.http.password) return
    return `Basic ${btoa(`${server.current.http.username ?? "railwise"}:${server.current.http.password}`)}`
  }

  function mount() {
    if (!root) return
    popup?.remove()
    map?.remove()
    setReady(false)

    const local = server.current?.http.url
    const header = authorization()
    map = new maplibregl.Map({
      container: root,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          amap: {
            type: "raster",
            tiles: [tileUrl()],
            tileSize: 256,
            attribution: "高德地图",
          },
        },
        layers: [{ id: "amap", type: "raster", source: "amap" }],
      },
      center: [116.4, 39.9],
      zoom: 4.2,
      maxZoom: 18,
      transformRequest(url) {
        if (!header || !local || !url.startsWith(local)) return { url }
        return { url, headers: { Authorization: header } }
      },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left")
    map.on("load", () => setReady(true))
  }

  onMount(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    onCleanup(() => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
    })
  })

  createEffect(() => {
    tileUrl()
    authorization()
    mount()
  })

  createEffect(() => {
    const current = map
    if (!ready() || !current || !server.current) return
    props.projects.forEach((project) => {
      const source = `dashboard-points-${project.id}`
      const url = `${server.current?.http.url}/dashboard/projects/${project.id}/points`
      const headers = new Headers()
      if (server.current?.http.password) {
        headers.set(
          "Authorization",
          `Basic ${btoa(`${server.current.http.username ?? "railwise"}:${server.current.http.password}`)}`,
        )
      }
      ;(platform.fetch ?? globalThis.fetch)(url, { headers })
        .then((response) => response.json())
        .then((geojson) => {
          if (current.getSource(source)) {
            ;(current.getSource(source) as GeoJSONSource).setData(geojson)
            return
          }
          current.addSource(source, {
            type: "geojson",
            data: geojson,
            cluster: true,
            clusterRadius: 42,
            clusterMaxZoom: 14,
          })
          current.addLayer({
            id: `dashboard-clusters-${project.id}`,
            type: "circle",
            source,
            filter: ["has", "point_count"],
            paint: {
              "circle-color": ["step", ["get", "point_count"], "#9db8ff", 50, "#5b7cfa", 200, "#3451c9"],
              "circle-radius": ["step", ["get", "point_count"], 14, 50, 20, 200, 26],
              "circle-opacity": 0.86,
            },
          })
          current.addLayer({
            id: `dashboard-cluster-count-${project.id}`,
            type: "symbol",
            source,
            filter: ["has", "point_count"],
            layout: { "text-field": "{point_count_abbreviated}", "text-size": 11 },
            paint: { "text-color": "#fff" },
          })
          current.addLayer({
            id: `dashboard-points-layer-${project.id}`,
            type: "circle",
            source,
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": statusColor,
              "circle-radius": 6,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1.5,
            },
          })
          current.on("click", `dashboard-points-layer-${project.id}`, (event) => {
            const feature = event.features?.[0]
            if (!feature) return
            popup?.remove()
            popup = new maplibregl.Popup({ offset: 12 })
              .setLngLat(event.lngLat)
              .setHTML(
                `<strong>${feature.properties?.name ?? "监测点"}</strong><br/>最新值：${feature.properties?.latestValue ?? "-"} ${feature.properties?.unit ?? "mm"}<br/>负责人：${feature.properties?.owner ?? "-"}`,
              )
              .addTo(current)
          })
        })
        .catch(() => undefined)
    })
  })

  onCleanup(() => {
    popup?.remove()
    map?.remove()
  })

  return (
    <section class="dashboard-map" data-testid="dashboard-map">
      <div ref={root} class="dashboard-map__canvas" />
      <Show when={!online()}>
        <div class="dashboard-map__offline" data-testid="map-offline-indicator">
          <strong>离线地图</strong>
          <span data-testid="map-tile-source">本地缓存</span>
        </div>
      </Show>
      <div class="dashboard-map__legend">
        <span data-status="green">正常</span>
        <span data-status="yellow">预警</span>
        <span data-status="red">超限</span>
        <span data-status="gray">过期</span>
      </div>
    </section>
  )
}
