<!--
  The Windows part of every release's notes (.github/workflows/release.yml). The Windows build is unsigned, in a
  pre-release and in a normal release alike, as the Linux packages are: Squirrel.Windows on GitHub Releases is its
  only channel, and the Microsoft Store is not planned for now.

  Sources for what the notes tell the user:
  - SmartScreen warns about an app that has no reputation yet, and its dialog offers "More info", then "Run anyway"
    when available: https://learn.microsoft.com/en-us/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/
    and https://learn.microsoft.com/en-us/troubleshoot/microsoft-edge/development/ie-mode-blocks-addon
  - Smart App Control blocks an unsigned app ("Smart App Control will consider it untrusted and block it") and
    "There is currently no way to bypass Smart App Control protection for individual apps":
    https://support.microsoft.com/en-us/topic/what-is-smart-app-control-285ea03d-fa88-4d56-882e-6698afdb7003
-->
## Windows (x64)

> **The Windows build is not signed**, whether or not the macOS build in this release is.

- Download `Prumo.Desktop-<version>.Setup.exe` and run it. It installs for your user only, without asking for
  administrator rights, and adds Prumo Desktop to the Start menu.
- Microsoft Defender SmartScreen warns before it opens an app it does not know yet. In its warning, choose
  **More info**, then **Run anyway**, when Windows offers it.
- **Smart App Control blocks unsigned apps, with no way around it for a single app.** Where it is on, Prumo
  Desktop cannot be installed unless you turn Smart App Control off in Windows Security.
- Prumo Desktop does not update itself on Windows: when a newer version is out, it says so at the foot of its
  sidebar, with a link to the release. Run the newer Setup.exe; your projects and settings stay where they are.

Prumo Desktop needs Node 22.18 or later, pnpm 10.26 or later and git, installed for Windows itself; projects inside
WSL are not supported. Docker Desktop is needed only for an API's database.
