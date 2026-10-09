// Whether the app updates itself. No Electron here, so the tests run in plain Node.

/**
 * Only a packaged app signed with a Developer ID updates itself. Squirrel.Mac, behind update-electron-app, needs a
 * signed app ("Your application must be signed for automatic updates on macOS. This is a requirement of
 * Squirrel.Mac.", https://www.electronjs.org/docs/latest/api/auto-updater), and update.electronjs.org serves only
 * published releases, never the pre-releases an ad-hoc build ships as. An ad-hoc build would only fail to check, so
 * it never starts the updater: its updates are a manual download until the user installs a signed release.
 */
export function updaterEnabled(app: { packaged: boolean; developerId: boolean }): boolean {
  return app.packaged && app.developerId
}
