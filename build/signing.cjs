// How a build is signed, decided from the environment alone, so adding the secrets is the only switch.
// forge.config.js signs with it and vite.main.config.mjs bakes it into the main process, which only lets a
// Developer ID build update itself.
//
//   developer-id  APPLE_ID, APPLE_PASSWORD and APPLE_TEAM_ID are all set: signed with the Developer ID
//                 certificate in the keychain, Hardened Runtime on, notarized.
//   ad-hoc        none is set: signed with `codesign --sign -`, which an Apple silicon Mac needs to run the app
//                 at all, not notarized. A local `pnpm package` is this.
//
// Some but not all is an error: a typo in one secret must never quietly ship an unsigned build.
// GitHub Actions passes a missing secret as an empty string, so empty counts as unset.

const NOTARIZE = ['APPLE_ID', 'APPLE_PASSWORD', 'APPLE_TEAM_ID']

/** @returns {'developer-id' | 'ad-hoc'} */
function signingMode(env = process.env) {
  const set = NOTARIZE.filter((name) => (env[name] ?? '') !== '')

  if (set.length === NOTARIZE.length) return 'developer-id'
  if (set.length === 0) return 'ad-hoc'

  const missing = NOTARIZE.filter((name) => !set.includes(name))
  throw new Error(
    `Signing needs all of ${NOTARIZE.join(', ')}, or none of them for an ad-hoc build. ` +
      `Set: ${set.join(', ')}. Missing: ${missing.join(', ')}.`,
  )
}

/**
 * Whether a release is a pre-release, from how its macOS build is signed. An ad-hoc build is a preview, and so is
 * the release that carries it. A Developer ID build makes a normal release, which update.electronjs.org serves to
 * installed Macs; the Linux packages in it are unsigned, by decision, and its notes say so.
 * .github/workflows/release.yml asks this; src/main/updates.ts offers pre-releases only to unsigned builds.
 * @param {'developer-id' | 'ad-hoc'} mode
 * @returns {boolean}
 */
function prerelease(mode) {
  return mode !== 'developer-id'
}

module.exports = { NOTARIZE, prerelease, signingMode }
