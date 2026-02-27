import { Bus } from "@/bus"
import { SessionCompaction } from "@/session/compaction"
import { Instance } from "@/project/instance"
import { MemoryExtract } from "./extract"
import { Log } from "@/util/log"

const log = Log.create({ service: "memory.listener" })

export namespace MemoryListener {
  export function init() {
    Bus.subscribe(SessionCompaction.Event.Compacted, async (event) => {
      log.info("compaction completed, extracting memories", { sessionID: event.properties.sessionID })
      await MemoryExtract.fromCompaction({
        sessionID: event.properties.sessionID,
        projectID: Instance.project.id,
      }).catch((e) => log.error("failed to extract memories", { error: e }))
    })
  }
}
