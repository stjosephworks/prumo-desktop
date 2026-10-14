# Prumo Desktop

A desktop application for [Prumo](https://github.com/stjosephworks/prumo). It creates Prumo projects, lists them,
reads their `.prumo/` conventions, and runs their apps, each in its own terminal panel.

It is a **consumer** of Prumo, never a second implementation of it. The Desktop ships a pinned copy of the
`@stjoseph/prumo` CLI and runs it; everything it knows about a project comes from what that CLI deliberately exposes
(its commands with `--json`) and from the files a generated project carries.

## Status

**Version 0.0.3 runs on macOS, Linux and Windows, unsigned.** It creates and lists projects, runs their apps and
their database, and reads their `.prumo/`. A throwaway spike, on the `spike` branch, proved the risky parts before any of it
was built.

Next is the first signed and notarised macOS build, well before any public release, and arm64 builds for Linux and
Windows. Every technology choice must work on all three systems.

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
pnpm smoke       # packages the app and checks it with the PATH an app opened from the desktop gets
```

## Releases

`.github/workflows/release.yml` turns a new `package.json` version on `main` into one GitHub draft holding every
system's build: a dmg and a zip for Apple silicon (arm64) and for Intel (x64), a deb and an rpm for Linux x64, and a
Squirrel.Windows Setup.exe for Windows x64. How the macOS build is signed depends only on which secrets the repository
has:

| Secrets | macOS build | Installed Macs |
|---|---|---|
| None | Ad-hoc signature (`codesign --sign -`), not notarized, in a pre-release; first-launch instructions in the notes, from `.github/release-notes/unsigned.md` | Never update themselves; they say when a newer release is out |
| All five: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | Developer ID signature with the Hardened Runtime, notarized and stapled, in a normal release | Update themselves through update.electronjs.org, from published releases only |
| Only some | The job fails and names what is missing | |

**The release is a pre-release while the macOS build is ad-hoc, and a normal release once it is signed with a
Developer ID**, which update.electronjs.org then serves to installed Macs; it never serves a pre-release.

**The Linux packages and the Windows Setup.exe are unsigned in either kind of release**, and the notes say so
(`.github/release-notes/linux.md`, `.github/release-notes/windows.md`). Squirrel.Windows on GitHub Releases is the
only Windows channel; the Microsoft Store is not planned for now. On Windows, Microsoft Defender SmartScreen warns
before an app it does not know yet, and its warning offers **More info**, then **Run anyway**; Smart App Control,
where it is on, blocks unsigned apps with no way around it for a single app
([Microsoft](https://support.microsoft.com/en-us/topic/what-is-smart-app-control-285ea03d-fa88-4d56-882e-6698afdb7003)).

Every build that does not update itself, Linux and Windows included, checks GitHub Releases and says when a newer
version is out, with a link to it (`src/main/updates.ts`). `pnpm package` locally makes an ad-hoc build.

## Requirements (for users)

Node 22.18 or later and pnpm 10.26 or later, the floors of the Prumo CLI it ships. The Desktop checks them through
`prumo doctor`; it never installs them.

## License

[MIT](LICENSE)
