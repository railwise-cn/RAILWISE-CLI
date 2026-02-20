<p align="center">
  <a href="https://railwise.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="RAILWISE (甬算) logo">
    </picture>
  </a>
</p>
<p align="center">오픈 소스 AI 코딩 에이전트.</p>
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
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a>
</p>

[![RAILWISE (甬算) Terminal UI](packages/web/src/assets/lander/screenshot.png)](https://railwise.ai)

---

### 설치

```bash
# YOLO
curl -fsSL https://railwise.ai/install | bash

# 패키지 매니저
npm i -g railwise-ai@latest        # bun/pnpm/yarn 도 가능
scoop install railwise             # Windows
choco install railwise             # Windows
brew install anomalyco/tap/railwise # macOS 및 Linux (권장, 항상 최신)
brew install railwise              # macOS 및 Linux (공식 brew formula, 업데이트 빈도 낮음)
sudo pacman -S railwise            # Arch Linux (Stable)
paru -S railwise-bin               # Arch Linux (Latest from AUR)
mise use -g railwise               # 어떤 OS든
nix run nixpkgs#railwise           # 또는 github:anomalyco/railwise 로 최신 dev 브랜치
```

> [!TIP]
> 설치 전에 0.1.x 보다 오래된 버전을 제거하세요.

### 데스크톱 앱 (BETA)

RAILWISE (甬算) 는 데스크톱 앱으로도 제공됩니다. [releases page](https://github.com/anomalyco/railwise/releases) 에서 직접 다운로드하거나 [railwise.ai/download](https://railwise.ai/download) 를 이용하세요.

| 플랫폼                | 다운로드                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `railwise-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `railwise-desktop-darwin-x64.dmg`     |
| Windows               | `railwise-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, 또는 AppImage         |

```bash
# macOS (Homebrew)
brew install --cask railwise-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/railwise-desktop
```

#### 설치 디렉터리

설치 스크립트는 설치 경로를 다음 우선순위로 결정합니다.

1. `$RAILWISE_INSTALL_DIR` - 사용자 지정 설치 디렉터리
2. `$XDG_BIN_DIR` - XDG Base Directory Specification 준수 경로
3. `$HOME/bin` - 표준 사용자 바이너리 디렉터리 (존재하거나 생성 가능할 경우)
4. `$HOME/.railwise/bin` - 기본 폴백

```bash
# 예시
RAILWISE_INSTALL_DIR=/usr/local/bin curl -fsSL https://railwise.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://railwise.ai/install | bash
```

### Agents

RAILWISE (甬算) 에는 내장 에이전트 2개가 있으며 `Tab` 키로 전환할 수 있습니다.

- **build** - 기본값, 개발 작업을 위한 전체 권한 에이전트
- **plan** - 분석 및 코드 탐색을 위한 읽기 전용 에이전트
  - 기본적으로 파일 편집을 거부
  - bash 명령 실행 전에 권한을 요청
  - 낯선 코드베이스를 탐색하거나 변경을 계획할 때 적합

또한 복잡한 검색과 여러 단계 작업을 위한 **general** 서브 에이전트가 포함되어 있습니다.
내부적으로 사용되며, 메시지에서 `@general` 로 호출할 수 있습니다.

[agents](https://railwise.ai/docs/agents) 에 대해 더 알아보세요.

### 문서

RAILWISE (甬算) 설정에 대한 자세한 내용은 [**문서**](https://railwise.ai/docs) 를 참고하세요.

### 기여하기

RAILWISE (甬算) 에 기여하고 싶다면, Pull Request 를 제출하기 전에 [contributing docs](./CONTRIBUTING.md) 를 읽어주세요.

### RAILWISE (甬算) 기반으로 만들기

RAILWISE (甬算) 와 관련된 프로젝트를 진행하면서 이름에 "railwise"(예: "railwise-dashboard" 또는 "railwise-mobile") 를 포함한다면, README 에 해당 프로젝트가 RAILWISE (甬算) 팀이 만든 것이 아니며 어떤 방식으로도 우리와 제휴되어 있지 않다는 점을 명시해 주세요.

### FAQ

#### Claude Code 와는 무엇이 다른가요?

기능 면에서는 Claude Code 와 매우 유사합니다. 주요 차이점은 다음과 같습니다.

- 100% 오픈 소스
- 특정 제공자에 묶여 있지 않습니다. [RAILWISE (甬算) Zen](https://railwise.ai/zen) 을 통해 제공하는 모델을 권장하지만, RAILWISE (甬算) 는 Claude, OpenAI, Google 또는 로컬 모델과도 사용할 수 있습니다. 모델이 발전하면서 격차는 줄고 가격은 내려가므로 provider-agnostic 인 것이 중요합니다.
- 기본으로 제공되는 LSP 지원
- TUI 에 집중. RAILWISE (甬算) 는 neovim 사용자와 [terminal.shop](https://terminal.shop) 제작자가 만들었으며, 터미널에서 가능한 것의 한계를 밀어붙입니다.
- 클라이언트/서버 아키텍처. 예를 들어 RAILWISE (甬算) 를 내 컴퓨터에서 실행하면서 모바일 앱으로 원격 조작할 수 있습니다. 즉, TUI 프런트엔드는 가능한 여러 클라이언트 중 하나일 뿐입니다.

---

**커뮤니티에 참여하기** [Discord](https://discord.gg/railwise) | [X.com](https://x.com/railwise)
