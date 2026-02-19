<p align="center">
  <a href="https://yonsoon.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Logo YONSOON (甬算)">
    </picture>
  </a>
</p>
<p align="center">L'agent de codage IA open source.</p>
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

# Gestionnaires de paquets
npm i -g yonsoon-ai@latest        # ou bun/pnpm/yarn
scoop install yonsoon             # Windows
choco install yonsoon             # Windows
brew install anomalyco/tap/yonsoon # macOS et Linux (recommandé, toujours à jour)
brew install yonsoon              # macOS et Linux (formule officielle brew, mise à jour moins fréquente)
sudo pacman -S yonsoon            # Arch Linux (Stable)
paru -S yonsoon-bin               # Arch Linux (Latest from AUR)
mise use -g yonsoon               # n'importe quel OS
nix run nixpkgs#yonsoon           # ou github:anomalyco/yonsoon pour la branche dev la plus récente
```

> [!TIP]
> Supprimez les versions antérieures à 0.1.x avant d'installer.

### Application de bureau (BETA)

YONSOON (甬算) est aussi disponible en application de bureau. Téléchargez-la directement depuis la [page des releases](https://github.com/anomalyco/yonsoon/releases) ou [yonsoon.ai/download](https://yonsoon.ai/download).

| Plateforme            | Téléchargement                        |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `yonsoon-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `yonsoon-desktop-darwin-x64.dmg`     |
| Windows               | `yonsoon-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, ou AppImage           |

```bash
# macOS (Homebrew)
brew install --cask yonsoon-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/yonsoon-desktop
```

#### Répertoire d'installation

Le script d'installation respecte l'ordre de priorité suivant pour le chemin d'installation :

1. `$YONSOON_INSTALL_DIR` - Répertoire d'installation personnalisé
2. `$XDG_BIN_DIR` - Chemin conforme à la spécification XDG Base Directory
3. `$HOME/bin` - Répertoire binaire utilisateur standard (s'il existe ou peut être créé)
4. `$HOME/.yonsoon/bin` - Repli par défaut

```bash
# Exemples
YONSOON_INSTALL_DIR=/usr/local/bin curl -fsSL https://yonsoon.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://yonsoon.ai/install | bash
```

### Agents

YONSOON (甬算) inclut deux agents intégrés que vous pouvez basculer avec la touche `Tab`.

- **build** - Par défaut, agent avec accès complet pour le travail de développement
- **plan** - Agent en lecture seule pour l'analyse et l'exploration du code
  - Refuse les modifications de fichiers par défaut
  - Demande l'autorisation avant d'exécuter des commandes bash
  - Idéal pour explorer une base de code inconnue ou planifier des changements

Un sous-agent **general** est aussi inclus pour les recherches complexes et les tâches en plusieurs étapes.
Il est utilisé en interne et peut être invoqué via `@general` dans les messages.

En savoir plus sur les [agents](https://yonsoon.ai/docs/agents).

### Documentation

Pour plus d'informations sur la configuration d'YONSOON (甬算), [**consultez notre documentation**](https://yonsoon.ai/docs).

### Contribuer

Si vous souhaitez contribuer à YONSOON (甬算), lisez nos [docs de contribution](./CONTRIBUTING.md) avant de soumettre une pull request.

### Construire avec YONSOON (甬算)

Si vous travaillez sur un projet lié à YONSOON (甬算) et que vous utilisez "yonsoon" dans le nom du projet (par exemple, "yonsoon-dashboard" ou "yonsoon-mobile"), ajoutez une note dans votre README pour préciser qu'il n'est pas construit par l'équipe YONSOON (甬算) et qu'il n'est pas affilié à nous.

### FAQ

#### En quoi est-ce différent de Claude Code ?

C'est très similaire à Claude Code en termes de capacités. Voici les principales différences :

- 100% open source
- Pas couplé à un fournisseur. Nous recommandons les modèles proposés via [YONSOON (甬算) Zen](https://yonsoon.ai/zen) ; YONSOON (甬算) peut être utilisé avec Claude, OpenAI, Google ou même des modèles locaux. Au fur et à mesure que les modèles évoluent, les écarts se réduiront et les prix baisseront, donc être agnostique au fournisseur est important.
- Support LSP prêt à l'emploi
- Un focus sur la TUI. YONSOON (甬算) est construit par des utilisateurs de neovim et les créateurs de [terminal.shop](https://terminal.shop) ; nous allons repousser les limites de ce qui est possible dans le terminal.
- Architecture client/serveur. Cela permet par exemple de faire tourner YONSOON (甬算) sur votre ordinateur tout en le pilotant à distance depuis une application mobile. Cela signifie que la TUI n'est qu'un des clients possibles.

---

**Rejoignez notre communauté** [Discord](https://discord.gg/yonsoon) | [X.com](https://x.com/yonsoon)
