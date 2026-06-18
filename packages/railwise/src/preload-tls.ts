import net from "node:net"

type BunFetchInit = RequestInit & {
  tls?: {
    rejectUnauthorized?: boolean
  }
}

const base = globalThis.fetch
const loopback = ["localhost", "127.0.0.1", "::1"]

function target(input: RequestInfo | URL) {
  try {
    if (input instanceof Request) return new URL(input.url)
    return new URL(input.toString())
  } catch {
    return undefined
  }
}

function reset(message = "The socket connection was closed unexpectedly") {
  const error = new Error(message) as Error & { code: string }
  error.code = "ECONNRESET"
  return error
}

function chunked(input: Buffer) {
  const chunks: Buffer[] = []
  let offset = 0

  while (true) {
    const end = input.indexOf("\r\n", offset)
    if (end === -1) return { body: Buffer.concat(chunks), complete: false }

    const size = Number.parseInt(input.subarray(offset, end).toString().split(";")[0]?.trim() ?? "", 16)
    if (Number.isNaN(size)) return { body: Buffer.concat(chunks), complete: false }

    offset = end + 2
    if (size === 0) return { body: Buffer.concat(chunks), complete: true }
    if (input.length < offset + size + 2) return { body: Buffer.concat(chunks), complete: false }

    chunks.push(input.subarray(offset, offset + size))
    offset += size + 2
  }
}

function response(raw: Buffer) {
  const split = raw.indexOf("\r\n\r\n")
  if (split === -1) throw reset("Connection closed before response headers completed")

  const head = raw.subarray(0, split).toString()
  const lines = head.split("\r\n")
  const status = Number(lines[0]?.match(/^HTTP\/\d(?:\.\d)?\s+(\d+)/)?.[1] ?? 200)
  const headers = new Headers()

  lines.slice(1).forEach((line) => {
    const index = line.indexOf(":")
    if (index === -1) return
    headers.append(line.slice(0, index).trim(), line.slice(index + 1).trim())
  })

  const body =
    headers.get("transfer-encoding")?.toLowerCase().includes("chunked") === true
      ? chunked(raw.subarray(split + 4))
      : {
          body: raw.subarray(split + 4),
          complete:
            headers.get("content-length") === null ||
            raw.subarray(split + 4).length >= Number(headers.get("content-length")),
        }

  if (!body.complete) throw reset()
  headers.delete("transfer-encoding")
  headers.delete("content-length")

  return new Response(body.body.buffer.slice(body.body.byteOffset, body.body.byteOffset + body.body.byteLength) as ArrayBuffer, {
    status,
    headers,
  })
}

async function local(input: RequestInfo | URL, init?: RequestInit) {
  const req = new Request(input, init)
  const url = new URL(req.url)
  const body = req.body ? Buffer.from(await req.arrayBuffer()) : undefined

  return new Promise<Response>((resolve, reject) => {
    const socket = net.connect(
      {
        host: url.hostname === "localhost" ? "127.0.0.1" : url.hostname,
        port: Number(url.port || 80),
      },
      () => {
        const headers = new Headers(req.headers)
        headers.set("host", url.host)
        headers.set("connection", "close")
        if (body) headers.set("content-length", body.length.toString())

        socket.write(
          [
            `${req.method} ${url.pathname}${url.search} HTTP/1.1`,
            ...Array.from(headers.entries()).map(([key, value]) => `${key}: ${value}`),
            "",
            "",
          ].join("\r\n"),
        )
        if (body) socket.write(body)
      },
    )
    const chunks: Buffer[] = []

    socket.on("data", (data) => chunks.push(data))
    socket.on("error", reject)
    socket.on("end", () => {
      try {
        resolve(response(Buffer.concat(chunks)))
      } catch (e) {
        reject(e)
      }
    })
    req.signal.addEventListener("abort", () => socket.destroy(req.signal.reason), { once: true })
  })
}

const wrapped = ((input: RequestInfo | URL, init?: RequestInit) => {
  const url = target(input)
  if (url?.protocol === "http:" && loopback.includes(url.hostname)) return local(input, init)
  return base(input, {
    ...init,
    tls: {
      ...((init as BunFetchInit | undefined)?.tls ?? {}),
      rejectUnauthorized: false,
    },
  } as BunFetchInit)
}) as typeof globalThis.fetch

wrapped.preconnect = base.preconnect.bind(base)
globalThis.fetch = wrapped
