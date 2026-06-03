# icons/railwise/

> 睿威智测 RAILWISE 品牌图标目录（M1 §3.3.3）。

## 当前状态（M1 baseline）

本目录的图标资源在 M1 阶段从 `icons/dev/` 直接复制而来，作为构建占位，
确保 `bun run dev:desktop` 与 `tauri build` 不被路径迁移破坏。

## 待办（设计交付后）

设计团队提供 `assets/railwise-logo-1024.png` 后，按下列方式重生成：

```bash
cd packages/desktop
bun run tauri icon ../../assets/railwise-logo-1024.png
# 自动输出多分辨率到 src-tauri/icons/，把生成结果整理覆盖到 icons/railwise/
```

## 必备文件清单（开发实施文档 §3.3.3）

| 文件名           | 尺寸 / 格式                                | 平台                     |
| ---------------- | ------------------------------------------ | ------------------------ |
| `32x32.png`      | 32×32 PNG                                  | Windows bundle fallback  |
| `128x128.png`    | 128×128 PNG                                | macOS / Windows fallback |
| `128x128@2x.png` | 256×256 PNG（@2x 标注）                    | macOS Retina             |
| `icon.icns`      | 多分辨率 ICNS（16/32/64/128/256/512/1024） | macOS App Bundle         |
| `icon.ico`       | 多分辨率 ICO（16/32/48/64/128/256）        | Windows EXE + NSIS       |
| `icon.png`       | 512×512 PNG                                | 通用高清源               |
