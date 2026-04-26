#!/usr/bin/env bun

/**
 * Performance Analysis Script for RAILWISE Desktop
 *
 * This script analyzes bundle size and startup performance to ensure
 * we meet the M1 Foundation requirement of < 3s startup time.
 *
 * Usage:
 *   bun run scripts/analyze-performance.ts
 */

import { readdir, stat, readFile } from 'fs/promises'
import { join } from 'path'

interface BundleStats {
  name: string
  size: number
  gzipSize?: number
}

interface PerformanceReport {
  totalBundleSize: number
  bundleCount: number
  largestBundle: BundleStats
  recommendations: string[]
}

const PERFORMANCE_THRESHOLDS = {
  // Bundle size thresholds (bytes)
  TOTAL_BUNDLE_LIMIT: 5 * 1024 * 1024, // 5MB total
  SINGLE_BUNDLE_LIMIT: 1 * 1024 * 1024, // 1MB per bundle

  // Startup time budget (ms)
  STARTUP_BUDGET: 3000, // 3s total startup

  // Critical phase budgets (ms)
  APP_INIT_BUDGET: 500,
  SIDECAR_INIT_BUDGET: 2000,
  SERVER_CONNECT_BUDGET: 1000,
  UI_READY_BUDGET: 500
}

async function analyzeBundle(distPath: string): Promise<BundleStats[]> {
  const bundles: BundleStats[] = []

  try {
    const files = await readdir(distPath)

    for (const file of files) {
      const filePath = join(distPath, file)
      const stats = await stat(filePath)

      if (stats.isFile() && (file.endsWith('.js') || file.endsWith('.css'))) {
        bundles.push({
          name: file,
          size: stats.size
        })
      }
    }
  } catch (error) {
    console.warn('Could not analyze bundle directory:', error.message)
  }

  return bundles.sort((a, b) => b.size - a.size)
}

function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
}

function generateRecommendations(bundles: BundleStats[]): string[] {
  const recommendations: string[] = []

  const totalSize = bundles.reduce((sum, bundle) => sum + bundle.size, 0)

  // Bundle size recommendations
  if (totalSize > PERFORMANCE_THRESHOLDS.TOTAL_BUNDLE_LIMIT) {
    recommendations.push(`🚨 Total bundle size (${formatBytes(totalSize)}) exceeds 5MB limit`)
  }

  const largeBundles = bundles.filter(b => b.size > PERFORMANCE_THRESHOLDS.SINGLE_BUNDLE_LIMIT)
  if (largeBundles.length > 0) {
    recommendations.push(`⚠️ Large bundles detected: ${largeBundles.map(b => `${b.name} (${formatBytes(b.size)})`).join(', ')}`)
    recommendations.push('💡 Consider code splitting or lazy loading for large modules')
  }

  // Performance optimizations
  if (totalSize > 2 * 1024 * 1024) { // > 2MB
    recommendations.push('💡 Consider enabling gzip compression')
    recommendations.push('💡 Implement tree-shaking to remove unused code')
    recommendations.push('💡 Use dynamic imports for non-critical features')
  }

  // Startup specific recommendations
  recommendations.push('🚀 Startup Performance Optimizations:')
  recommendations.push('  - Keep app-init phase under 500ms (critical setup only)')
  recommendations.push('  - Optimize sidecar health check (reduced to 2s timeout)')
  recommendations.push('  - Implement server URL caching for faster reconnection')
  recommendations.push('  - Use progressive loading for UI components')

  return recommendations
}

async function analyzePerformanceConfig(): Promise<void> {
  console.log('\n📊 Performance Configuration Analysis\n')

  // Check if performance budget is properly configured
  try {
    const performanceTsPath = join(process.cwd(), 'src', 'performance.ts')
    const performanceCode = await readFile(performanceTsPath, 'utf-8')

    if (performanceCode.includes('DEFAULT_BUDGETS')) {
      console.log('✅ Performance budgets configured')

      // Extract budget values
      const appInitMatch = performanceCode.match(/'app-init':\s*{\s*budget:\s*(\d+)/)
      const sidecarInitMatch = performanceCode.match(/'sidecar-init':\s*{\s*budget:\s*(\d+)/)

      if (appInitMatch) {
        const budget = parseInt(appInitMatch[1])
        console.log(`  - App Init Budget: ${budget}ms ${budget <= PERFORMANCE_THRESHOLDS.APP_INIT_BUDGET ? '✅' : '⚠️'}`)
      }

      if (sidecarInitMatch) {
        const budget = parseInt(sidecarInitMatch[1])
        console.log(`  - Sidecar Init Budget: ${budget}ms ${budget <= PERFORMANCE_THRESHOLDS.SIDECAR_INIT_BUDGET ? '✅' : '⚠️'}`)
      }
    } else {
      console.log('❌ Performance budgets not found')
    }
  } catch (error) {
    console.log('⚠️ Could not analyze performance configuration:', error.message)
  }
}

async function main(): Promise<void> {
  console.log('🔍 RAILWISE Desktop Performance Analysis')
  console.log('=====================================\n')

  // Analyze bundle if dist exists
  const distPath = join(process.cwd(), 'dist')
  const bundles = await analyzeBundle(distPath)

  if (bundles.length > 0) {
    console.log('📦 Bundle Analysis\n')

    const totalSize = bundles.reduce((sum, bundle) => sum + bundle.size, 0)

    console.log(`Total Bundle Size: ${formatBytes(totalSize)}`)
    console.log(`Bundle Count: ${bundles.length}`)
    console.log('\nBundle Breakdown:')

    bundles.slice(0, 10).forEach((bundle, i) => {
      const sizeWarning = bundle.size > PERFORMANCE_THRESHOLDS.SINGLE_BUNDLE_LIMIT ? ' ⚠️' : ''
      console.log(`  ${i + 1}. ${bundle.name}: ${formatBytes(bundle.size)}${sizeWarning}`)
    })

    if (bundles.length > 10) {
      console.log(`  ... and ${bundles.length - 10} more bundles`)
    }

    // Generate recommendations
    const recommendations = generateRecommendations(bundles)

    console.log('\n💡 Recommendations\n')
    recommendations.forEach(rec => console.log(rec))
  } else {
    console.log('📦 No bundle files found. Run `bun run build` first to analyze production bundles.\n')
  }

  // Analyze performance configuration
  await analyzePerformanceConfig()

  console.log('\n🎯 Performance Targets')
  console.log('=====================')
  console.log(`Startup Budget: < ${PERFORMANCE_THRESHOLDS.STARTUP_BUDGET}ms`)
  console.log(`App Init: < ${PERFORMANCE_THRESHOLDS.APP_INIT_BUDGET}ms`)
  console.log(`Sidecar Init: < ${PERFORMANCE_THRESHOLDS.SIDECAR_INIT_BUDGET}ms`)
  console.log(`Server Connect: < ${PERFORMANCE_THRESHOLDS.SERVER_CONNECT_BUDGET}ms`)
  console.log(`UI Ready: < ${PERFORMANCE_THRESHOLDS.UI_READY_BUDGET}ms`)

  console.log('\n✨ To improve startup performance:')
  console.log('1. Run this script after `bun run build` to check bundle sizes')
  console.log('2. Monitor startup logs for phase timing')
  console.log('3. Use fallback strategies when timeouts are exceeded')
  console.log('4. Test on slower hardware to ensure budget compliance')
}

// Run the analysis
main().catch(console.error)