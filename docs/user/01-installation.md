# RAILWISE Desktop 安装

RAILWISE Desktop 面向工程测绘现场交付，应用启动后默认进入多智能体 Harness 工作台。安装前请确认企业内网允许访问模型服务、更新服务，或已配置本地模型与私有更新源。

## Windows

1. 下载 `RAILWISE_1.3.0_x64-setup.exe`。
2. 右键选择“以管理员身份运行”。
3. 安装器完成后，从开始菜单启动“RAILWISE Desktop”。
4. 首次启动如果出现防火墙提示，允许本机回环访问。

安装完成后，CLI sidecar 会随桌面端启动；如需命令行入口，进入“设置 → 通用”后执行 CLI 安装。

## macOS

1. Apple 芯片 Mac 下载 `RAILWISE_1.3.0_aarch64.dmg`；Intel Mac 下载 `RAILWISE_1.3.0_x64.dmg`。
2. 打开 DMG，将 RAILWISE 拖入 Applications。
3. 首次启动如被 Gatekeeper 阻止，进入“系统设置 → 隐私与安全性”允许打开。
4. 启动后确认首页显示多智能体 Harness 工作台。

## Linux

Desktop 暂不面向 Linux 用户发布安装包。工程自动化和 CI 场景继续使用 RAILWISE CLI。

## 更新

RAILWISE 默认在启动时检查更新。发现新版本时会显示应用内更新弹窗，点击“立即更新”后等待下载完成并重启。企业内网部署可改用管理员配置的私有更新服务器。
