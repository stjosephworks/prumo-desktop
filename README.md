# Prumo Desktop

A desktop application for [Prumo](https://github.com/stjosephworks/prumo). It creates Prumo projects, lists them,
reads their `.prumo/` conventions, and runs their apps, each in its own terminal panel.

It is a **consumer** of Prumo, never a second implementation of it. The Desktop ships a pinned copy of the
`@stjoseph/prumo` CLI and runs it; everything it knows about a project comes from what that CLI deliberately exposes
(its commands with `--json`) and from the files a generated project carries.

## Status

**Version 0.0.1 runs on macOS, unsigned.** It creates and lists projects, runs their apps and their database,
and reads their `.prumo/`. A throwaway spike, on the `spike` branch, proved the risky parts before any of it
was built.

Next is the first signed and notarised build, well before any public release. Version 0.0.1 targets macOS only,
and every technology choice must also work on Windows and Linux.

## Branches

One chain, and nothing skips a step: a branch of your own → `dev` → `alpha` → `main`. Nobody pushes to those three;
a ruleset refuses it, and `.github/workflows/flow.yml` refuses a pull request that skips a step.

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
