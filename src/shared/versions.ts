// Comparing Prumo versions, which both sides need: the main process to pick a CLI, the screen to tell a project
// made by an older one.

type Version = [number, number, number]

/** A plain release, `x.y.z`. A prerelease is never offered as an update. */
export function parseVersion(text: string): Version | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(text.trim())

  return match === null ? undefined : [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareVersions(a: string, b: string): number {
  const [left, right] = [parseVersion(a), parseVersion(b)]

  if (left === undefined || right === undefined) return 0

  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
}

/** Whether the Desktop can run `candidate`, having been built with `shipped`: the same major and minor. */
export function sameMinor(shipped: string, candidate: string): boolean {
  const [left, right] = [parseVersion(shipped), parseVersion(candidate)]

  return left !== undefined && right !== undefined && left[0] === right[0] && left[1] === right[1]
}
