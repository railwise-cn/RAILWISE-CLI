<p align="center">
  <a href="https://yonsoon.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="YONSOON (甬算) logo">
    </picture>
  </a>
</p>
<p align="center">Der Open-Source KI-Coding-Agent.</p>
<p align="center">
  <a href="https://yonsoon.ai/discord"><img alt="Discord" src="https://img.shields.io/discord/1391832426048651334?style=flat-square&label=discord" /></a>
  <a href="https://www.npmjs.com/package/yonsoon-ai"><img alt="npm" src="https://img.shields.io/npm/v/yonsoon-ai?style=flat-square" /></a>
  <a href="https://github.com/anomalyco/yonsoon/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/anomalyco/yonsoon/publish.yml?style=flat-square&branch=dev" /></a>
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
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a>
</p>

[![YONSOON (甬算) Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://yonsoon.ai)

---

### Installation

```bash
# YOLO
curl -fsSL https://yonsoon.ai/install | bash

# Paketmanager
npm i -g yonsoon-ai@latest        # oder bun/pnpm/yarn
scoop install yonsoon             # Windows
choco install yonsoon             # Windows
brew install anomalyco/tap/yonsoon # macOS und Linux (empfohlen, immer aktuell)
brew install yonsoon              # macOS und Linux (offizielle Brew-Formula, seltener aktualisiert)
sudo pacman -S yonsoon            # Arch Linux (Stable)
paru -S yonsoon-bin               # Arch Linux (Latest from AUR)
mise use -g yonsoon               # jedes Betriebssystem
nix run nixpkgs#yonsoon           # oder github:anomalyco/yonsoon für den neuesten dev-Branch
```

> [!TIP]
> Entferne Versionen älter als 0.1.x vor der Installation.

### Desktop-App (BETA)

YONSOON (甬算) ist auch als Desktop-Anwendung verfügbar. Lade sie direkt von der [Releases-Seite](https://github.com/anomalyco/yonsoon/releases) oder [yonsoon.ai/download](https://yonsoon.ai/download) herunter.

| Plattform             | Download                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `yonsoon-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `yonsoon-desktop-darwin-x64.dmg`     |
| Windows               | `yonsoon-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm` oder AppImage          |

```bash
# macOS (Homebrew)
brew install --cask yonsoon-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/yonsoon-desktop
```

#### Installationsverzeichnis

Das Installationsskript beachtet die folgende Prioritätsreihenfolge für den Installationspfad:

1. `$YONSOON_INSTALL_DIR` - Benutzerdefiniertes Installationsverzeichnis
2. `$XDG_BIN_DIR` - XDG Base Directory Specification-konformer Pfad
3. `$HOME/bin` - Standard-Binärverzeichnis des Users (falls vorhanden oder erstellbar)
4. `$HOME/.yonsoon/bin` - Standard-Fallback

```bash
# Beispiele
YONSOON_INSTALL_DIR=/usr/local/bin curl -fsSL https://yonsoon.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://yonsoon.ai/install | bash
```

### Agents

YONSOON (甬算) enthält zwei eingebaute Agents, zwischen denen du mit der `Tab`-Taste wechseln kannst.

- **build** - Standard-Agent mit vollem Zugriff für Entwicklungsarbeit
- **plan** - Nur-Lese-Agent für Analyse und Code-Exploration
  - Verweigert Datei-Edits standardmäßig
  - Fragt vor dem Ausführen von bash-Befehlen nach
  - Ideal zum Erkunden unbekannter Codebases oder zum Planen von Änderungen

Außerdem ist ein **general**-Subagent für komplexe Suchen und mehrstufige Aufgaben enthalten.
Dieser wird intern genutzt und kann in Nachrichten mit `@general` aufgerufen werden.

Mehr dazu unter [Agents](https://yonsoon.ai/docs/agents).

### Dokumentation

Mehr Infos zur Konfiguration von YONSOON (甬算) findest du in unseren [**Docs**](https://yonsoon.ai/docs).

### Beitragen

Wenn du zu YONSOON (甬算) beitragen möchtest, lies bitte unsere [Contributing Docs](./CONTRIBUTING.md), bevor du einen Pull Request einreichst.

### Auf YONSOON (甬算) aufbauen

Wenn du an einem Projekt arbeitest, das mit YONSOON (甬算) zusammenhängt und "yonsoon" als Teil seines Namens verwendet (z.B. "yonsoon-dashboard" oder "yonsoon-mobile"), füge bitte einen Hinweis in deine README ein, dass es nicht vom YONSOON (甬算)-Team gebaut wird und nicht in irgendeiner Weise mit uns verbunden ist.

### FAQ

#### Worin unterscheidet sich das von Claude Code?

In Bezug auf die Fähigkeiten ist es Claude Code sehr ähnlich. Hier sind die wichtigsten Unterschiede:

- 100% open source
- Nicht an einen Anbieter gekoppelt. Wir empfehlen die Modelle aus [YONSOON (甬算) Zen](https://yonsoon.ai/zen); YONSOON (甬算) kann aber auch mit Claude, OpenAI, Google oder sogar lokalen Modellen genutzt werden. Mit der Weiterentwicklung der Modelle werden die Unterschiede kleiner und die Preise sinken, deshalb ist Provider-Unabhängigkeit wichtig.
- LSP-Unterstützung direkt nach dem Start
- Fokus auf TUI. YONSOON (甬算) wird von Neovim-Nutzern und den Machern von [terminal.shop](https://terminal.shop) gebaut; wir treiben die Grenzen dessen, was im Terminal möglich ist.
- Client/Server-Architektur. Das ermöglicht z.B., YONSOON (甬算) auf deinem Computer laufen zu lassen, während du es von einer mobilen App aus fernsteuerst. Das TUI-Frontend ist nur einer der möglichen Clients.

---

**Tritt unserer Community bei** [Discord](https://discord.gg/yonsoon) | [X.com](https://x.com/yonsoon)
