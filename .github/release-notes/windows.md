<!--
  The Windows part of every release's notes (.github/workflows/release.yml). Windows builds are unsigned for now:
  a Microsoft Store build is the signed channel being evaluated.
-->
## Windows (x64)

> **A preview, not signed.** Windows warns before it opens an unsigned installer.

- Download `Prumo.Desktop-<version>.Setup.exe` and run it. It installs for your user only, without asking for
  administrator rights, and adds Prumo Desktop to the Start menu.
- If Windows says **Windows protected your PC**, choose **More info**, then **Run anyway**. Where Smart App Control
  is on, Windows blocks unsigned apps and offers no way past; Prumo Desktop cannot be installed there yet.
- Prumo Desktop does not update itself on Windows yet: when a newer version is out, it says so at the foot of its
  sidebar, with a link to the release. Run the newer Setup.exe; your projects and settings stay where they are.

Prumo Desktop needs Node 22.18 or later, pnpm 10.26 or later and git, installed for Windows itself; projects inside
WSL are not supported. Docker Desktop is needed only for an API's database.
