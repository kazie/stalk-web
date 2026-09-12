import type * as React from 'react'

declare module '@ladle/react' {
  export type Story<P = {}> = React.FC<P> & {
    storyName?: string
  }
}
