# Desktop Release Runbook

本文档用于管理员配置并执行 RAILWISE Desktop 的 GitHub Actions 发布流程。发布流程会构建 Windows、macOS Apple Silicon、macOS Intel 和 Linux 安装包，并创建 draft GitHub Release。

## 前置权限

执行人需要具备以下权限：

- GitHub 仓库 `Actions: write` 与 `Contents: write`
- GitHub 仓库 secrets 管理权限
- Apple Developer 账号及 Developer ID Application 证书
- SignPath 项目访问权限
- Tauri updater 签名私钥

## 必需 Secrets

全平台必需：

```text
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

macOS 必需：

```text
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
APPLE_KEYCHAIN_PASSWORD
APPLE_ID
APPLE_ID_PASSWORD
APPLE_TEAM_ID
APPLE_SIGNING_IDENTITY
```

Windows 必需：

```text
SIGNPATH_API_TOKEN
SIGNPATH_ORG_ID
```

当前 workflow 会在构建前执行 secret preflight。缺失任意必需项时，job 会在 `Validate release secrets` 步骤失败，并列出缺失名称。

## 配置方式

使用 GitHub CLI 配置 secrets：

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY --repo railwise-cn/RAILWISE-CLI < tauri-private-key.pem
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo railwise-cn/RAILWISE-CLI
gh secret set APPLE_CERTIFICATE --repo railwise-cn/RAILWISE-CLI < certificate.p12.base64
gh secret set APPLE_CERTIFICATE_PASSWORD --repo railwise-cn/RAILWISE-CLI
gh secret set APPLE_KEYCHAIN_PASSWORD --repo railwise-cn/RAILWISE-CLI
gh secret set APPLE_ID --repo railwise-cn/RAILWISE-CLI
gh secret set APPLE_ID_PASSWORD --repo railwise-cn/RAILWISE-CLI
gh secret set APPLE_TEAM_ID --repo railwise-cn/RAILWISE-CLI
gh secret set APPLE_SIGNING_IDENTITY --repo railwise-cn/RAILWISE-CLI
gh secret set SIGNPATH_API_TOKEN --repo railwise-cn/RAILWISE-CLI
gh secret set SIGNPATH_ORG_ID --repo railwise-cn/RAILWISE-CLI
```

`APPLE_CERTIFICATE` 必须是 base64 编码后的 `.p12` 内容：

```bash
base64 -i certificate.p12 -o certificate.p12.base64
```

配置后检查 secret 名称：

```bash
bun run desktop:release-secrets
```

也可以检查其他仓库：

```bash
bun run desktop:release-secrets -- --repo owner/name
```

## 发布前本地检查

在触发 GitHub Actions 前执行：

```bash
bun run script/verify-desktop-release.ts
bun run desktop:verify:ga
```

完整 live gate：

```bash
bun run desktop:verify:ga -- --full
```

## 触发发布

手动触发 `Desktop Release` workflow：

```bash
gh workflow run "Desktop Release" --repo railwise-cn/RAILWISE-CLI --ref main -f version=1.3.0
```

或推送发布标签：

```bash
git tag desktop/v1.3.0
git push origin desktop/v1.3.0
```

推荐 GA 首次发版使用手动触发，确认 draft Release 产物完整后再决定是否保留或补标签。

## 验收 Release

workflow 成功后检查 draft Release：

```bash
gh release view desktop/v1.3.0 --repo railwise-cn/RAILWISE-CLI --json isDraft,assets,tagName,url
```

必须覆盖以下产物类型：

- Windows signed installer: `.exe`
- macOS installer: `.dmg`
- Linux packages: `.AppImage`, `.deb`, `.rpm`

## 更新服务器

Release 产物确认后，将安装包和 Tauri updater 签名写入更新服务器 manifest。更新接口必须兼容：

```text
GET /desktop/{{target}}/{{current_version}}
```

灰度节奏见 `docs/admin/04-update-server.md`。

## 回滚

如果发布后出现 P0/P1：

1. 暂停更新服务器返回新版本。
2. 将 manifest 回退到上一个稳定版本。
3. 保留 GitHub draft/release 产物用于排查，不直接删除。
4. 修复后重新走完整 `desktop:verify:ga -- --full`。
