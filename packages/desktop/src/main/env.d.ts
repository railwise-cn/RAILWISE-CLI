interface ImportMetaEnv {
  readonly RAILWISE_CHANNEL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module "virtual:railwise-server" {
  export namespace Server {
    export const listen: typeof import("../../../railwise/dist/types/src/node").Server.listen
    export type Listener = import("../../../railwise/dist/types/src/node").Server.Listener
  }
  export namespace Config {
    export const get: typeof import("../../../railwise/dist/types/src/node").Config.get
    export type Info = import("../../../railwise/dist/types/src/node").Config.Info
  }
  export const bootstrap: typeof import("../../../railwise/dist/types/src/node").bootstrap
}
