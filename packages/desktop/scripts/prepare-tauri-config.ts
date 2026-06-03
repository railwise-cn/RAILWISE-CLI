const arg = (name: string) => {
  const index = Bun.argv.indexOf(name)
  if (index === -1) return undefined
  return Bun.argv[index + 1]
}

const source = arg("--source") || "src-tauri/tauri.prod.conf.json"
const output = arg("--output") || "src-tauri/tauri.ci.conf.json"
const config = await Bun.file(source).json()

if (!Bun.env.TAURI_SIGNING_PRIVATE_KEY) config.bundle.createUpdaterArtifacts = false

await Bun.write(output, JSON.stringify(config, null, 2) + "\n")

console.log(`Prepared Tauri config ${output}`)
