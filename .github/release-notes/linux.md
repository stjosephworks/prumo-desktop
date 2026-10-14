<!--
  The Linux part of every release's notes (.github/workflows/release.yml). Linux builds are unsigned, by decision:
  apt and dnf install a local package without asking for a signature.
-->
## Linux (x64)

- **Debian, Ubuntu and derivatives:** `prumo-desktop_<version>_amd64.deb`, installed with
  `sudo apt install ./prumo-desktop_<version>_amd64.deb`
- **Fedora, openSUSE and other rpm systems:** `prumo-desktop-<version>-1.x86_64.rpm`, installed with
  `sudo dnf install ./prumo-desktop-<version>-1.x86_64.rpm`

These packages are not signed. Prumo Desktop does not update itself on Linux: when a newer version is out, it says
so at the foot of its sidebar, with a link to the release. Install the new package over the old one; your projects
and settings stay where they are.

Prumo Desktop needs Node 22.18 or later, pnpm 10.26 or later and git. Docker (Docker Desktop or Docker Engine) is
needed only for an API's database.
