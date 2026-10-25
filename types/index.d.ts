export type Limit = { kind: string; pct: number; resetsAt: string | null }

declare module 'claude-code' {
  interface PluginState {
    'usage-limits': { limits: Shaped<Limit[]>; now: number; isHidden: boolean }
  }
}
