<!--
  The body of a pre-release built without the Apple Developer ID secrets (.github/workflows/release.yml).
  The steps follow Apple's own pages, for macOS Sequoia 15 and macOS Tahoe 26:
  https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/15.0/mac/15.0
  https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/26/mac/26
  https://support.apple.com/en-us/102445
-->
> **A preview build, not signed by Apple.** It is meant for the few developers it was shared with. It is not
> notarized, so macOS asks you to confirm it the first time it opens, and it does not update itself.

## Download

- **Apple silicon** (M1 and later): `Prumo Desktop-<version>-arm64.dmg`
- **Intel**: `Prumo Desktop-<version>-x64.dmg`

Open the dmg and drag Prumo Desktop into Applications.

## Opening it the first time (macOS 15 and later)

1. Open Prumo Desktop from Applications. macOS says it cannot check the app for malicious software. Click
   **Done**, not **Move to Trash**.
2. Choose Apple menu > **System Settings**, then click **Privacy & Security** in the sidebar. You may need to
   scroll down.
3. Under **Security**, click **Open Anyway**. The button is there for about an hour after you tried to open
   the app.
4. Enter your login password, then click **OK**. When the warning appears again, click **Open**.

From then on it opens like any other app. Apple describes these steps in
[Open a Mac app from an unknown developer](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac).

## Updates

- **This build never updates itself.** To move to a newer preview, download it from
  [Releases](https://github.com/stjosephworks/prumo-desktop/releases) and replace the app in Applications.
- **The first signed release also has to be installed by hand, once.** Download it, quit Prumo Desktop and
  replace the app in Applications. From that release on, updates arrive by themselves.

Your projects and settings stay where they are when you replace the app.
