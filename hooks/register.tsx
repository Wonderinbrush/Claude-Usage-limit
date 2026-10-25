import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { Limit } from '../types'

// Times are shown in India Standard Time. Change these two lines for another zone.
const TZ_OFFSET_MIN = 330
const TZ_LABEL = 'IST'
const WARN_AT = [80, 90, 100]

const limits = atom({ plugin: 'usage-limits', key: 'limits' } as const, [], { shape: 'limits-1' })
const nowAtom = atom({ plugin: 'usage-limits', key: 'now' } as const, 0)
const isHidden = atom({ plugin: 'usage-limits', key: 'isHidden' } as const, false)

const NAMES: Record<string, string> = { five_hour: 'Session (5h)', seven_day: 'Weekly', spend_limit: 'Spend' }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const toLimit = (r: SessionRateLimit): Limit => ({ kind: r.kind, pct: r.percentUsed, resetsAt: r.resetsAt ?? null })

function clockText(iso: string, now: number): string {
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  const local = new Date(ms + TZ_OFFSET_MIN * 60000)
  const h = local.getUTCHours(), m = local.getUTCMinutes()
  const time = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  const today = new Date(now + TZ_OFFSET_MIN * 60000)
  const sameDay = local.getUTCDate() === today.getUTCDate() && ms - now < 86400000
  return sameDay ? time : `${DAYS[local.getUTCDay()]} ${time}`
}

function leftText(iso: string, now: number): string {
  const s = Math.max(0, Math.round((Date.parse(iso) - now) / 60000))
  const d = Math.floor(s / 1440), h = Math.floor((s % 1440) / 60), m = s % 60
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
}

const bar = (pct: number) => {
  const n = Math.max(0, Math.min(10, Math.round(pct / 10)))
  return '█'.repeat(n) + '░'.repeat(10 - n)
}

const line = (l: Limit, now: number) =>
  `${NAMES[l.kind] ?? l.kind}: ${Math.round(l.pct)}% used` +
  (l.resetsAt ? `, resets ${clockText(l.resetsAt, now)} ${TZ_LABEL} (in ${leftText(l.resetsAt, now)})` : '')

const warned: Record<string, number> = {}

async function save($: EngineInterface, rows: SessionRateLimit[]) {
  const list = rows.map(toLimit)
  await update($, limits, () => list)
  await update($, nowAtom, () => Date.now())
  for (const l of list) {
    const level = WARN_AT.filter(w => l.pct >= w).pop() ?? 0
    if (level > (warned[l.kind] ?? 0)) {
      warned[l.kind] = level
      $.ui.toast(`${NAMES[l.kind] ?? l.kind} limit at ${Math.round(l.pct)}%` + (l.resetsAt ? `, resets in ${leftText(l.resetsAt, Date.now())}` : ''))
    }
  }
  const s = list.find(l => l.kind === 'five_hour'), w = list.find(l => l.kind === 'seven_day')
  $.ui.status([s && `5h ${Math.round(s.pct)}%`, w && `week ${Math.round(w.pct)}%`].filter(Boolean).join(' · ') || undefined)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'limits', description: 'Show your session and weekly usage limits and when they reset' })
    try { await save($, (await $.session.usage()).rateLimits) } catch {}
    $.clock.every(60000, () => { void update($, nowAtom, () => Date.now()) })
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await save($, e.rateLimits)
    return next(e)
  })

  on('command.run', { command: 'limits' }, async $ => {
    const list = (await $.session.usage()).rateLimits.map(toLimit)
    await update($, limits, () => list)
    await update($, isHidden, () => false)
    const now = Date.now()
    if (!list.length) return { text: 'No limit reading yet. Limits appear after the first reply on a Claude subscription.' }
    return { text: list.map(l => `${bar(l.pct)} ${line(l, now)}`).join('\n') }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const list = await read($, limits)
    const now = (await read($, nowAtom)) || Date.now()
    const { Box, Text, Button } = $.ui.resolve(e)
    if (!list.length) {
      return (
        <Box>
          <Text dimColor>Usage limits: shown after the first reply</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        {list.map(l => (
          <Box key={l.kind}>
            <Text color={l.pct >= 90 ? 'error' : l.pct >= 75 ? 'warning' : 'success'} mono>{bar(l.pct)} </Text>
            <Text dimColor={l.pct < 75}>{line(l, now)}</Text>
          </Box>
        ))}
        <Box>
          <Button key="hide" label="Hide" onPress={() => update($, isHidden, () => true)} />
          <Text dimColor> Type /limits to show it again</Text>
        </Box>
      </Box>
    )
  })
}
