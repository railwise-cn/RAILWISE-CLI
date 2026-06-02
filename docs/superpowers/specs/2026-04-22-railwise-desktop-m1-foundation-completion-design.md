---
name: RAILWISE Desktop M1 Foundation Completion
description: Complete brand replacement, Chinese i18n, startup optimization, and visual token compliance for RAILWISE Desktop v1.3.0 Milestone 1
type: implementation-spec
---

# RAILWISE Desktop M1 Foundation Completion Design

**Date**: 2026-04-22  
**Target**: RAILWISE Desktop v1.3.0 Milestone 1  
**Repository**: RAILWISE-CLI monorepo  
**Branch**: feat/desktop-v1.3.0-m1  

## Overview

This specification defines the completion of Milestone 1 (M1) foundation work for RAILWISE Desktop, focusing on brand replacement, complete Chinese internationalization, startup performance optimization, and visual token compliance according to the RAILWISE Desktop 开发实施文档 v1.0.

**Superseded Platform Scope**:
- As of 2026-06-02, Desktop no longer targets Linux packaging or public distribution.
- Public Desktop release scope is macOS Apple Silicon DMG + macOS Intel DMG.
- Windows is internal x64 NSIS testing only until a signing certificate is purchased.
- Linux support remains CLI-only.

**M1 Success Criteria**:
- [ ] Brand replacement complete, all menus in Chinese, startup < 3s interactive
- [ ] Visual compliance: no rust red (#C0392B), full 2.0 cream + warm brown theme
- [ ] Chinese localization 100% complete for desktop-specific UI

## Current State Analysis

**Already Implemented**:
- ✅ Basic Tauri 2 + SolidJS infrastructure
- ✅ Chinese i18n framework (`packages/desktop/src/i18n/zh.ts`)  
- ✅ Menu structure with partial Chinese translations
- ✅ Branch `feat/desktop-v1.3.0-m1` active

**Requires Completion**:
- ❌ Complete brand asset replacement
- ❌ Full Chinese menu localization verification
- ❌ Startup performance optimization < 3s
- ❌ Visual token audit and compliance enforcement

## Architecture

### 1. Brand Replacement System

**Purpose**: Complete RAILWISE branding throughout desktop application
**Why**: Document requires "品牌替换完成" as M1 deliverable
**How to apply**: Systematic replacement of all app identity, visual assets, and text references

#### Components

**App Configuration**
- Update `packages/desktop/src-tauri/tauri.conf.json`:
  - `productName`: "RAILWISE 智测工作台"
  - `bundle.identifier`: "ai.railwise.desktop.dev"
  - `bundle.displayName`: "RAILWISE"
- Verify main process binary name matches document requirement: "RAILWISE"

**Visual Assets**
- Audit `packages/desktop/src-tauri/icons/railwise/` directory
- Ensure consistent iconography for macOS DMG and Windows NSIS artifacts
- Update splash screen and loading assets in `src-tauri/assets/`
- Verify NSIS installer assets (`nsis-header-railwise.bmp`, `nsis-sidebar-railwise.bmp`)

**Menu Branding**
- Verify `packages/desktop/src/menu.ts` uses consistent "睿威智测" branding
- Update application menu root name to match Chinese brand
- Ensure all menu text aligns with `zh.ts` translations

### 2. Complete Chinese Internationalization

**Purpose**: Achieve 100% Chinese localization for desktop UI elements
**Why**: Document requires "菜单全中文" as M1 requirement  
**How to apply**: Systematic audit and completion of all user-facing text

#### Components

**Menu Localization Audit**
```typescript
// Target coverage in packages/desktop/src/i18n/zh.ts
const requiredTranslations = {
  "desktop.menu.*": "All menu items",
  "desktop.dialog.*": "File picker dialogs", 
  "desktop.error.*": "Error messages",
  "desktop.loading.*": "Loading states",
  "desktop.status.*": "Connection status"
}
```

**Error Message Localization**
- Startup errors in `packages/desktop/src/index.tsx`
- Sidecar connection failures in ServerGate component
- File system permission errors
- Update checker and installation messages

**Loading State Text**
- Splash screen text in `packages/desktop/src/loading.tsx`  
- Server initialization messages
- "正在启动 RAILWISE 核心服务..." style messages

### 3. Startup Performance Optimization

**Purpose**: Achieve < 3s from launch to interactive state
**Why**: Document specifies "启动 < 3s 可交互" as M1 requirement
**How to apply**: Optimize critical path from app launch through sidecar initialization to UI ready

#### Components

**Sidecar Initialization Pipeline**
```typescript
// Optimize this flow in packages/desktop/src/index.tsx
const startupPipeline = [
  "killSidecar", // Clean previous instance
  "awaitInitialization", // Start new sidecar  
  "getDefaultServerUrl", // Negotiate port
  "ServerGate health check", // Verify connectivity
  "AppInterface ready" // UI interactive
]
```

**Performance Monitoring**
- Add startup timing telemetry at each phase
- Configurable timeout thresholds
- Performance budget enforcement (< 3s total)

**Asset Loading Optimization**  
- Audit bundle size of initial load
- Lazy load non-critical desktop-specific components
- Optimize `@railwise/app` dependency loading

**Splash Screen Enhancement**
- Responsive progress indication during initialization
- Phase-specific messaging ("正在启动核心服务", "正在连接服务器", "正在加载界面")
- Error state handling with Chinese messages

### 4. Visual Token Compliance

**Purpose**: Enforce 2.0 design system, eliminate prohibited colors
**Why**: Document requires "全流程无铁锈红 #C0392B,视觉完整继承 2.0 奶白+暖棕规范"
**How to apply**: Systematic audit and enforcement of design token compliance

#### Components

**Color System Audit**
- Scan `packages/desktop/src/styles.css` for hardcoded colors
- Verify no usage of rust red (#C0392B) anywhere in codebase
- Enforce CSS custom property usage for all colors

**Design Token Structure**
```css
/* Target structure for packages/desktop/src/styles.css */
:root {
  /* 2.0 Base Palette - 奶白+暖棕 */
  --railwise-cream-white: #FEFEFE;
  --railwise-warm-brown: #8B4513; 
  
  /* Functional Colors (allowed) */
  --railwise-success: #52c41a;
  --railwise-warning: #faad14;
  --railwise-error: #ff4d4f;
  --railwise-info: #1890ff;
  
  /* Derived tokens */
  --railwise-bg-primary: var(--railwise-cream-white);
  --railwise-text-primary: var(--railwise-warm-brown);
}
```

**Component Inheritance**
- Verify proper cascade from `@railwise/ui` component library
- Ensure desktop-specific styles extend rather than override base tokens
- Maintain consistency with `packages/app` shared components

## Implementation Strategy

### Phase 1: Brand & Assets (Est. 2-3 commits)
1. Update Tauri configuration and app metadata
2. Audit and update visual assets (icons, splash, NSIS)
3. Verify menu branding consistency

### Phase 2: i18n Completion (Est. 2-3 commits)  
1. Audit existing `zh.ts` translations for completeness
2. Add missing desktop-specific translations
3. Localize error messages and loading states

### Phase 3: Performance Optimization (Est. 3-4 commits)
1. Add startup timing instrumentation
2. Optimize sidecar initialization pipeline
3. Enhance splash screen with progress indication
4. Bundle size optimization

### Phase 4: Visual Compliance (Est. 2-3 commits)
1. Audit CSS for rust red usage and hardcoded colors
2. Implement proper design token structure  
3. Verify component inheritance and consistency

## Testing Strategy

**Startup Performance**
- Automated timing tests: `bun run dev:desktop` → interactive < 3s
- Desktop verification covers macOS public builds and Windows x64 internal builds only
- Cold start vs. warm start measurements

**Localization Testing**
- Visual inspection of all menus in Chinese
- Error scenario testing with Chinese messages
- Fallback behavior verification

**Visual Compliance**
- Automated color scanning for prohibited rust red
- Design token usage verification
- Cross-component consistency checks

## Success Metrics

**M1 Completion Criteria**:
1. ✅ `bun run dev:desktop` → interactive in < 3s consistently
2. ✅ All desktop menus display in Chinese (菜单全中文)
3. ✅ Brand identity fully replaced with RAILWISE assets
4. ✅ Zero rust red (#C0392B) usage throughout application
5. ✅ Visual tokens properly inherit 2.0 奶白+暖棕 palette

**Quality Gates**:
- `bun turbo typecheck` passes with zero errors
- No console errors during startup sequence
- Visual regression test baseline established
- Performance budget maintained across platforms

## Dependencies & Constraints

**Upstream Dependencies**:
- `@railwise/app` component library (no modifications allowed)
- `@railwise/ui` design token source (read-only)
- Tauri 2.9.5 + Bun 1.3.9 version lock

**Constraint Adherence**:
- 核心零侵入: No modifications to `packages/railwise/src/` 
- 视觉令牌单一来源: Only reference CSS variables from existing system
- Windows 专项约束: Maintain SSE fetch via `@tauri-apps/plugin-http`

## Risk Mitigation

**Startup Performance Risk**: If < 3s proves difficult on Windows
- **Mitigation**: Implement progressive loading, optimize sidecar startup sequence

**i18n Completeness Risk**: Missing translations discovered late  
- **Mitigation**: Systematic audit process, automated translation coverage checks

**Visual Compliance Risk**: Inherited styles violate color rules
- **Mitigation**: CSS scanning tools, design token enforcement patterns

---

This specification provides the foundation for systematic M1 completion, ensuring all requirements are met before advancing to M2 Agent Studio development.
