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
