# Prumo Desktop

A desktop application for [Prumo](https://github.com/stjosephworks/prumo), in Electron. Read this file before
changing anything.

## What this repository is

The Desktop is a **consumer** of Prumo, never a second implementation of it. It ships a pinned copy of the
`@stjoseph/prumo` CLI and runs it; everything it knows about a project comes from what that CLI exposes and from
the files a generated project carries.

**The rule that follows from it:** when something is missing, the answer is to expose it in Prumo, not to
reimplement it here.

## History

`dev-logs/` holds how the Desktop was decided, kept for context and referenced by nothing. Read it to understand
why something is the way it is, never to learn what is in force, and do not append to it: what is in force is the
code, this file and the README.

## Language

| What | Language |
|---|---|
| Every file in this repository, every identifier, comment and commit message | **English** |
| Conversation with the user | **Portuguese (pt-BR)** |

Never mix the two inside a file.

## Ask before you write

The user is the architect. Surface each decision as it appears, **one at a time**, with the real options, their
costs, and a recommendation. Wait for the answer before writing it down.

**Verify, do not recall.** A claim about a library, a version or an API is checked in its own documentation before
it is used, and anything recalled rather than read is marked as such in the text.

## Branches, and how work lands

One chain, and nothing skips a step:

```
a branch of your own → dev → alpha → main
```

- **Nobody pushes to `main`, `alpha` or `dev`**, the assistant included. A ruleset refuses it.
- Every change arrives as a pull request, and `.github/workflows/flow.yml` refuses a pull request that skips a
  step: `main` takes only `alpha`, `alpha` takes only `dev`, `dev` takes a branch of your own.
- The checks in `.github/workflows/ci.yml` are required, so a red branch does not land.
- Commits are English, imperative mood, one decision per commit where possible.

## Working on it

```sh
pnpm install     # also embeds the pinned CLI and fixes node-pty's spawn-helper
pnpm start       # development
pnpm test        # real processes and the embedded CLI, no mocks
pnpm lint
pnpm typecheck
pnpm smoke       # packages the app and checks it with the PATH an app opened from Finder gets
```

**Tests use the real thing.** The process layer starts real processes and checks that stopping one frees its port;
the CLI layer runs the embedded CLI. Mocking either would only prove that the mock matches an assumption. A change
that touches packaging, the pseudo terminal or the embedded CLI is proven with `pnpm smoke`, because unit tests
cannot see a packaged app.

## Layout

```
src/main/       the environment layer, the process layer, and every call to the CLI. No Electron in the files
                the tests import
src/preload/    the bridge, and nothing else
src/renderer/   the interface, following Prumo's own web template
src/shared/     the IPC contract and the few pure rules both sides need
scripts/        embedding the CLI, the spawn-helper fix, and the smoke check
```

The renderer never touches Node: `contextIsolation` is on, `nodeIntegration` is off, and everything crosses through
the contract in `src/shared/ipc.ts`.
