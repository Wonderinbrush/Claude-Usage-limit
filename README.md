# usage-limits

Shows your Claude usage limits above the chat box: the 5-hour session window and the weekly window, each with a
coloured bar, the percent used, the reset time in IST and a countdown. It warns with a toast at 80%, 90% and 100%,
puts a short summary in the status line, and adds `/limits` to print the figures on demand. Figures come from
Claude itself and appear after the first reply of a session on a Claude subscription. Change `TZ_OFFSET_MIN` and
`TZ_LABEL` at the top of `hooks/register.tsx` for another time zone.

## Install

Install once; it then loads in every new session on your computer.

In the Claude desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with
`Wonderinbrush/Claude-Usage-limit`, then **Add plugin**.

At the prompt of a terminal session:

```
/plugin install usage-limits --marketplace Wonderinbrush/Claude-Usage-limit
```

Without GitHub, from a shell on your computer, using this folder directly:

```
claude plugin marketplace add /path/to/usage-limits
claude plugin install usage-limits@usage-limits
```
