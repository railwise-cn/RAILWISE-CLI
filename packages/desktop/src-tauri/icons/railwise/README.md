# icons/railwise/

> 睿威智测 RAILWISE 品牌图标目录（M1 §3.3.3）。

## 当前状态

本目录的图标资源由 `source.svg` 生成，使用官方 RailWISE 图形标识作为 Dock、App Bundle 和安装包图标。

重生成时先渲染 1024px PNG，再派生 PNG、ICNS 和 ICO 尺寸。

## 必备文件清单（开发实施文档 §3.3.3）

| 文件名 | 尺寸 / 格式 | 平台 |
|--------|-------------|------|
| `32x32.png` | 32×32 PNG | Windows bundle fallback |
| `128x128.png` | 128×128 PNG | macOS / Windows fallback |
| `128x128@2x.png` | 256×256 PNG（@2x 标注） | macOS Retina |
| `icon.icns` | 多分辨率 ICNS（16/32/64/128/256/512/1024） | macOS App Bundle |
| `icon.ico` | 多分辨率 ICO（16/32/48/64/128/256） | Windows EXE + NSIS |
| `icon.png` | 512×512 PNG | 通用高清源 |
