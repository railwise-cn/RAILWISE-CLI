// @ts-nocheck

import { RAILWISE } from "@railwise/core"
import { ReadTool } from "@railwise/core/tools"

const railwise = RAILWISE.make({})

railwise.tool.add(ReadTool)

railwise.tool.add({
  name: "bash",
  schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The command to run.",
      },
    },
    required: ["command"],
  },
  execute(input, ctx) {},
})

railwise.auth.add({
  provider: "openai",
  type: "api",
  value: process.env.OPENAI_API_KEY,
})

railwise.agent.add({
  name: "build",
  permissions: [],
  model: {
    id: "gpt-5-5",
    provider: "openai",
    variant: "xhigh",
  },
})

const sessionID = await railwise.session.create({
  agent: "build",
})

railwise.subscribe((event) => {
  console.log(event)
})

await railwise.session.prompt({
  sessionID,
  text: "hey what is up",
})

await railwise.session.prompt({
  sessionID,
  text: "what is up with this",
  files: [
    {
      mime: "image/png",
      uri: "data:image/png;base64,xxxx",
    },
  ],
})

await railwise.session.wait()

console.log(await railwise.session.messages(sessionID))
