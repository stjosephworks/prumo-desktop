# Prumo Desktop

A desktop application for [Prumo](https://github.com/stjosephworks/prumo). It creates Prumo projects, lists them,
reads their `.prumo/` conventions, and runs their apps, each in its own terminal panel.

It is a **consumer** of Prumo, never a second implementation of it. The Desktop ships a pinned copy of the
`@stjoseph/prumo` CLI and runs it; everything it knows about a project comes from what that CLI deliberately exposes
(its commands with `--json`) and from the files a generated project carries.

## Status

**Version 0.0.1 runs on macOS, unsigned.** A throwaway spike, on the `spike` branch, proved the risky parts first.
This repository holds the decisions:

- [`docs/DECISIONS.md`](docs/DECISIONS.md): every approved decision, with the options considered, the reasoning and
  what it costs.
- [`docs/OPEN-QUESTIONS.md`](docs/OPEN-QUESTIONS.md): what is still unresolved.

## Build order

1. ~~**Spike, before any interface.**~~ Done on 2026-09-17, every proof passed; see `docs/DECISIONS.md`.
2. ~~**Foundation.**~~ Done on 2026-09-17: the environment layer (`PATH`, `prumo doctor`), the process layer (start,
   stop the whole tree, state, terminal buffer, stopping everything on quit), the IPC contract and a first screen.
3. ~~**Features, one at a time:**~~ Done on 2026-09-17: project list, creating a project, running apps, the
   database, reading `.prumo/`.
4. **First signed and notarised build**, well before the public release.

Version 0.0.1 targets macOS only. Every technology choice must also work on Windows and Linux.

## Working on it

```sh
pnpm install     # also embeds the pinned CLI and fixes node-pty's spawn-helper
pnpm start       # development
pnpm test        # real processes and the embedded CLI, no mocks
pnpm lint        # biome
pnpm typecheck
pnpm smoke       # packages the app and checks it with the PATH an app opened from Finder gets
```

## Requirements (for users)

Node 22.17 or later and pnpm. The Desktop checks them; it never installs them.

## License

[MIT](LICENSE)
