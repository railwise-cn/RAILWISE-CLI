// SolidJS custom directive declarations for RAILWISE App

import "solid-js"

declare module "solid-js" {
  namespace JSX {
    interface Directives {
      sortable: boolean | any
    }
  }
}
