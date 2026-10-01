// Finding the address an app printed. The Desktop keeps no copy of any template's port: Vite, Next and Expo all
// announce where they are listening, and that announcement is the only source.

// Built from the character code: an escape inside a regular expression is a control character, which the linter
// refuses on sight, and writing it as one would hide it from anyone reading the line.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[a-zA-Z]`, 'g')

/** A terminal buffer is coloured, and the escapes cut through words: `localhost:<escape>5173`. */
export function stripAnsi(text: string): string {
  return text.replaceAll(ANSI, '')
}

const LOCAL =
  /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|(?:\d{1,3}\.){3}\d{1,3})(?::\d+)?/g

const LOOPBACK = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::|$)/

/**
 * The address to open in a browser, taken from what the app wrote. This machine's own address wins over the
 * network one, which Next prints after it (`Local:` then `Network:`); among them the last wins, since a server
 * that moves to another port prints the new address afterwards.
 */
export function browserUrl(buffer: string): string | undefined {
  const found = [...stripAnsi(buffer).matchAll(LOCAL)].map((match) => match[0])

  return found.filter((url) => LOOPBACK.test(url)).at(-1) ?? found.at(-1)
}
