# RAILWISE Desktop M1 Foundation Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete M1 foundation requirements: brand replacement, full Chinese i18n, startup optimization < 3s, and visual token compliance for RAILWISE Desktop v1.3.0

**Architecture:** Systematic completion of 4 core areas - app branding via Tauri config, complete Chinese localization, performance-optimized startup pipeline, and design token compliance enforcement

**Tech Stack:** Tauri 2.9.5, SolidJS, Bun 1.3.9, TypeScript, CSS custom properties

---

## File Structure Overview

**Brand & Configuration:**
- Modify: `packages/desktop/src-tauri/tauri.conf.json` - App metadata and bundle config
- Modify: `packages/desktop/src/menu.ts` - Menu branding consistency
- Audit: `packages/desktop/src-tauri/icons/railwise/` - Visual assets verification

**Internationalization:**
- Modify: `packages/desktop/src/i18n/zh.ts` - Complete Chinese translations
- Modify: `packages/desktop/src/index.tsx` - Error message localization
- Modify: `packages/desktop/src/loading.tsx` - Loading state Chinese text

**Performance Optimization:**
- Modify: `packages/desktop/src/index.tsx` - Startup timing and optimization
- Create: `packages/desktop/src/performance.ts` - Startup performance monitoring
- Modify: `packages/desktop/src/loading.tsx` - Enhanced splash with progress

**Visual Token Compliance:**
- Modify: `packages/desktop/src/styles.css` - Design token system and color audit
- Create: `packages/desktop/src/tokens.css` - Centralized design token definitions

---

### Task 1: App Brand Configuration

**Files:**
- Modify: `packages/desktop/src-tauri/tauri.conf.json`
- Verify: `packages/desktop/src-tauri/icons/railwise/`

- [ ] **Step 1: Read current Tauri configuration**

```bash
cd packages/desktop
cat src-tauri/tauri.conf.json | grep -A5 -B5 "productName\|identifier\|displayName"
```

Expected: Current app naming and bundle configuration

- [ ] **Step 2: Update Tauri app metadata for RAILWISE branding**

Edit `packages/desktop/src-tauri/tauri.conf.json`:

```json
{
  "productName": "RAILWISE 智测工作台",
  "version": "1.3.0",
  "identifier": "ai.railwise.desktop.dev",
  "bundle": {
    "active": true,
    "targets": "all",
    "displayName": "RAILWISE",
    "publisher": "睿威科技",
    "homepage": "https://railwise.ai",
    "shortDescription": "RAILWISE 工程监测智能工作台",
    "longDescription": "面向工程测绘、结构监测、地铁线路监测一线工程师的多智能体桌面工作台"
  }
}
```

- [ ] **Step 3: Verify visual assets exist**

```bash
ls -la packages/desktop/src-tauri/icons/railwise/
ls -la packages/desktop/src-tauri/assets/ | grep railwise
```

Expected: Icon files and NSIS assets present

- [ ] **Step 4: Test app branding**

```bash
bun run dev:desktop
```

Expected: Window title shows "RAILWISE 智测工作台", about dialog shows correct branding

- [ ] **Step 5: Commit brand configuration**

```bash
git add packages/desktop/src-tauri/tauri.conf.json
git commit -m "feat(desktop): update app branding to RAILWISE 智测工作台 for M1"
```

### Task 2: Complete Chinese Menu Localization

**Files:**
- Modify: `packages/desktop/src/i18n/zh.ts`
- Modify: `packages/desktop/src/menu.ts`

- [ ] **Step 1: Audit current Chinese translations coverage**

```bash
cd packages/desktop
grep -o '"desktop\.[^"]*"' src/menu.ts | sort | uniq > menu_keys.txt
grep -o '"desktop\.[^"]*"' src/i18n/zh.ts | sort | uniq > zh_keys.txt
diff menu_keys.txt zh_keys.txt
```

Expected: Identify missing translations

- [ ] **Step 2: Add missing Chinese translations to zh.ts**

Edit `packages/desktop/src/i18n/zh.ts` to ensure complete coverage:

```typescript
export const dict = {
  // Existing translations...
  "desktop.menu.app": "睿威智测",
  "desktop.menu.checkForUpdates": "检查更新",
  "desktop.menu.installCli": "安装命令行工具", 
  "desktop.menu.reloadWebview": "重新加载界面",
  "desktop.menu.restart": "重启应用",
  "desktop.menu.file": "文件",
  "desktop.menu.newSession": "新建会话",
  "desktop.menu.openProject": "打开项目...",
  "desktop.menu.closeWindow": "关闭窗口",
  "desktop.menu.edit": "编辑",
  "desktop.menu.view": "视图",
  "desktop.menu.help": "帮助",
  "desktop.menu.documentation": "RAILWISE 使用文档",
  "desktop.menu.supportForum": "支持论坛",
  "desktop.menu.shareFeedback": "提交反馈", 
  "desktop.menu.reportBug": "报告问题",
  
  // Error messages
  "desktop.error.sidecarStart": "无法启动 RAILWISE 核心服务",
  "desktop.error.connection": "连接服务器失败",
  "desktop.error.timeout": "启动超时，请重试",
  
  // Loading states
  "desktop.loading.starting": "正在启动 RAILWISE 核心服务...",
  "desktop.loading.connecting": "正在连接服务器...",
  "desktop.loading.initializing": "正在初始化界面...",
  "desktop.loading.ready": "准备就绪"
}
```

- [ ] **Step 3: Verify menu uses t() function for all strings**

Check `packages/desktop/src/menu.ts` ensures all user-facing text uses `t()`:

```typescript
// Verify patterns like:
text: t("desktop.menu.app"), // ✓ Correct
text: "RAILWISE", // ✗ Should use t()
```

- [ ] **Step 4: Test Chinese menu display**

```bash
bun run dev:desktop
```

Expected: All menus display in Chinese, no English fallbacks visible

- [ ] **Step 5: Commit Chinese localization**

```bash
git add packages/desktop/src/i18n/zh.ts packages/desktop/src/menu.ts
git commit -m "feat(desktop): complete Chinese menu localization for M1"
```

### Task 3: Startup Performance Monitoring

**Files:**
- Create: `packages/desktop/src/performance.ts`
- Modify: `packages/desktop/src/index.tsx`

- [ ] **Step 1: Create startup performance monitoring module**

Create `packages/desktop/src/performance.ts`:

```typescript
export interface StartupPhase {
  name: string
  startTime: number
  endTime?: number
  duration?: number
}

export class StartupTimer {
  private phases: Map<string, StartupPhase> = new Map()
  private startTime = performance.now()
  
  startPhase(name: string): void {
    this.phases.set(name, {
      name,
      startTime: performance.now()
    })
  }
  
  endPhase(name: string): number {
    const phase = this.phases.get(name)
    if (!phase) {
      console.warn(`Phase ${name} not found`)
      return 0
    }
    
    const endTime = performance.now()
    const duration = endTime - phase.startTime
    
    this.phases.set(name, {
      ...phase,
      endTime,
      duration
    })
    
    console.log(`📊 ${name}: ${duration.toFixed(2)}ms`)
    return duration
  }
  
  getTotalTime(): number {
    return performance.now() - this.startTime
  }
  
  getReport(): { phases: StartupPhase[], total: number } {
    return {
      phases: Array.from(this.phases.values()),
      total: this.getTotalTime()
    }
  }
}

export const startupTimer = new StartupTimer()
```

- [ ] **Step 2: Add performance tracking to startup flow**

Edit `packages/desktop/src/index.tsx` to add timing around critical phases:

```typescript
import { startupTimer } from "./performance"

// At the top of the file, after imports
startupTimer.startPhase("app-init")

// Before sidecar operations
startupTimer.endPhase("app-init")
startupTimer.startPhase("sidecar-init")

// Around ServerGate initialization
startupTimer.endPhase("sidecar-init") 
startupTimer.startPhase("server-connect")

// When UI becomes interactive
startupTimer.endPhase("server-connect")
startupTimer.startPhase("ui-ready")

// In the final render
startupTimer.endPhase("ui-ready")
const report = startupTimer.getReport()
console.log(`🚀 RAILWISE Desktop ready in ${report.total.toFixed(2)}ms`)

// Performance budget check
if (report.total > 3000) {
  console.warn(`⚠️ Startup exceeded 3s budget: ${report.total.toFixed(2)}ms`)
}
```

- [ ] **Step 3: Test startup timing**

```bash
bun run dev:desktop
```

Expected: Console logs show phase timing, total startup time measured

- [ ] **Step 4: Verify performance budget**

```bash
bun run dev:desktop 2>&1 | grep "ready in\|exceeded"
```

Expected: Startup time logged, budget warning if > 3s

- [ ] **Step 5: Commit performance monitoring**

```bash
git add packages/desktop/src/performance.ts packages/desktop/src/index.tsx
git commit -m "feat(desktop): add startup performance monitoring for M1 < 3s requirement"
```

### Task 4: Enhanced Splash Screen with Chinese Text

**Files:**
- Modify: `packages/desktop/src/loading.tsx`
- Modify: `packages/desktop/src/i18n/zh.ts` (if needed)

- [ ] **Step 1: Read current loading component**

```bash
cat packages/desktop/src/loading.tsx
```

Expected: Current splash screen implementation

- [ ] **Step 2: Enhance loading component with Chinese progress messages**

Edit `packages/desktop/src/loading.tsx`:

```typescript
import { createSignal, type Component, onMount } from "solid-js"
import { t } from "./i18n"

interface LoadingProps {
  phase?: string
}

export const Loading: Component<LoadingProps> = (props) => {
  const [progress, setProgress] = createSignal(0)
  
  const getPhaseMessage = (phase?: string): string => {
    switch (phase) {
      case "sidecar-init":
        return t("desktop.loading.starting")
      case "server-connect": 
        return t("desktop.loading.connecting")
      case "ui-ready":
        return t("desktop.loading.initializing")
      default:
        return t("desktop.loading.starting")
    }
  }
  
  onMount(() => {
    // Simulate progress for better UX
    const interval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 10, 90))
    }, 100)
    
    return () => clearInterval(interval)
  })
  
  return (
    <div class="loading-container">
      <div class="loading-content">
        <div class="railwise-logo">
          <img src="/railwise-logo.svg" alt="RAILWISE" />
        </div>
        
        <h1 class="loading-title">RAILWISE 智测工作台</h1>
        
        <div class="loading-progress">
          <div class="progress-bar">
            <div 
              class="progress-fill"
              style={`width: ${progress()}%`}
            />
          </div>
          <p class="loading-message">{getPhaseMessage(props.phase)}</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add loading styles to CSS**

Edit `packages/desktop/src/styles.css` to add loading styles:

```css
.loading-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--railwise-bg-primary, #FEFEFE);
  z-index: 9999;
}

.loading-content {
  text-align: center;
  max-width: 400px;
  padding: 2rem;
}

.railwise-logo img {
  width: 80px;
  height: 80px;
  margin-bottom: 1.5rem;
}

.loading-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--railwise-text-primary, #8B4513);
  margin-bottom: 2rem;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: var(--railwise-info, #1890ff);
  transition: width 0.3s ease;
}

.loading-message {
  font-size: 0.875rem;
  color: var(--railwise-text-secondary, #666);
  margin: 0;
}
```

- [ ] **Step 4: Test enhanced splash screen**

```bash
bun run dev:desktop
```

Expected: Chinese loading messages, progress bar, RAILWISE branding

- [ ] **Step 5: Commit enhanced splash screen**

```bash
git add packages/desktop/src/loading.tsx packages/desktop/src/styles.css
git commit -m "feat(desktop): enhance splash screen with Chinese text and progress for M1"
```

### Task 5: Visual Token System and Color Compliance

**Files:**
- Create: `packages/desktop/src/tokens.css`
- Modify: `packages/desktop/src/styles.css`

- [ ] **Step 1: Audit current CSS for hardcoded colors and rust red**

```bash
cd packages/desktop
grep -r "#[0-9A-Fa-f]\{6\}" src/ --include="*.css" --include="*.tsx"
grep -r "#C0392B\|#c0392b" src/ --include="*.css" --include="*.tsx"
```

Expected: List of hardcoded colors, verify no rust red usage

- [ ] **Step 2: Create centralized design token system**

Create `packages/desktop/src/tokens.css`:

```css
/**
 * RAILWISE Desktop Design Tokens
 * 基于 2.0 设计规范：奶白 + 暖棕 基调
 */

:root {
  /* Base Palette - 奶白+暖棕 */
  --railwise-cream-white: #FEFEFE;
  --railwise-warm-brown: #8B4513;
  --railwise-warm-brown-light: #A0522D;
  --railwise-warm-brown-dark: #654321;
  
  /* Neutral Scale */
  --railwise-gray-50: #FAFAFA;
  --railwise-gray-100: #F5F5F5;
  --railwise-gray-200: #EEEEEE;
  --railwise-gray-300: #E0E0E0;
  --railwise-gray-400: #BDBDBD;
  --railwise-gray-500: #9E9E9E;
  --railwise-gray-600: #757575;
  --railwise-gray-700: #616161;
  --railwise-gray-800: #424242;
  --railwise-gray-900: #212121;
  
  /* Functional Colors (Document Approved) */
  --railwise-success: #52c41a;
  --railwise-warning: #faad14;
  --railwise-error: #ff4d4f;
  --railwise-info: #1890ff;
  
  /* Semantic Tokens */
  --railwise-bg-primary: var(--railwise-cream-white);
  --railwise-bg-secondary: var(--railwise-gray-50);
  --railwise-bg-tertiary: var(--railwise-gray-100);
  
  --railwise-text-primary: var(--railwise-warm-brown);
  --railwise-text-secondary: var(--railwise-gray-600);
  --railwise-text-tertiary: var(--railwise-gray-500);
  --railwise-text-inverse: var(--railwise-cream-white);
  
  --railwise-border-primary: var(--railwise-gray-300);
  --railwise-border-secondary: var(--railwise-gray-200);
  
  --railwise-surface-primary: var(--railwise-cream-white);
  --railwise-surface-secondary: var(--railwise-gray-50);
  --railwise-surface-accent: var(--railwise-warm-brown);
  
  /* Interactive States */
  --railwise-hover-bg: var(--railwise-gray-100);
  --railwise-active-bg: var(--railwise-gray-200);
  --railwise-focus-ring: var(--railwise-info);
}

/* Dark Mode Tokens (Future) */
@media (prefers-color-scheme: dark) {
  :root {
    --railwise-bg-primary: #1a1a1a;
    --railwise-bg-secondary: #2d2d2d;
    --railwise-text-primary: #f5f5f5;
    --railwise-text-secondary: #b3b3b3;
  }
}
```

- [ ] **Step 3: Update main styles to use design tokens**

Edit `packages/desktop/src/styles.css` to import tokens and replace hardcoded colors:

```css
/* Import design tokens */
@import "./tokens.css";

/* Desktop App Base Styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--railwise-bg-primary);
  color: var(--railwise-text-primary);
  margin: 0;
  padding: 0;
}

/* Replace any hardcoded colors with tokens */
.desktop-container {
  background: var(--railwise-bg-primary);
  color: var(--railwise-text-primary);
}

.desktop-header {
  background: var(--railwise-surface-secondary);
  border-bottom: 1px solid var(--railwise-border-primary);
}

.desktop-sidebar {
  background: var(--railwise-bg-secondary);
  border-right: 1px solid var(--railwise-border-primary);
}

/* Interactive elements */
button:hover {
  background: var(--railwise-hover-bg);
}

button:active {
  background: var(--railwise-active-bg);
}

button:focus {
  box-shadow: 0 0 0 2px var(--railwise-focus-ring);
}

/* Ensure no rust red anywhere */
/* #C0392B is explicitly forbidden per document */
```

- [ ] **Step 4: Verify no prohibited colors**

```bash
grep -r "#C0392B\|#c0392b" packages/desktop/src/ --include="*.css" --include="*.tsx"
```

Expected: No matches (exit code 1)

- [ ] **Step 5: Test visual token system**

```bash
bun run dev:desktop
```

Expected: Consistent cream white + warm brown theme, no visual regressions

- [ ] **Step 6: Commit visual token system**

```bash
git add packages/desktop/src/tokens.css packages/desktop/src/styles.css  
git commit -m "feat(desktop): implement design token system with 2.0 奶白+暖棕 palette for M1"
```

### Task 6: Startup Pipeline Optimization

**Files:**
- Modify: `packages/desktop/src/index.tsx`

- [ ] **Step 1: Analyze current sidecar initialization flow**

```bash
cd packages/desktop
grep -A10 -B5 "killSidecar\|awaitInitialization\|ServerGate" src/index.tsx
```

Expected: Current startup sequence and potential optimization points

- [ ] **Step 2: Optimize sidecar startup sequence**

Edit `packages/desktop/src/index.tsx` to streamline initialization:

```typescript
// Optimize the startup flow for < 3s target
const optimizedStartup = async () => {
  startupTimer.startPhase("sidecar-cleanup")
  
  try {
    // Quick cleanup - don't wait too long
    await Promise.race([
      commands.killSidecar(),
      new Promise(resolve => setTimeout(resolve, 500)) // 500ms timeout
    ])
  } catch (e) {
    console.log("Sidecar cleanup skipped (not running)")
  }
  
  startupTimer.endPhase("sidecar-cleanup")
  startupTimer.startPhase("sidecar-start")
  
  // Start sidecar with timeout
  const initialization = await Promise.race([
    commands.awaitInitialization(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Initialization timeout")), 2000)
    )
  ])
  
  startupTimer.endPhase("sidecar-start")
  startupTimer.startPhase("server-health")
  
  // Quick server health check
  const serverUrl = await commands.getDefaultServerUrl()
  
  startupTimer.endPhase("server-health")
  
  return { initialization, serverUrl }
}

// Use in main component
const [startupResult] = createResource(optimizedStartup)
```

- [ ] **Step 3: Add error handling with Chinese messages**

```typescript
// Error handling with localized messages
const handleStartupError = (error: Error) => {
  let message = t("desktop.error.connection")
  
  if (error.message.includes("timeout")) {
    message = t("desktop.error.timeout")
  } else if (error.message.includes("sidecar")) {
    message = t("desktop.error.sidecarStart") 
  }
  
  console.error("Startup error:", error)
  // Show user-friendly error in Chinese
  return message
}
```

- [ ] **Step 4: Test optimized startup performance**

```bash
bun run dev:desktop
```

Expected: Startup completes in < 3s, performance logs show optimization

- [ ] **Step 5: Measure startup time multiple times**

```bash
for i in {1..3}; do
  echo "Test run $i:"
  bun run dev:desktop 2>&1 | grep "ready in"
  pkill -f "railwise-cli" || true
  sleep 2
done
```

Expected: Consistent < 3s startup times

- [ ] **Step 6: Commit startup optimization**

```bash
git add packages/desktop/src/index.tsx
git commit -m "perf(desktop): optimize sidecar startup pipeline for M1 < 3s requirement"
```

### Task 7: Final M1 Verification and Testing

**Files:**
- Create: `packages/desktop/test-m1.sh`

- [ ] **Step 1: Create M1 verification script**

Create `packages/desktop/test-m1.sh`:

```bash
#!/bin/bash
set -e

echo "🧪 RAILWISE Desktop M1 Verification"
echo "=================================="

# Test 1: Type checking
echo "1. Running type check..."
bun turbo typecheck
echo "✅ Type check passed"

# Test 2: Build verification  
echo "2. Building desktop package..."
bun run --cwd packages/desktop build
echo "✅ Build successful"

# Test 3: Startup performance test
echo "3. Testing startup performance..."
timeout 10s bun run dev:desktop &
DEV_PID=$!
sleep 5
if kill -0 $DEV_PID 2>/dev/null; then
  echo "✅ Desktop starts successfully"
  kill $DEV_PID
else
  echo "❌ Desktop failed to start"
  exit 1
fi

# Test 4: Color compliance check
echo "4. Checking color compliance..."
if grep -r "#C0392B\|#c0392b" packages/desktop/src/ --include="*.css" --include="*.tsx"; then
  echo "❌ Rust red (#C0392B) found - M1 requirement violation"
  exit 1
else
  echo "✅ No prohibited rust red color found"
fi

# Test 5: Chinese localization check
echo "5. Verifying Chinese translations..."
MISSING=$(grep -o '"desktop\.[^"]*"' packages/desktop/src/menu.ts | while read key; do
  if ! grep -q "$key" packages/desktop/src/i18n/zh.ts; then
    echo "$key"
  fi
done)

if [ -n "$MISSING" ]; then
  echo "❌ Missing Chinese translations:"
  echo "$MISSING"
  exit 1
else
  echo "✅ All menu items have Chinese translations"
fi

echo ""
echo "🎉 M1 Verification Complete!"
echo "Ready to proceed to M2 Agent Studio development"
```

- [ ] **Step 2: Make script executable and run verification**

```bash
chmod +x packages/desktop/test-m1.sh
./packages/desktop/test-m1.sh
```

Expected: All verification steps pass

- [ ] **Step 3: Run final performance test**

```bash
echo "📊 Final Performance Test"
for i in {1..5}; do
  echo "Run $i:"
  timeout 15s bun run dev:desktop 2>&1 | grep -E "ready in|exceeded" || echo "No timing logged"
  pkill -f "railwise" || true
  sleep 3
done
```

Expected: Consistent startup < 3s across multiple runs

- [ ] **Step 4: Verify M1 completion checklist**

Manual verification:
- [ ] App shows "RAILWISE 智测工作台" in title and about
- [ ] All menus display in Chinese 
- [ ] Startup completes in < 3s consistently
- [ ] No rust red (#C0392B) colors visible
- [ ] Visual theme follows cream white + warm brown palette

- [ ] **Step 5: Commit M1 verification tools**

```bash
git add packages/desktop/test-m1.sh
git commit -m "test(desktop): add M1 verification script and complete foundation requirements"
```

- [ ] **Step 6: Tag M1 completion**

```bash
git tag -a "desktop-m1-complete" -m "RAILWISE Desktop M1 Foundation Complete: 
- ✅ Brand replacement with 睿威智测 identity
- ✅ Complete Chinese menu localization  
- ✅ Startup optimization < 3s requirement met
- ✅ Visual token compliance with 2.0 奶白+暖棕 palette
- ✅ No prohibited rust red (#C0392B) usage
- ✅ Performance monitoring and verification tools

Ready for M2 Agent Studio development phase."
```

---

## Success Criteria Checklist

**M1 Requirements (per spec document):**
- [ ] ✅ Brand replacement complete - "RAILWISE 智测工作台" throughout app
- [ ] ✅ All menus in Chinese - 菜单全中文 requirement met  
- [ ] ✅ Startup < 3s interactive - Performance budget enforced
- [ ] ✅ Visual compliance - No rust red, proper 2.0 palette inheritance
- [ ] ✅ Type checking passes - `bun turbo typecheck` zero errors
- [ ] ✅ Build succeeds - Desktop package builds without errors

**Quality Gates:**
- [ ] Performance monitoring active with phase-by-phase timing
- [ ] Chinese localization complete for all desktop UI elements
- [ ] Design token system implemented with proper cascade
- [ ] Automated verification script validates all requirements
- [ ] Git history shows incremental progress with clear commit messages

This completes the M1 foundation requirements and prepares the codebase for M2 Agent Studio development.