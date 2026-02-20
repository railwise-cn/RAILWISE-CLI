<p align="center">
  <a href="https://railwise.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="RAILWISE (甬算) logo">
    </picture>
  </a>
</p>
<p align="center">The open source AI coding agent.</p>
<p align="center">
  <a href="https://railwise.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/railwise-ai"><img alt="npm" src="https://img.shields.io/npm/v/railwise-ai?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/railwise/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/railwise/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a>
</p>

[![RAILWISE (甬算) Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://railwise.ai)

---

### Installation

```bash
# YOLO
curl -fsSL https://railwise.ai/install | bash

# Package managers
npm i -g railwise-ai@latest        # or bun/pnpm/yarn
scoop install railwise             # Windows
choco install railwise             # Windows
brew install anomalyco/tap/railwise # macOS and Linux (recommended, always up to date)
brew install railwise              # macOS and Linux (official brew formula, updated less)
sudo pacman -S railwise            # Arch Linux (Stable)
paru -S railwise-bin               # Arch Linux (Latest from AUR)
mise use -g railwise               # Any OS
nix run nixpkgs#railwise           # or github:anomalyco/railwise for latest dev branch
```

> [!TIP]
> Remove versions older than 0.1.x before installing.

### Desktop App (BETA)

RAILWISE (甬算) is also available as a desktop application. Download directly from the [releases page](https://github.com/anomalyco/railwise/releases) or [railwise.ai/download](https://railwise.ai/download).

| Platform              | Download                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `railwise-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `railwise-desktop-darwin-x64.dmg`     |
| Windows               | `railwise-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, or AppImage           |

```bash
# macOS (Homebrew)
brew install --cask railwise-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/railwise-desktop
```

#### Installation Directory

The install script respects the following priority order for the installation path:

1. `$RAILWISE_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if it exists or can be created)
4. `$HOME/.railwise/bin` - Default fallback

```bash
# Examples
RAILWISE_INSTALL_DIR=/usr/local/bin curl -fsSL https://railwise.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://railwise.ai/install | bash
```

### Agents

RAILWISE (甬算) includes two built-in agents you can switch between with the `Tab` key.

- **build** - Default, full-access agent for development work
- **plan** - Read-only agent for analysis and code exploration
  - Denies file edits by default
  - Asks permission before running bash commands
  - Ideal for exploring unfamiliar codebases or planning changes

Also included is a **general** subagent for complex searches and multistep tasks.
This is used internally and can be invoked using `@general` in messages.

Learn more about [agents](https://railwise.ai/docs/agents).

### Documentation

For more info on how to configure RAILWISE (甬算), [**head over to our docs**](https://railwise.ai/docs).

### Contributing

If you're interested in contributing to RAILWISE (甬算), please read our [contributing docs](./CONTRIBUTING.md) before submitting a pull request.

### Building on RAILWISE (甬算)

If you are working on a project that's related to RAILWISE (甬算) and is using "railwise" as part of its name, for example "railwise-dashboard" or "railwise-mobile", please add a note to your README to clarify that it is not built by the RAILWISE (甬算) team and is not affiliated with us in any way.

### FAQ

#### How is this different from Claude Code?

It's very similar to Claude Code in terms of capability. Here are the key differences:

- 100% open source
- Not coupled to any provider. Although we recommend the models we provide through [RAILWISE (甬算) Zen](https://railwise.ai/zen), RAILWISE (甬算) can be used with Claude, OpenAI, Google, or even local models. As models evolve, the gaps between them will close and pricing will drop, so being provider-agnostic is important.
- Out-of-the-box LSP support
- A focus on TUI. RAILWISE (甬算) is built by neovim users and the creators of [terminal.shop](https://terminal.shop); we are going to push the limits of what's possible in the terminal.
- A client/server architecture. This, for example, can allow RAILWISE (甬算) to run on your computer while you drive it remotely from a mobile app, meaning that the TUI frontend is just one of the possible clients.

---

**Join our community** [Discord](https://discord.gg/railwise) | [X.com](https://x.com/railwise)
