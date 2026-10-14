// Whether GitHub has a newer Prumo Desktop than this one, for the notice that says so (src/main/updates.ts decides
// which builds show it). It never downloads anything: the notice opens the release page. No Electron here.
import type { AppUpdate } from '../shared/ipc.ts'
import { compareVersions, parseVersion } from '../shared/versions.ts'

const RELEASES = 'https://api.github.com/repos/stjosephworks/prumo-desktop/releases?per_page=30'

/** The fields of a release the notice reads, as GitHub's REST API returns them. */
export type Release = { tag_name: string; html_url: string; draft: boolean; prerelease: boolean }

/** The releases GitHub lists, newest first as it orders them. Drafts are listed only to people with push access. */
export async function listReleases(token?: string): Promise<Release[]> {
  const response = await fetch(RELEASES, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) throw new Error(`GitHub answered ${response.status}.`)

  return (await response.json()) as Release[]
}

/**
 * The newest release above `current`, or undefined. A draft never counts; a pre-release counts only when
 * `prereleases` is set, which an unsigned build is. Tags are `v` and a plain `x.y.z`; anything else is ignored.
 */
export function newestRelease(
  releases: Release[],
  current: string,
  prereleases: boolean,
): AppUpdate | undefined {
  const newer = releases
    .filter((release) => !release.draft && (prereleases || !release.prerelease))
    .map((release) => ({ version: release.tag_name.replace(/^v/, ''), url: release.html_url }))
    .filter((release) => parseVersion(release.version) !== undefined)
    .filter((release) => compareVersions(release.version, current) > 0)
    .sort((a, b) => compareVersions(b.version, a.version))

  return newer[0]
}
