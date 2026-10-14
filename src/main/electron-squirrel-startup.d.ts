// electron-squirrel-startup ships no types: it exports whether this launch was a Squirrel.Windows event it handled.
declare module 'electron-squirrel-startup' {
  const handled: boolean
  export default handled
}
