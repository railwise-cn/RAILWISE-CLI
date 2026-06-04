# icons/railwise/

> 睿威智测 RAILWISE 品牌图标目录。

## 当前状态

本目录的图标资源由官方 RailWISE 标志中的品牌 Mark 生成，源文件为
`src-tauri/assets/railwise-app-icon.svg`。Tauri 打包配置会从这里读取 macOS
`.icns`、Windows `.ico` 与 PNG fallback。

## 重新生成

```bash
cd packages/desktop
bun run tauri icon src-tauri/assets/railwise-app-icon.svg -o src-tauri/icons/railwise
```

## 必备文件清单（开发实施文档 §3.3.3）

| 文件名 | 尺寸 / 格式 | 平台 |
|--------|-------------|------|
| `32x32.png` | 32×32 PNG | Windows bundle fallback |
| `128x128.png` | 128×128 PNG | macOS / Windows fallback |
| `128x128@2x.png` | 256×256 PNG（@2x 标注） | macOS Retina |
| `icon.icns` | 多分辨率 ICNS（16/32/64/128/256/512/1024） | macOS App Bundle |
| `icon.ico` | 多分辨率 ICO（16/32/48/64/128/256） | Windows EXE + NSIS |
| `icon.png` | 512×512 PNG | 通用高清源 |
