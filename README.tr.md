<p align="center">
  <a href="https://railwise.ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="RAILWISE (甬算) logo">
    </picture>
  </a>
</p>
<p align="center">Açık kaynaklı yapay zeka kodlama asistanı.</p>
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

### Kurulum

```bash
# YOLO
curl -fsSL https://railwise.ai/install | bash

# Paket yöneticileri
npm i -g railwise-ai@latest        # veya bun/pnpm/yarn
scoop install railwise             # Windows
choco install railwise             # Windows
brew install anomalyco/tap/railwise # macOS ve Linux (önerilir, her zaman güncel)
brew install railwise              # macOS ve Linux (resmi brew formülü, daha az güncellenir)
sudo pacman -S railwise            # Arch Linux (Stable)
paru -S railwise-bin               # Arch Linux (Latest from AUR)
mise use -g railwise               # Tüm işletim sistemleri
nix run nixpkgs#railwise           # veya en güncel geliştirme dalı için github:anomalyco/railwise
```

> [!TIP]
> Kurulumdan önce 0.1.x'ten eski sürümleri kaldırın.

### Masaüstü Uygulaması (BETA)

RAILWISE (甬算) ayrıca masaüstü uygulaması olarak da mevcuttur. Doğrudan [sürüm sayfasından](https://github.com/anomalyco/railwise/releases) veya [railwise.ai/download](https://railwise.ai/download) adresinden indirebilirsiniz.

| Platform              | İndirme                               |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `railwise-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `railwise-desktop-darwin-x64.dmg`     |
| Windows               | `railwise-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm` veya AppImage          |

```bash
# macOS (Homebrew)
brew install --cask railwise-desktop
# Windows (Scoop)
scoop bucket add extras; scoop install extras/railwise-desktop
```

#### Kurulum Dizini (Installation Directory)

Kurulum betiği (install script), kurulum yolu (installation path) için aşağıdaki öncelik sırasını takip eder:

1. `$RAILWISE_INSTALL_DIR` - Özel kurulum dizini
2. `$XDG_BIN_DIR` - XDG Base Directory Specification uyumlu yol
3. `$HOME/bin` - Standart kullanıcı binary dizini (varsa veya oluşturulabiliyorsa)
4. `$HOME/.railwise/bin` - Varsayılan yedek konum

```bash
# Örnekler
RAILWISE_INSTALL_DIR=/usr/local/bin curl -fsSL https://railwise.ai/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://railwise.ai/install | bash
```

### Ajanlar

RAILWISE (甬算), `Tab` tuşuyla aralarında geçiş yapabileceğiniz iki yerleşik (built-in) ajan içerir.

- **build** - Varsayılan, geliştirme çalışmaları için tam erişimli ajan
- **plan** - Analiz ve kod keşfi için salt okunur ajan
  - Varsayılan olarak dosya düzenlemelerini reddeder
  - Bash komutlarını çalıştırmadan önce izin ister
  - Tanımadığınız kod tabanlarını keşfetmek veya değişiklikleri planlamak için ideal

Ayrıca, karmaşık aramalar ve çok adımlı görevler için bir **genel** alt ajan bulunmaktadır.
Bu dahili olarak kullanılır ve mesajlarda `@general` ile çağrılabilir.

[Ajanlar](https://railwise.ai/docs/agents) hakkında daha fazla bilgi edinin.

### Dokümantasyon

RAILWISE (甬算)'u nasıl yapılandıracağınız hakkında daha fazla bilgi için [**dokümantasyonumuza göz atın**](https://railwise.ai/docs).

### Katkıda Bulunma

RAILWISE (甬算)'a katkıda bulunmak istiyorsanız, lütfen bir pull request göndermeden önce [katkıda bulunma dokümanlarımızı](./CONTRIBUTING.md) okuyun.

### RAILWISE (甬算) Üzerine Geliştirme

RAILWISE (甬算) ile ilgili bir proje üzerinde çalışıyorsanız ve projenizin adının bir parçası olarak "railwise" kullanıyorsanız (örneğin, "railwise-dashboard" veya "railwise-mobile"), lütfen README dosyanıza projenin RAILWISE (甬算) ekibi tarafından geliştirilmediğini ve bizimle hiçbir şekilde bağlantılı olmadığını belirten bir not ekleyin.

### SSS

#### Bu Claude Code'dan nasıl farklı?

Yetenekler açısından Claude Code'a çok benzer. İşte temel farklar:

- %100 açık kaynak
- Herhangi bir sağlayıcıya bağlı değil. [RAILWISE (甬算) Zen](https://railwise.ai/zen) üzerinden sunduğumuz modelleri önermekle birlikte; RAILWISE (甬算), Claude, OpenAI, Google veya hatta yerel modellerle kullanılabilir. Modeller geliştikçe aralarındaki farklar kapanacak ve fiyatlar düşecek, bu nedenle sağlayıcıdan bağımsız olmak önemlidir.
- Kurulum gerektirmeyen hazır LSP desteği
- TUI odaklı yaklaşım. RAILWISE (甬算), neovim kullanıcıları ve [terminal.shop](https://terminal.shop)'un geliştiricileri tarafından geliştirilmektedir; terminalde olabileceklerin sınırlarını zorlayacağız.
- İstemci/sunucu (client/server) mimarisi. Bu, örneğin RAILWISE (甬算)'un bilgisayarınızda çalışması ve siz onu bir mobil uygulamadan uzaktan yönetmenizi sağlar. TUI arayüzü olası istemcilerden sadece biridir.

---

**Topluluğumuza katılın** [Discord](https://discord.gg/railwise) | [X.com](https://x.com/railwise)
