// How the app learns of a newer version of itself, per platform. No Electron here, so the tests run in plain Node.
//
// Two mechanisms, never both for the same build:
//   - update-electron-app, which downloads and installs, where the platform's updater can: only a packaged macOS app
//     signed with a Developer ID.
//   - A notice, which only says a newer release exists and opens its page: every other packaged build, including
//     Linux, where Electron has no updater at all.

export type Build = {
  packaged: boolean
  platform: NodeJS.Platform
  /** Baked in at build time from build/signing.cjs. Only macOS has a signing mode. */
  developerId: boolean
}

/**
 * Whether update-electron-app runs. Only on a packaged macOS app signed with a Developer ID: Squirrel.Mac needs a
 * signed app ("Your application must be signed for automatic updates on macOS. This is a requirement of
 * Squirrel.Mac.", https://www.electronjs.org/docs/latest/api/auto-updater), and update.electronjs.org serves only
 * published releases, never the pre-releases an ad-hoc build ships as.
 * Not on Windows: the Squirrel.Windows Setup.exe is unsigned, and Squirrel.Windows on GitHub Releases is its only
 * channel, so it is offered the notice instead, as Linux is. Not on Linux: "There is no built-in support for auto-updater
 * on Linux" (same page).
 */
export function updaterEnabled(build: Build): boolean {
  return build.packaged && build.platform === 'darwin' && build.developerId
}

/**
 * Whether the build is signed. An unsigned build is itself a pre-release, so the notice offers it pre-releases as
 * well; a signed one is offered releases only.
 */
export function signedBuild(build: Build): boolean {
  return build.platform === 'darwin' && build.developerId
}

/**
 * Whether the notice checks GitHub Releases: wherever the updater does not run. Off
 * in development unless asked for (`PRUMO_UPDATE_NOTICE=1`), so a dev build never says it is outdated.
 */
export function noticeEnabled(build: Build, env: Record<string, string | undefined>): boolean {
  if (updaterEnabled(build)) return false

  return build.packaged || env.PRUMO_UPDATE_NOTICE === '1'
}
