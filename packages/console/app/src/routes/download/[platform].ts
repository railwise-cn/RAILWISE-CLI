import { APIEvent } from "@solidjs/start"
import { DownloadPlatform } from "./types"

type Release = {
  tag_name: string
  draft: boolean
  assets: {
    name: string
    browser_download_url: string
  }[]
}

type FetchInit = RequestInit & {
  cf?: {
    cacheTtl: number
    cacheEverything: boolean
  }
}

const assetNames: Record<string, string> = {
  "darwin-aarch64-dmg": "railwise-desktop-darwin-aarch64.dmg",
  "darwin-x64-dmg": "railwise-desktop-darwin-x64.dmg",
} satisfies Record<DownloadPlatform, string>

// Doing this on the server lets us preserve the original name for platforms we don't care to rename for
const downloadNames: Record<string, string> = {
  "darwin-aarch64-dmg": "RAILWISE Desktop.dmg",
  "darwin-x64-dmg": "RAILWISE Desktop.dmg",
} satisfies { [K in DownloadPlatform]?: string }

export async function GET({ params: { platform } }: APIEvent) {
  const assetName = assetNames[platform]
  if (!assetName) return new Response("Not Found", { status: 404 })

  const init = {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "RAILWISE-Console",
    },
    cf: {
      // in case gh releases has rate limits
      cacheTtl: 60 * 5,
      cacheEverything: true,
    },
  } satisfies FetchInit

  const releases = await fetch("https://api.github.com/repos/railwise-cn/RAILWISE-CLI/releases?per_page=30", init)
  if (!releases.ok) return new Response("Release lookup failed", { status: 502 })

  const release = ((await releases.json()) as Release[]).find(
    (item) =>
      !item.draft &&
      item.tag_name.startsWith("desktop/v") &&
      item.assets.some((asset) => asset.name === assetName),
  )
  const asset = release?.assets.find((item) => item.name === assetName)
  if (!asset) return new Response("Not Found", { status: 404 })

  const resp = await fetch(asset.browser_download_url)

  const downloadName = downloadNames[platform]

  const headers = new Headers(resp.headers)
  if (downloadName) headers.set("content-disposition", `attachment; filename="${downloadName}"`)

  return new Response(resp.body, { ...resp, headers })
}
