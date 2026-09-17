// Finding the address an app printed. The Desktop keeps no copy of any template's port: Vite, Next and Expo all
// announce where they are listening, and that announcement is the only source.

/** A terminal buffer is coloured, and the escapes cut through words: `localhost:<escape>5173`. */
export function stripAnsi(text: string): string {
  return text.replaceAll(/\[[0-9;?]*[a-zA-Z]/g, '')
}

const LOCAL =
  /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0|(?:\d{1,3}\.){3}\d{1,3})(?::\d+)?/g

/**
 * The address to open in a browser, taken from what the app wrote. The last one wins: a dev server that moves to
 * another port prints the new address afterwards.
 */
export function browserUrl(buffer: string): string | undefined {
  const found = [...stripAnsi(buffer).matchAll(LOCAL)].map((match) => match[0])

  return found.at(-1)
}
