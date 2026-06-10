import { $ } from "bun"

await $`bun ./scripts/copy-icons.ts ${process.env.RAILWISE_CHANNEL ?? "dev"}`

await $`cd ../railwise && bun script/build-node.ts`
