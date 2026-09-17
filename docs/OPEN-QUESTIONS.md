# Open Questions

Anything raised but not resolved. **This is the only home for an open question.** Review this file
at the start of every session.

A question is removed from here only when it is answered, and its answer goes to `DECISIONS.md`.

Entry format:

```
## <short name>

**Raised:** YYYY-MM-DD
**Question:** <what is unresolved>
**Why it matters:** <impact if we skip it>
**Blocks:** <which decision or build-order step cannot be finished without it>
```

---

## Does a notarised build pass with `node-pty`?

**Raised:** 2026-09-17
**Question:** does a build that bundles `node-pty` (its `.node` and `spawn-helper`) sign and notarise, and still open a
pseudo terminal afterwards? Which entitlements does it need?
**Why it matters:** the notarisation requirements were not read in Apple's documentation (the page did not load);
a missing entitlement typically yields an app that is notarised but fails at launch or when opening a terminal.
**Blocks:** the public release. To be attempted as soon as the Apple Developer Program membership exists.

---

## How does the Desktop update itself?

**Raised:** 2026-09-17
**Question:** which update mechanism, and served from where? On macOS, Electron's `autoUpdater` requires a signed app;
on Windows the Store would update it; on Linux Electron has nothing built in.
**Why it matters:** without it, every CLI fix embedded in the Desktop waits for users to download a new installer.
**Blocks:** nothing before the first signed release

---

## How does the Desktop find Node on Windows?

**Raised:** 2026-09-17
**Question:** `fix-path` does nothing on Windows, and a Node set up by fnm or nvm in a PowerShell profile is invisible
to an app opened from the Start menu. How does the Desktop find it without asking users to change their global
`PATH`?
**Why it matters:** without Node the Desktop cannot run the CLI or any app.
**Blocks:** the Windows release

---

## Can an MSIX-packaged Desktop run the user's tools?

**Raised:** 2026-09-17
**Question:** packaged for the Microsoft Store, can the Desktop run the user's `node`, `pnpm` and `docker`, open a
pseudo terminal through ConPTY, and read `PATH`? From memory, "full trust" MSIX apps can, but packaging redirects some
writes to system locations.
**Why it matters:** the Windows distribution decision is conditional on it.
**Blocks:** the Windows release

---

## Needs on the Prumo side

**Raised:** 2026-09-17
**Question:** which of these should become questions in Prumo's own `docs/OPEN-QUESTIONS.md`?
- **Document `prumo db --check`**, which the Desktop uses to tell whether the database is missing; today it is passed
  through to the project's script without appearing in `prumo db --help`.
- **The Prumo version in `.prumo/config.json`**, so the Desktop can tell whether a project is outdated.
- **Validating a name without generating**, so the Desktop can validate while the user types without copying the
  rule.
**Why it matters:** each is something the Desktop depends on, or works around, that only Prumo can change.
**Blocks:** "project is outdated" and live name validation, both out of 0.0.1
