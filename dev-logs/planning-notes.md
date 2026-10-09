# Prumo Desktop: Planning Notes

> Discussed on 2026-09-17, inside the Prumo repository, before any code or repository exists.
> Nothing here is built. Every decision below was confirmed by the user, one at a time.

---

## 1. What Prumo Desktop is

A desktop application for Prumo, living in its **own repository**, separate from `prumo`.

It is a **consumer** of Prumo, never a second implementation of it. It uses only what the published CLI
already offers: the `prumo` binary with its flags, and the files a generated project carries
(`.prumo/config.json`, `.prumo/INDEX.md`, the knowledge base, the project's `package.json` scripts and its
`docker-compose.yml`).

**Core rule:** consistency comes from structure. Because the repositories are separate, the Desktop cannot import
the CLI's internals; running the CLI is the only path it has.

---

## 2. Relationship with the CLI

### Separate repository

| | Inside `prumo` | Separate repository (chosen) |
|---|---|---|
| Build and CI | Native builds, signing and packaging added to a repository of markdown, templates and a small CLI | Each repository keeps its own CI |
| Releases | A visual bug forces a CLI release, or two version lines in one repository | Each ships when it needs to |
| Shared types | Imported directly | Not available; the CLI is the contract |
| Discipline | Easy to reach into CLI internals "just once" | The Desktop sees only what the CLI deliberately exposes |

**What it costs:** the Desktop cannot reuse `AppType`, `Answers` or `validateProjectName`. Anything it needs from
the CLI has to be exposed by the CLI.

### The CLI is embedded, not installed globally

The Desktop ships a **pinned version** of `@stjoseph/prumo` and runs that copy.

**Rejected:** installing the CLI globally. It touches the user's `PATH` and global npm, may need administrator
rights, may collide with a `prumo` the user already has at another version, and survives uninstalling the app.

**What it costs:** a CLI fix reaches Desktop users only through a Desktop release. An explicit "install in terminal"
action can be offered to anyone who wants the CLI on their own.

**Still required on the machine:** Node 22.17+ and pnpm. `prumo new` runs `pnpm install`, and generated projects
need Node regardless. The Desktop cannot remove this requirement, only check it.

### Facts verified in the CLI source (2026-09-17)

- Every question has a flag, and outside an interactive terminal a missing answer is an **error**, not a prompt.
- Output is written for humans (`@clack/prompts`), and `pnpm install` runs with `stdio: 'inherit'`.
- The project name is validated before anything is written to disk.
- `.prumo/config.json` holds `types`, `architecture` and `multiTenant`, and **not the Prumo version**.

### CLI changes the same day, after the notes above (commit `7de3f5a`)

Read in Prumo's `docs/DECISIONS.md` and `cli/src`. **Some decisions below predate them and are under review.**

- **Every command takes `--json`:** stdout carries exactly one document, `{ ok: true, command, data }` or
  `{ ok: false, command, error: { code, message } }`; nothing is asked; the output of `git`, `pnpm install`, `docker`
  and migrations goes to stderr; the exit code is 0 exactly when `ok` is true. Error codes are a contract, such as
  `usage`, `needs_input`, `invalid_input` (an invalid project name among them), `target_not_empty`, `not_a_project`,
  `no_api` and `not_ready`. The first statement above about human-only output no longer holds.
- **`prumo doctor`** checks Node against its floor, `pnpm` and `git` as required, and Docker (installed apart from
  running), `psql`, a server on `localhost:5432` and a route to a database, as warnings.
- **The database moved into the project.** A new API has `DATABASE_URL=MISSING`. `scripts/database.mjs` (also run by
  `prumo db`) uses a local Postgres first and the `docker-compose.yml` service otherwise, writes the URLs into `.env`
  and migrates. The API's `dev`, and a workspace root's `dev`, run it with `--check` first, which **asks in a
  terminal** whether to create the database. The root's per-app script is `pnpm --filter <app> dev`.
- **`prumo clean`** removes that one-time database setup from a project.

---

## 3. Decisions for Desktop 0.0.1

### Scope: create, follow and run

0.0.1 creates projects, lists and reads existing ones, and runs their apps.

**Options considered:** create only; create and follow; create, follow and run.
**What it costs:** running apps is the most expensive part, and where desktop apps usually break: orphaned
processes, occupied ports, logs from several apps at once.

### Platform: macOS only

**Options considered:** macOS; macOS and Linux; macOS, Linux and Windows.
**Reasoning:** everything 0.0.1 has to prove is risky (process trees, pseudo terminals, `PATH`, Docker detection),
and every extra platform multiplies that risk by a system nobody tests daily. Windows changes exactly the hardest
parts.
**What it costs:** Linux and Windows users stay on the CLI.

**Constraint (confirmed 2026-09-17):** the Desktop **will be used on macOS, Windows and Linux**. Every technology
choice must support all three, even while a release targets fewer. **0.0.1 stays macOS only** (reconfirmed the
same day).

### Prerequisites: check and warn, never install

- The Desktop finds **`node`** through the shell's `PATH` itself, since nothing else can run without it.
- Everything else comes from the embedded **`prumo doctor --json`** (revised 2026-09-17), run on launch and before
  creating: Node against its floor, `pnpm` and `git` as required, Docker (installed apart from running), `psql` and
  a Postgres on `localhost:5432` as warnings. `not_ready` blocks the action, with a link to instructions.
- The warnings about Docker, `psql` and Postgres are shown only where the database is concerned. Creating projects
  and running apps do not need them.

**What it costs:** the places `doctor` looks for `psql` are all macOS paths (Homebrew, Postgres.app,
`/Library/PostgreSQL`); Windows and Linux need a change in Prumo.

**Rejected:** installing Node or pnpm (competes with nvm, fnm or volta, and makes the app responsible for the
user's environment); offering a command to copy (the right command depends on the user's version manager).

### Creating a project

- A form that runs the embedded `prumo new` with **every flag** and **`--json`** (revised 2026-09-17), without a
  terminal.
- The result is the JSON document on stdout; the log shown to the user is stderr.
- The **CLI refuses an invalid name**: `invalid_input` is shown beside the name field, `target_not_empty` beside the
  folder. No copy of the rule lives in the Desktop.
- The result can be opened in Finder, in the editor, or in a terminal.

**What it costs:** a name error appears only after pressing "Create". A name that passes validation can still fail
at `pnpm install` (see Prumo's open question about the name `ws`), so an install failure must be shown clearly.
The Desktop cannot show which step `new` is on, only its log (a consequence of Prumo's one-document `--json`).

**Constraint:** `prumo new` (and every CLI command the Desktop reads) must **never** run inside a pseudo terminal.
A pseudo terminal **merges stdout and stderr**, which breaks reading the JSON document. (The earlier reason, the CLI
waiting silently for an answer, is already prevented by `--json`.)

### Project list

- A project is a folder containing `.prumo/config.json`.
- The list holds projects **created by the app**, plus folders added through **"Add folder"**, which are checked
  for `.prumo/config.json`.
- An entry whose folder no longer exists is shown as **"not found"**. Only the user removes it.

**Rejected:** scanning root folders (slow over `node_modules`, and triggers macOS permission prompts for
Documents and Desktop); removing missing entries automatically (a disconnected disk would erase them silently).

### Reading `.prumo/`

Read only, navigated from `INDEX.md`, with links between documents working inside the app and an "Open in editor"
button.

**Rejected:** search (the editor already has it); editing (turns the app into a markdown editor, and every edit
deepens the future `prumo update` merge problem).

### Running apps

**Model:** a project is a set of **parts**. Its apps come from `types` in `config.json` (an `alone` project has one),
plus a **Database** part when the project has a `docker-compose.yml`. The list shows a summary per project, such as
"2 of 3 running".

**Per app:**
- Its own start and stop buttons and its own terminal panel.
- The command follows the architecture: `pnpm <app>` at a workspace root, `pnpm dev` in an `alone` project.
- "Run all" belongs to a project and starts each app separately.

**Rejected:** a single `pnpm dev` (one mixed log, cannot stop one app); both (conflicting states and ports).

**State comes from the process:** stopped, running, or failed (exited with an error, log available).

**Rejected:** port checks (the Desktop would hold a copy of every template's ports, which a team may change).
**What it costs:** an app that is alive but not answering shows as "running".
**Consequence:** the Desktop knows only processes it started. An app already running in a terminal shows as
"stopped", and starting it again fails with a port conflict, visible in its log.

**Every app runs inside a pseudo terminal.** This is what lets Expo show its QR code, its `exp://` URL and its
keyboard shortcuts, which it hides without a terminal (measured in Prumo on 2026-09-17 under `pnpm dev`; expected,
**not yet tested**, for a process started by the Desktop). Using it for every app keeps one mechanism and preserves
colours.

**Rejected for mobile:** plain log (no QR, physical devices cannot connect); opening the system terminal (not a
Desktop process, no state); drawing the QR in the Desktop (copies Expo's logic).
**What it costs:** a native pseudo terminal dependency and a terminal component in the interface. Logs become a
terminal buffer, with limited scrollback and terminal-style copy and search.

**Quitting:** if apps are running, the Desktop asks for confirmation and stops them all, killing the **whole process
tree**, not only `pnpm`, which would leave Vite, Nest or Metro holding their ports.
**Rejected:** running in the background or asking each time (both leave orphans the Desktop cannot recognise when
it reopens).
**What it costs:** closing the Desktop stops the development environment. A crash or a forced quit can still leave
orphans.

### Database

Revised 2026-09-17, after the database setup moved into the generated project (see "CLI changes the same day").

- **State:** the embedded `prumo db --check --json`, run with the project as its working directory. It answers
  `database_missing` while the API's `DATABASE_URL` is `MISSING`, and `ok` otherwise, so the Desktop never reads
  `.env`.
- **"Create database"** on the API part: a form (name; local or Docker; user and password when needed) that runs
  `prumo db --json` without a pseudo terminal. It migrates as part of creating.
- **Running the API without a database:** the `--check` question appears in the API's terminal panel, and the user
  can answer it there, since that panel is a pseudo terminal.
- **Docker:** only when the project has a `docker-compose.yml`, a Database part with its state read from
  `docker compose ps` and buttons to start and stop. It **keeps running when the Desktop quits**; its state comes
  from Docker, so the Desktop recognises it on reopening, including a container started from a terminal.
- **Migrations** stay an **explicit button** on the API part, running the project's own `pnpm db:migrate`.

**Rejected:** leaving the database to the user (the API's first run stops on `MISSING`); making the API's "Run" do
everything (migrates on every start without being asked); reading `.env` for `MISSING` (a copy of the template's
knowledge); the Docker-only model of the first notes (the CLI now prefers a local Postgres).

**What it costs:**
- `--check` does not appear in `prumo db --help`; it is passed through to the script. The Desktop depends on
  behaviour the CLI does not document.
- One more stateful part when Docker is used; a container keeps memory and the Postgres port after the app closes,
  so two projects on the same port conflict.

### Distribution: outside the Mac App Store, signed before the public release

- The user downloads an installer from outside the store and installs it.
- **During development and for early testers**, the app is **not signed**. A build made on the developer's own
  machine is not quarantined, so Gatekeeper does not block it. A tester who downloads it must allow it once in
  **System Settings → Privacy & Security → "Open Anyway"**, confirming with an administrator password (the
  Control-click shortcut was removed in macOS Sequoia).
- **Before the public release**, the app is signed with a **Developer ID** certificate and **notarised**. The user
  will enrol in the Apple Developer Program.
- The **first notarisation is attempted well before the release**, not on its eve: the native pseudo terminal
  module is where notarisation usually fails (hardened runtime, every binary in the bundle signed, entitlements).

**Rejected:** the Mac App Store (it requires App Sandbox, which restricts running programs outside the app bundle,
and the Desktop must run the user's Node, pnpm and Docker; this follows from the sandbox's general rule, the exact
restrictions were not read in Apple's documentation); distributing unsigned for good (every user goes through the
"Open Anyway" flow, and automatic updates do not work).

**What it costs:** US$ 99 per year; about a day of setup the first time (certificate, notarisation credentials, CI
secrets); no automatic updates until the app is signed (Electron's documentation: "Squirrel.Mac requires the app to
be signed for automatic updates to work at all").

**Accounts are always individual** (confirmed 2026-09-17), for Apple and for any other store or signing service.

**What it costs:** Apple shows the user's personal legal name as the developer, not a brand. Moving to an
organisation later (D-U-N-S Number, legal entity, domain email and website) would change the signing identity for
existing users.

### Distribution on Windows and Linux (for when they are targeted)

The app is published **from Brazil** to users worldwide. **Apple is the only paid signing.**

**Windows: Microsoft Store (MSIX), conditional on a spike.**
- Registration is free for individuals and companies. Microsoft signs Store apps, so SmartScreen shows no warning,
  and updates come through Windows. Electron apps are accepted.
- **Condition:** a spike must prove that an MSIX-packaged Desktop can run the user's `node`, `pnpm` and `docker`,
  open a pseudo terminal and read `PATH`. Not verified yet.

**Rejected:**
- Azure Artifact Signing: public trust is not available from Brazil (individuals: United States and Canada only;
  organisations: a list of countries that excludes Brazil), and a signed app still warns until reputation builds.
- Buying an OV or EV certificate: paid, and since 2024 neither type skips SmartScreen for a new app.
- Unsigned installer as the main channel: "Windows protected your PC" with "Run anyway", and on Windows 11 with
  Smart App Control the file is blocked without that option.

**What it costs:** if the MSIX spike fails, Windows has no warning-free path without paying, and the choice returns.

**Linux:** AppImage, `.deb` or `.rpm`, no signing required. No built-in automatic updates in Electron.

### Framework: Electron

Checked on 2026-09-17 against each option's own documentation, for macOS, Windows and Linux.

| Requirement | Electron (chosen) | Tauri |
|---|---|---|
| Pseudo terminal | `node-pty` (Microsoft): Linux, macOS, Windows 10 1809+ via ConPTY. Electron Forge rebuilds native modules automatically | Community `tauri-plugin-pty` 0.1.1, or `portable-pty` (WezTerm) with our own Rust. The official `shell` plugin has no pseudo terminal |
| Killing the process tree | macOS and Linux: `node-pty` starts the child as a session leader (`POSIX_SPAWN_SETSID` on macOS, `forkpty` on Linux, read in its source), so the whole group can be signalled. Windows has no process groups: `taskkill /pid <pid> /t /f` ends a process and its children | Not offered by the `shell` plugin; to be written in Rust |
| Running the embedded CLI with the system's Node | `spawn('node', [cli])`. `spawn` cannot run files inside the ASAR archive, so the CLI ships outside it (extra resource or unpacked) | Bundled as resources, resolved with `resolveResource` |
| Shell `PATH` | `fix-path` covers macOS and Linux. **Windows is not covered** (see below) | `fix-path-env-rs` (official) covers all three |
| Signing | `@electron/osx-sign` and `@electron/notarize`; `node-pty` adds a `.node` and a `spawn-helper` to sign. Windows needs a certificate or Azure Artifact Signing to avoid SmartScreen. Linux: no signing guidance | A single binary, fewer native files to sign |
| Automatic updates | macOS: requires signing (Squirrel.Mac). Windows: Squirrel.Windows or MSIX. **Linux: no built-in support**, the distribution's package manager is recommended | Own updater with its own mandatory signature |

**Reasoning:** the riskiest part of 0.0.1 (pseudo terminal and process groups) exists ready in `node-pty` on all
three systems, while Tauri would need it written in Rust over a 0.1.1 plugin. The Desktop stays in one language,
TypeScript, like Prumo.

**Rejected:** Tauri (Rust in the most delicate layer; its advantages, simpler notarisation and an updater that does
not need Apple's signature, weigh little once signing is decided).

**What it costs:**
- A large app, since Chromium is bundled (size not verified).
- A native module rebuilt on every Electron upgrade, and extra binaries to sign.
- `fix-path`'s own README warns: "Packaged Electron apps launched from Finder may not quit properly". This conflicts
  with "quitting stops every app" and must be tested in the spike.
- Killing the process tree has two implementations: process group on macOS and Linux, `taskkill /t` on Windows.
- Windows `PATH`: a Node set up by fnm or nvm in a PowerShell profile is invisible to an app opened from the Start
  menu, and `fix-path` does nothing there. Not solved; to be checked when Windows is targeted.
- Linux automatic updates need their own solution.

### UI stack: Prumo's own `web` template

The renderer follows `templates/web`: React, Vite, TanStack Router and Query, Tailwind, shadcn (Base UI),
react-hook-form with zod, Biome and Vitest. It leaves out `better-auth` and `api-contract`, since the Desktop has no
backend. It adds `@xterm/xterm` with its `fit` and `search` addons for the terminal panels; xterm.js is the terminal
VS Code uses and is designed to be fed by `node-pty`.

**Reasoning:** the same conventions as Prumo, no new library to learn, and all of it is web code, identical on the
three systems.

**Build:** Electron Forge with its Vite plugin, since Forge already rebuilds `node-pty` and signs and notarises.

**What it costs:**
- Forge's Vite plugin is **experimental** ("future minor releases may contain breaking changes") and its
  documentation does not state which Vite versions it supports; the template uses Vite 8. To be proven in the spike.
  The alternative, `electron-vite`, states "Vite 5.0+" without mentioning 8, and does not package or sign.
- A packaged renderer loads from `file://`, which (from memory, not verified) needs hash history in TanStack Router.

---

## 4. Out of 0.0.1

| Item | Why it is out |
|---|---|
| `prumo update` | Open question in Prumo: a three-way merge over markdown the team owns |
| `prumo add` | Open question in Prumo: restructures code the team already wrote |
| "Project is outdated" | `config.json` does not record the Prumo version |
| Live name validation | Would copy the CLI's rule |
| Port-based health | Would copy the templates' ports |
| Linux and Windows | See the platform decision |
| `prumo clean` | Used once per project, removes files, and the CLI already covers it. A Desktop-only user keeps the database script until running it in a terminal |

---

## 5. Still open

| Topic | Why it matters |
|---|---|
| **Automatic updates** | Mechanism depends on the framework; requires the app to be signed |
| **Shell `PATH` on Windows** | `fix-path` covers macOS and Linux only. A Node set up by fnm or nvm in a PowerShell profile is invisible to an app opened from the Start menu |
| **MSIX on Windows** | Whether a Store-packaged Desktop can run the user's tools and a pseudo terminal; decides the Windows distribution path |
| **Where these decisions live** | The new repository needs its own decision log. This file is a starting point, not that log |

### Future needs on the Prumo side

Not to be changed now. Each would become a question in Prumo's `docs/OPEN-QUESTIONS.md` when the user decides.

- ~~**Machine-readable CLI output.**~~ Done in Prumo on 2026-09-17: `--json` on every command.
- **Document `prumo db --check`**, which the Desktop uses to tell whether the database is missing.
- **`prumo doctor` on Windows and Linux**: its `psql` locations are macOS paths only.
- **The `--check` question's wording**: it asks "Create a development database in Docker now?", while the script
  tries a local Postgres first.
- **The Prumo version in `.prumo/config.json`**, so the Desktop can tell whether a project is outdated.
- **Validating a name without generating**, so the Desktop can validate while the user types without copying the
  rule.

---

## 6. Next steps

1. ~~**Choose the Desktop framework.**~~ Electron, see the framework decision.
2. ~~**Choose the UI stack.**~~ Prumo's `web` template plus xterm.js, see the UI stack decision.
2a. ~~**Review the decisions affected by the CLI changes**~~ of 2026-09-17: prerequisites, creating, database and
   `prumo clean` revised.
3. **Create the repository** and move these decisions into its decision log, keeping what each one costs.
4. **Build a spike that proves the risky parts** before any interface: find Node through the shell's `PATH`, run the
   embedded `prumo new --json` without a terminal and read its document, run `pnpm mobile` in a pseudo terminal and confirm the QR code appears,
   and stop an app leaving no process on its port.
5. **Sign and notarise a first build** once the Apple membership exists, well before the release, to prove the
   native pseudo terminal module passes notarisation.
6. **Decide whether to open the Prumo-side questions** listed in section 5.
