# Prumo Desktop

A desktop application for [Prumo](https://github.com/stjosephworks/prumo). It creates Prumo projects, lists them,
reads their `.prumo/` conventions, and runs their apps, each in its own terminal panel.

It is a **consumer** of Prumo, never a second implementation of it. The Desktop ships a pinned copy of the
`@stjoseph/prumo` CLI and runs it; everything it knows about a project comes from what that CLI deliberately exposes
(its commands with `--json`) and from the files a generated project carries.

## Status

**Version 0.0.5 runs on macOS, Linux and Windows, unsigned.** It creates and lists projects, with apps named on purpose
when asked, adds an app to a workspace, runs their apps and their database, and reads their `.prumo/`. A throwaway spike, on the `spike` branch, proved the risky parts before any of it
was built.

Next is the first signed and notarised macOS build, well before any public release. Every technology choice must
work on all three systems.

**arm64 for Linux and Windows is planned, on demand.** The x64 builds cover every Intel and AMD machine; arm64 ships
when someone asks for it. What it takes, so it is not worked out again:

- Add `ubuntu-24.04-arm` and `windows-11-arm` to the release and `packaged-*` matrices; GitHub's arm64 runners are free
  for public repositories.
- node-pty ships a `win32-arm64` prebuild, but none for Linux: on Linux arm64 it compiles during `pnpm install`, so the
  Linux arm64 package must be built on an arm64 runner, never cross-built.
- Docker Desktop has no Linux arm64 build and is in early access on Windows on Arm, so Open Docker there falls back to
  the message for Docker Engine. Windows on Arm can already run the x64 Setup.exe under emulation (unverified for this
  app).

## Languages

English, Portuguese (Brazil) and Spanish (Latin America). The Desktop opens in the first of the system's preferred
languages it speaks, whatever the region (`es-MX` is Spanish, `pt-PT` Portuguese), and in English when it speaks
none. A language picked in the sidebar is kept in the app's `settings.json` from then on, and switches the window,
the tray, the app menu, notifications and dialogs at once, without a restart. Its first option, Follow the system,
removes that choice, and the system's language answers again.

A new language is one entry in `src/shared/locales.ts` and one dictionary in each of `src/renderer/i18n/` and
`src/main/i18n/`. The build refuses it until both dictionaries exist, and `src/shared/dictionaries.spec.ts` holds it
to English's shape with no change. The release notes stay in English.

## Branches

One chain, and nothing skips a step: a `task/`, `fix/`, `chore/`, `docs/` or `refactor/` branch → `dev` → `staging` →
`main`. Large work goes `task/<name>` → `project/<name>` → `dev`, and reaches `dev` only once it is decided to ship.
Nobody pushes to `main`, `staging`, `dev` or a `project/` branch; a ruleset refuses it, and
`.github/workflows/flow.yml` refuses a pull request that skips a step.

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
