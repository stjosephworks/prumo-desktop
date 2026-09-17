# Decisions

Running log of every approved decision. Append one entry per decision, newest last.
Update this file in the same turn the decision is made.

Entry format:

```
## YYYY-MM-DD: <decision name>

**Decision:** <what was decided>

**Options considered:**
- A) <option>
- B) <option>

**Reasoning:** <why this option won>

**What it costs:** <what the choice gives up>

**Affects:** <files, layers or documents this decision governs>
```

---

> **Origin.** Every entry dated 2026-09-17 was discussed in planning notes written inside the Prumo repository before
> this repository existed, and confirmed by the user one decision at a time. Some were revised the same day, after
> Prumo's CLI gained `--json`, `doctor`, `db` and `clean` (Prumo commit `7de3f5a`); only the revised form is here.
> External facts cite the documentation they were read in on that day; anything recalled rather than read is marked.

---

## 2026-09-17: Prumo Desktop is a separate repository that only consumes the CLI

**Decision:** the Desktop lives in its own repository, `stjosephworks/prumo-desktop`, separate from `prumo`. It uses
only what the published CLI offers (its commands and flags, `--json` included) and the files a generated project
carries (`.prumo/config.json`, `.prumo/INDEX.md` and the knowledge base, the project's `package.json` scripts and its
`docker-compose.yml`).

**Options considered:**
- A) Inside `prumo`: shared types imported directly; native builds, signing and packaging added to a repository of
  markdown, templates and a small CLI; a visual bug forces a CLI release, or two version lines in one repository.
- B) A separate repository: each keeps its own CI and ships when it needs to; the CLI is the contract.

**Reasoning:** B. Consistency comes from structure: a separate repository cannot import the CLI's internals, so
running the CLI is the only path, and the Desktop sees only what the CLI deliberately exposes. Inside `prumo` it
would be easy to reach into internals "just once".

**What it costs:** the Desktop cannot reuse `AppType`, `Answers` or `validateProjectName`. Anything it needs has to be
exposed by the CLI first.

**Affects:** the whole repository

---

## 2026-09-17: The CLI is embedded at a pinned version, not installed globally

**Decision:** the Desktop ships a pinned version of `@stjoseph/prumo` and runs that copy with the system's Node.

**Options considered:**
- A) Embedded and pinned.
- B) Installed globally by the Desktop.

**Reasoning:** A. A global install touches the user's `PATH` and global npm, may need administrator rights, may
collide with a `prumo` the user already has at another version, and survives uninstalling the app.

**What it costs:** a CLI fix reaches Desktop users only through a Desktop release. An explicit "install in terminal"
action can be offered to anyone who wants the CLI on their own. Node 22.17+ and pnpm are still required on the
machine: `prumo new` runs `pnpm install`, and generated projects need Node regardless. The Desktop can only check
them.

**Affects:** packaging, the process layer

---

## 2026-09-17: 0.0.1 creates, follows and runs projects

**Decision:** 0.0.1 creates projects, lists and reads existing ones, and runs their apps.

**Options considered:**
- A) Create only.
- B) Create and follow.
- C) Create, follow and run.

**Reasoning:** C, chosen by the user.

**What it costs:** running apps is the most expensive part, and where desktop apps usually break: orphaned processes,
occupied ports, logs from several apps at once.

**Left out of 0.0.1:**

| Item | Why |
|---|---|
| `prumo update` | Open question in Prumo: a three-way merge over markdown the team owns |
| `prumo add` | Open question in Prumo: restructures code the team already wrote |
| "Project is outdated" | `.prumo/config.json` does not record the Prumo version |
| Live name validation | Would copy the CLI's rule |
| Port-based health | Would copy the templates' ports |
| Windows and Linux | See the platform decision |
| `prumo clean` | Used once per project, removes files, and the CLI already covers it. A Desktop-only user keeps the database script until running it in a terminal |

**Affects:** scope of every feature

---

## 2026-09-17: 0.0.1 ships for macOS only, and every choice supports macOS, Windows and Linux

**Decision:** version 0.0.1 targets macOS only. The Desktop **will be used on macOS, Windows and Linux**, so every
technology choice must support all three, even while a release targets fewer.

**Options considered:**
- A) macOS.
- B) macOS and Linux.
- C) macOS, Linux and Windows.

**Reasoning:** A for 0.0.1. Everything it has to prove is risky (process trees, pseudo terminals, `PATH`, Docker
detection), and every extra platform multiplies that risk by a system nobody tests daily. Windows changes exactly the
hardest parts. The three-platform constraint keeps that from becoming a dead end.

**What it costs:** Linux and Windows users stay on the CLI until a later version.

**Affects:** every technology choice

---

## 2026-09-17: Prerequisites come from `prumo doctor`, and are checked, never installed

**Decision:** the Desktop finds `node` through the shell's `PATH` itself, since nothing else runs without it.
Everything else comes from the embedded `prumo doctor --json`, run on launch and before creating: Node against its
floor, `pnpm` and `git` as required; Docker (installed apart from running), `psql` and a Postgres on
`localhost:5432` as warnings. `not_ready` blocks the action, with a link to instructions. The warnings are shown only
where the database is concerned; creating projects and running apps do not need them.

**Options considered:**
- A) Check and warn, through `prumo doctor`.
- B) Install Node or pnpm for the user.
- C) Offer a command to copy.
- D) The Desktop runs its own checks.

**Reasoning:** A. B competes with nvm, fnm or volta and makes the app responsible for the user's environment. C
depends on the user's version manager. D would be a second copy of the list the CLI already keeps.

**What it costs:** the places `doctor` looks for `psql` are all macOS paths (Homebrew, Postgres.app,
`/Library/PostgreSQL`); Windows and Linux need a change in Prumo.

**Affects:** the environment layer

---

## 2026-09-17: Creating a project runs `prumo new --json`, never in a pseudo terminal

**Decision:** a form runs the embedded `prumo new` with every flag and `--json`, as a plain child process. The result
is the JSON document on stdout; the log shown to the user is stderr. The CLI refuses an invalid name: `invalid_input`
is shown beside the name field and `target_not_empty` beside the folder. The result can be opened in Finder, in the
editor, or in a terminal.

**No CLI command the Desktop reads ever runs inside a pseudo terminal:** a pseudo terminal merges stdout and stderr,
which breaks reading the JSON document.

**Options considered:**
- A) `--json`, result from stdout, log from stderr.
- B) Human output, success decided by the exit code, errors read from text.

**Reasoning:** A. The CLI's error codes are a contract (renaming one is a breaking change in Prumo); its wording is
not. No copy of the name rule lives in the Desktop.

**What it costs:** a name error appears only after pressing "Create". A name that passes validation can still fail at
`pnpm install` (Prumo's open question about the name `ws`), so an install failure must be shown clearly. The Desktop
cannot show which step `new` is on, only its log, since Prumo's `--json` is one document per run.

**Affects:** the create form, the process layer

---

## 2026-09-17: The project list holds projects created or added by the user

**Decision:** a project is a folder containing `.prumo/config.json`. The list holds projects created by the app, plus
folders added through "Add folder", which are checked for `.prumo/config.json`. An entry whose folder no longer
exists is shown as "not found", and only the user removes it.

**Options considered:**
- A) Created and added folders.
- B) Scanning root folders.
- C) Removing missing entries automatically.

**Reasoning:** A. B is slow over `node_modules` and triggers macOS permission prompts for Documents and Desktop. C
would silently erase entries on a disconnected disk.

**What it costs:** a project created in a terminal appears only once the user adds it.

**Affects:** the project list

---

## 2026-09-17: `.prumo/` is read only in the Desktop

**Decision:** the knowledge base is read only, navigated from `INDEX.md`, with links between documents working inside
the app and an "Open in editor" button.

**Options considered:**
- A) Read only.
- B) With search.
- C) With editing.

**Reasoning:** A. The editor already searches. Editing turns the app into a markdown editor, and every edit deepens
the future `prumo update` merge problem.

**What it costs:** anyone who wants to search or change a document goes to the editor.

**Affects:** the document reader

---

## 2026-09-17: Each app runs separately, in its own pseudo terminal

**Decision:** a project is a set of **parts**. Its apps come from `types` in `.prumo/config.json` (an `alone` project
has one), plus a Database part when the project has a `docker-compose.yml`. The list shows a summary per project,
such as "2 of 3 running". Each app has its own start and stop buttons and its own terminal panel. The command follows
the architecture: `pnpm <app>` at a workspace root (which Prumo defines as `pnpm --filter <app> dev`), `pnpm dev` in
an `alone` project. "Run all" belongs to a project and starts each app separately.

State comes from the process: stopped, running, or failed (exited with an error, log available).

**Every app runs inside a pseudo terminal.** That is what lets Expo show its QR code, its `exp://` URL and its
keyboard shortcuts, which it hides without a terminal (measured in Prumo on 2026-09-17 under `pnpm dev`; expected,
not yet tested, for a process started by the Desktop). Using it for every app keeps one mechanism and preserves
colours.

**Options considered:**
- Running: A) one process per app; B) a single `pnpm dev`; C) both.
- State: A) from the process; B) port checks.
- Mobile output: A) pseudo terminal; B) plain log; C) opening the system terminal; D) drawing the QR in the Desktop.

**Reasoning:** A, A and A. A single `pnpm dev` gives one mixed log and cannot stop one app; both conflict over state
and ports. Port checks would copy every template's ports, which a team may change. A plain log has no QR, so physical
devices cannot connect; the system terminal is not a Desktop process and has no state; drawing the QR copies Expo's
logic.

**What it costs:** an app alive but not answering shows as "running". The Desktop knows only processes it started: an
app already running in a terminal shows as "stopped", and starting it again fails with a port conflict, visible in its
log. A native pseudo terminal dependency and a terminal component; logs become a terminal buffer, with limited
scrollback and terminal-style copy and search.

**Affects:** the process layer, the run panels

---

## 2026-09-17: Quitting stops every app's whole process tree

**Decision:** if apps are running, the Desktop asks for confirmation and stops them all, killing the **whole process
tree**, not only `pnpm`, which would leave Vite, Nest or Metro holding their ports.

**Options considered:**
- A) Confirm and stop everything.
- B) Keep running in the background.
- C) Ask each time.

**Reasoning:** A. B and C both leave orphans the Desktop cannot recognise when it reopens.

**What it costs:** closing the Desktop stops the development environment. A crash or a forced quit can still leave
orphans.

**Affects:** the process layer, app lifecycle

---

## 2026-09-17: The database is created through `prumo db`, and Docker is a part only when the project has it

**Decision:**
- **State:** the embedded `prumo db --check --json`, run with the project as its working directory. It answers
  `database_missing` while the API's `DATABASE_URL` is `MISSING`, and `ok` otherwise, so the Desktop never reads
  `.env`.
- **"Create database"** on the API part: a form (name; local or Docker; user and password when needed) that runs
  `prumo db --json` outside a pseudo terminal. It migrates as part of creating.
- **Running the API without a database:** the `--check` question that the API's `dev` asks appears in its terminal
  panel, and the user answers it there.
- **Docker:** only when the project has a `docker-compose.yml`, a Database part with its state read from
  `docker compose ps` and buttons to start and stop. It keeps running when the Desktop quits; its state comes from
  Docker, so the Desktop recognises it on reopening, including a container started from a terminal.
- **Migrations** stay an explicit button on the API part, running the project's own `pnpm db:migrate`.

**Options considered:**
- A) As above.
- B) Leave the database to the user.
- C) The API's "Run" does everything.
- D) Read `.env` for `MISSING`.
- E) Docker only, the model before Prumo moved database setup into the project.

**Reasoning:** A. With B the API's first run stops on `MISSING`. C migrates on every start without being asked. D
copies the template's knowledge. E no longer matches Prumo, which uses a local Postgres first.

**What it costs:** `--check` does not appear in `prumo db --help`; it is passed through to the project's script, so the
Desktop depends on behaviour the CLI does not document. When Docker is used, one more stateful part: a container keeps
memory and the Postgres port after the app closes, so two projects on the same port conflict.

**Affects:** the API part, the Database part

---

## 2026-09-17: On macOS, distributed outside the App Store, signed and notarised before the public release

**Decision:** the user downloads an installer from outside the store. During development and for early testers the
app is **not signed**: a build made on the developer's machine is not quarantined, so Gatekeeper does not block it,
and a tester who downloads it allows it once in System Settings → Privacy & Security → "Open Anyway", with an
administrator password (the Control-click shortcut was removed in macOS Sequoia). **Before the public release** the
app is signed with a Developer ID certificate and notarised. **The first notarisation is attempted well before the
release**, since the native pseudo terminal module is where notarisation usually fails (from memory, not read in
Apple's documentation, which did not load: hardened runtime, every binary in the bundle signed, entitlements).

**Options considered:**
- A) Outside the store, unsigned in development, signed before release.
- B) The Mac App Store.
- C) Unsigned for good.

**Reasoning:** A. The Mac App Store requires App Sandbox, which restricts running programs outside the app bundle,
and the Desktop must run the user's Node, pnpm and Docker (this follows from the sandbox's general rule; the exact
restrictions were not read). With C every user goes through "Open Anyway", and automatic updates do not work.

**What it costs:** US$ 99 per year for the Apple Developer Program, which covers any number of apps (no limit is
mentioned in Apple's program pages). About a day of setup the first time: certificate, notarisation credentials, CI
secrets. No automatic updates until the app is signed (Electron: "Squirrel.Mac requires the app to be signed for
automatic updates to work at all").

**Affects:** packaging, CI, releases

---

## 2026-09-17: Developer and store accounts are always individual

**Decision:** accounts are always individual, for Apple and for any other store or signing service.

**Options considered:**
- A) Individual.
- B) Organisation (D-U-N-S Number, legal entity, email and public website on its domain).

**Reasoning:** A, chosen by the user.

**What it costs:** Apple shows the user's personal legal name as the developer, not a brand. Moving to an
organisation later would change the signing identity for existing users.

**Affects:** signing, store listings

---

## 2026-09-17: Windows through the Microsoft Store, Linux unsigned, and Apple is the only paid signing

**Decision:** the app is published from Brazil to users worldwide, and only Apple signing is paid. For when they are
targeted:
- **Windows:** the Microsoft Store with an MSIX package, **conditional on a spike** proving that an MSIX-packaged
  Desktop can run the user's `node`, `pnpm` and `docker`, open a pseudo terminal and read `PATH`.
- **Linux:** AppImage, `.deb` or `.rpm`, unsigned.

**Options considered (Windows):**
- A) Microsoft Store.
- B) Azure Artifact Signing.
- C) An OV or EV certificate from a certificate authority.
- D) An unsigned installer.

**Reasoning:** A. Registration is free for individuals; Microsoft signs Store apps, so SmartScreen shows no warning,
and updates come through Windows; Electron apps are accepted. B's public trust is not available from Brazil
(individuals: United States and Canada; organisations: a list of countries without Brazil), and a signed app still
warns until reputation builds. C is paid, and since 2024 neither type skips SmartScreen for a new app. D shows
"Windows protected your PC" with "Run anyway", and Windows 11's Smart App Control blocks it without that option.

**What it costs:** if the MSIX spike fails, Windows has no warning-free path without paying, and the choice returns.
Electron has no built-in automatic updates on Linux.

**Affects:** packaging for Windows and Linux

---

## 2026-09-17: The framework is Electron

**Decision:** Electron, with `node-pty` for pseudo terminals and `fix-path` for the shell's `PATH`.

Checked against each option's own documentation for macOS, Windows and Linux:

| Requirement | Electron | Tauri |
|---|---|---|
| Pseudo terminal | `node-pty` (Microsoft): Linux, macOS, Windows 10 1809+ through ConPTY. Electron Forge rebuilds native modules automatically | Community `tauri-plugin-pty` 0.1.1, or `portable-pty` (WezTerm) with our own Rust. The official `shell` plugin has none |
| Killing the process tree | macOS and Linux: `node-pty` starts the child as a session leader (`POSIX_SPAWN_SETSID` on macOS, `forkpty` on Linux, read in its source), so the group can be signalled. Windows has no process groups: `taskkill /pid <pid> /t /f` ends a process and its children | Not offered by the `shell` plugin; to be written in Rust |
| Running the embedded CLI with the system's Node | `spawn('node', [cli])`. `spawn` cannot run files inside the ASAR archive, so the CLI ships outside it | Bundled as resources, resolved with `resolveResource` |
| Shell `PATH` | `fix-path` covers macOS and Linux, **not Windows** | `fix-path-env-rs` (official) covers all three |
| Signing | `@electron/osx-sign` and `@electron/notarize`; `node-pty` adds a `.node` and a `spawn-helper` to sign | A single binary, fewer native files |
| Automatic updates | macOS requires signing (Squirrel.Mac); Windows: Squirrel.Windows or MSIX; **Linux: none built in** | Own updater with its own mandatory signature |

**Options considered:**
- A) Electron.
- B) Tauri.

**Reasoning:** A. The riskiest part of 0.0.1, pseudo terminals and process groups, exists ready in `node-pty` on all
three systems, while Tauri would need it written in Rust over a 0.1.1 plugin. The Desktop stays in one language,
TypeScript, like Prumo. Tauri's advantages, simpler notarisation and an updater that does not need Apple's signature,
weigh little once signing is decided.

**What it costs:**
- A large app, since Chromium is bundled (size not verified).
- A native module rebuilt on every Electron upgrade, and extra binaries to sign.
- `fix-path`'s README warns: "Packaged Electron apps launched from Finder may not quit properly", which conflicts with
  stopping everything on quit.
- Two implementations of killing a process tree: process group on macOS and Linux, `taskkill /t` on Windows.
- On Windows, a Node set up by fnm or nvm in a PowerShell profile is invisible to an app opened from the Start menu,
  and `fix-path` does nothing there.
- Linux automatic updates need their own solution.

**Affects:** the whole application

---

## 2026-09-17: The UI follows Prumo's `web` template, with xterm.js, built by Electron Forge

**Decision:** the renderer follows Prumo's `templates/web`: React, Vite, TanStack Router and Query, Tailwind, shadcn
(Base UI), react-hook-form with zod, Biome and Vitest, leaving out `better-auth` and `api-contract`, since the Desktop
has no backend. It adds `@xterm/xterm` with its `fit` and `search` addons for the terminal panels. The build is
Electron Forge with its Vite plugin.

**Options considered:**
- Stack: A) Prumo's `web` template; B) something else.
- Build: A) Electron Forge with its Vite plugin; B) `electron-vite`.

**Reasoning:** A and A. The same conventions as Prumo, no new library to learn, and all of it is web code, identical on
the three systems. xterm.js is the terminal VS Code uses and is designed to be fed by `node-pty`. Forge already
rebuilds `node-pty` and signs and notarises; `electron-vite` states "Vite 5.0+" without mentioning 8, and does not
package or sign.

**What it costs:** Forge's Vite plugin is experimental ("future minor releases may contain breaking changes") and does
not state which Vite versions it supports, while the template uses Vite 8. A packaged renderer loads from `file://`,
which (from memory, not verified) needs hash history in TanStack Router.

**Affects:** the renderer, the build

---

## 2026-09-17: The repository starts public, MIT, with documentation only

**Decision:** `stjosephworks/prumo-desktop`, public, under the MIT license like Prumo. The first commit holds only
`README.md`, `LICENSE`, `docs/DECISIONS.md` and `docs/OPEN-QUESTIONS.md`, in Prumo's formats. Code starts with the
spike.

**Options considered:**
- Location: A) `stjosephworks/prumo-desktop`; B) local only for now.
- Visibility: A) public; B) private until release.
- Decision log: A) Prumo's format, one entry per decision; B) the planning notes copied as they were.
- First commit: A) documentation only; B) documentation and an Electron skeleton.

**Reasoning:** A, A, A and A. The same organisation, visibility and license as Prumo. One entry per decision keeps what
each one costs next to it. A skeleton before the spike would commit to Forge's Vite plugin before it is proven to work
with Vite 8.

**What it costs:** nothing runs yet.

**Affects:** the repository

---

## 2026-09-17: The database is always Prumo's Docker one, and "Create database" asks only for a name

**Decision:** following Prumo's decision "The development database is always the Docker one" (Prumo commit
`cb33307`, published in `@stjoseph/prumo` 0.0.5):
- **"Create database"** on the API part asks only for a name, and runs `prumo db --name <name> --json` outside a
  pseudo terminal. The script picks a free port on its own and keeps it in `POSTGRES_PORT`; `--port` is not offered.
- `docker_missing` and `docker_not_running` from `prumo db` are shown as such: not installed apart from not running.
- **The Database part exists whenever the project has an API,** since every API template carries its
  `docker-compose.yml`. Its state still comes from `docker compose ps`, and it keeps running when the Desktop quits.
- State and the `--check` question inside the API's terminal are unchanged.

**Options considered:**
- A) Follow Prumo: Docker only, a name only.
- B) Keep offering a local Postgres from the Desktop.

**Reasoning:** A. The Desktop is a consumer: `prumo db` no longer accepts `--local`, `--host`, `--user` or
`--password`, so B would mean a second implementation.

**What it costs:** Docker becomes necessary for any project with an API, not only for one choice of server. Anyone who
prefers their own Postgres edits `.env` by hand, outside the Desktop.

**Amends:** "The database is created through `prumo db`, and Docker is a part only when the project has it", whose
form choices (local or Docker, user and password) are removed; and "Prerequisites come from `prumo doctor`", whose
cost about `psql` locations no longer applies, since `doctor` stopped checking `psql` and a local server.

**Affects:** the API part, the Database part, the environment layer

---

## 2026-09-17: The spike proved the risky parts on macOS, at the cost of four workarounds

**Decision:** the framework, UI stack and process decisions stand. The spike (branch `spike`, folder `spike/`) was
packaged with Electron Forge and opened **through Finder**, and passed every proof:

| Proof | Observed |
|---|---|
| `PATH` from Finder | Before `fix-path`, `PATH` was `/usr/bin:/bin:/usr/sbin:/sbin` and nvm's Node was invisible; after it, Node v24.19.0 was found |
| Quitting from Finder | With the web app running, the app quit, no process was left and port 5173 was free. `fix-path`'s warning did not reproduce |
| Embedded CLI | `@stjoseph/prumo` 0.0.5 in `Contents/Resources/prumo`, run with the system's Node: `new --json` returned its document on stdout and its log on stderr; `invalid_input` for "Bad Name"; `db --check --json` answered `database_missing`, then `ok` after `db --json` created and migrated the database (on port 5435, then 5436, since lower ports were taken) |
| Expo in a pseudo terminal | QR code, `exp://` URL, shortcuts and colours rendered in xterm.js (checked on a screenshot). Expo's "Use port 8082 instead?" was answered by writing to the terminal |
| Stopping a process tree | web, api and mobile each ran in **one process group** (5, 9 and 7 processes). SIGTERM to the group was enough, no SIGKILL; no survivor; ports 5173, 3100 and 8082 free |
| Forge's Vite plugin on Vite 8 | Builds and renders packaged; one deprecation warning (`inlineDynamicImports`) |
| TanStack Router from `file://` | Hash history navigated to `#/terminal` |

**Options considered:**
- A) Keep the decisions, with the workarounds below.
- B) Reopen the framework or the build.

**Reasoning:** A. Every workaround is a few lines of build configuration, none touches the application's design.

**What it costs:**
- **Forge's Vite plugin packages only its bundles, never `node_modules`**, despite its documentation saying native
  modules "will mostly work out of the box". `node-pty` is copied in by a `packageAfterCopy` hook, left outside
  `app.asar` (`asar.unpack`), and copied without `binding.gyp`, so Forge does not try to rebuild it (its N-API
  prebuilds already match).
- **`node-pty` 1.1.0 installs `spawn-helper` without the executable bit**, so spawning fails with
  `posix_spawnp failed`; the hook sets it.
- **`node-pty` has prebuilds for macOS and Windows only.** Linux will compile it, which needs `node-addon-api` and a
  toolchain in CI.
- **pnpm 12** needs `blockExoticSubdeps: false` (Forge's `@electron/rebuild` depends on `@electron/node-gyp` from a git
  repository) and `allowBuilds` for `electron` and `node-pty`, in `pnpm-workspace.yaml`, with `nodeLinker: hoisted`.
- **The packaged app is 349 MB** on arm64, the embedded CLI and its templates included.
- **`open` from a terminal passes the caller's environment** to the app, so it cannot test `PATH`; only Finder (or an
  AppleScript asking Finder to open it) reproduces a user's launch. An inherited `ELECTRON_RUN_AS_NODE=1` made the app
  run as plain Node and exit silently.

**Affects:** `forge.config.js`, the build, CI, testing a packaged build

---

## 2026-09-17: One application at the repository root, split by process, with a single IPC contract

**Decision:** one Electron application at the repository root, not a workspace. The code is split by Electron
process:
- `src/main`: the environment layer (`PATH`, `prumo doctor`), the process layer (pseudo terminals, process groups)
  and every call to the embedded CLI.
- `src/preload`: the bridge, and nothing else.
- `src/renderer`: the interface, following Prumo's `web` template.
- `src/shared`: **one file holding the IPC contract**, imported by all three. The renderer never touches Node
  directly: no `nodeIntegration`, `contextIsolation` on, everything through the preload bridge.

Tooling follows Prumo: Biome with the same configuration, Vitest, TypeScript strict.

**From the spike, kept:** `forge.config.js` (the `node-pty` copy, `asar.unpack` and the `spawn-helper` permission),
`scripts/embed-cli.mjs`, and the shape of starting and stopping a process group. Everything else is rewritten with
tests.

**Options considered:**
- Layout: A) one app at the root; B) a workspace (`apps/desktop`, `packages/*`) like a generated Prumo project.
- Reuse: A) keep the build configuration and rewrite the rest; B) grow the spike into the app.
- IPC types: A) one shared file; B) types declared on each side.

**Reasoning:** A, A and A. There is one artefact, so a workspace would add manifests and a build graph for nothing.
The spike's code answers questions and has no tests, but its build configuration is exactly the knowledge worth
keeping. One shared file makes a change in the contract a type error on both sides.

**Tests:** the process layer is tested with **real processes** (start a server, stop the group, check the port is
free) and the CLI layer against the **embedded CLI itself** (`version`, `doctor`, an invalid name), never mocks of
either. A packaged build is still checked by opening it through Finder, as the spike did.

**What it costs:** tests that start processes and run the CLI are slower than unit tests and depend on the machine
(Node, pnpm, ports). If the interface ever needs its own package, the layout has to change.

**Found while building it, on 2026-09-17:**
- **Forge builds the main process as CommonJS**, where `import.meta.dirname` is undefined: the packaged app failed
  to find its preload and its HTML. It uses `__dirname`.
- Forge names each bundle after its entry file, so `src/main/index.ts` and `src/preload/index.ts` would both be
  `index.js`. The entries are `main.ts` and `preload.ts`.
- **Every `pnpm install` resets `spawn-helper`'s executable bit**, so a `postinstall` script restores it, as
  `forge.config.js` does for the packaged copy.
- `pnpm smoke` was added for what unit tests cannot see: it starts the **packaged** app with the environment an app
  opened from Finder gets (`PATH=/usr/bin:/bin:/usr/sbin:/sbin`), and asks the renderer, over the remote debugging
  protocol, what the bridge returned and what the window shows. No code exists in the app for its sake.

**Affects:** the repository layout, `src/**`, `forge.config.js`, `biome.jsonc`, `vitest.config.ts`,
`scripts/smoke.mjs`
