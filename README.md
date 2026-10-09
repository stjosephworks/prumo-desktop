# Prumo Desktop

A desktop application for [Prumo](https://github.com/stjosephworks/prumo). It creates Prumo projects, lists them,
reads their `.prumo/` conventions, and runs their apps, each in its own terminal panel.

It is a **consumer** of Prumo, never a second implementation of it. The Desktop ships a pinned copy of the
`@stjoseph/prumo` CLI and runs it; everything it knows about a project comes from what that CLI deliberately exposes
(its commands with `--json`) and from the files a generated project carries.

## Status

**Version 0.0.1 runs on macOS, as an ad-hoc signed pre-release** (see Releases below). A throwaway spike, on the `spike` branch, proved the risky parts first.
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

## Releases

`.github/workflows/release.yml` turns a new `package.json` version on `main` into a GitHub draft, with a dmg and a zip
for Apple silicon (arm64) and for Intel (x64). How the app is signed depends only on which secrets the repository
has:

| Secrets | Build | Release |
|---|---|---|
| None | Ad-hoc signature (`codesign --sign -`), not notarized; the app never updates itself | A pre-release, with first-launch instructions from `.github/release-notes/unsigned.md` |
| All five: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | Developer ID signature with the Hardened Runtime, notarized and stapled | A release; installed apps update themselves through update.electronjs.org |
| Only some | The job fails and names what is missing | None |

**Switching to signed releases takes nothing but adding the five secrets.** The first signed version has to be a
version with no release yet, and anyone on an ad-hoc build installs it by hand, once: an ad-hoc build does not
update itself. `pnpm package` locally makes an ad-hoc build too.

## Requirements (for users)

Node 22.18 or later and pnpm 10.26 or later, the floors of the Prumo CLI it ships. The Desktop checks them through
`prumo doctor`; it never installs them.

## License

[MIT](LICENSE)
