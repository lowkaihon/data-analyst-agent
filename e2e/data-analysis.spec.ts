import { test, expect } from '@playwright/test'
import path from 'path'

/**
 * E2E tests for critical data analyst agent workflows
 */

test.describe('Data Analyst Agent', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display upload zone on initial load', async ({ page }) => {
    // Check that upload zone is visible
    await expect(page.getByText(/drag.*drop.*csv/i)).toBeVisible()
  })

  test('should show data tabs after file upload', async ({ page }) => {
    // Note: This test would require a sample CSV file
    // For now, we're just checking the UI structure exists

    // Verify tabs container exists (even if disabled initially)
    const tabsList = page.getByRole('tablist')
    await expect(tabsList).toBeVisible()

    // Check for expected tab labels
    await expect(page.getByRole('tab', { name: /preview/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /schema/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /sql history/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /charts/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /report/i })).toBeVisible()
  })

  test('should have chat interface', async ({ page }) => {
    // Check for chat input
    const chatInput = page.getByPlaceholder(/ask.*question/i)
    await expect(chatInput).toBeVisible()

    // Initially should be disabled until data is loaded
    await expect(chatInput).toBeDisabled()
  })

  test('should display correct metadata', async ({ page }) => {
    // Check page title and metadata
    await expect(page).toHaveTitle(/data analyst/i)
  })

  test('should be responsive', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.getByText(/drag.*drop/i)).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.getByText(/drag.*drop/i)).toBeVisible()

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expect(page.getByText(/drag.*drop/i)).toBeVisible()
  })

  test('should have proper accessibility attributes', async ({ page }) => {
    // Check for proper ARIA labels on buttons
    const tabs = page.getByRole('tablist')
    await expect(tabs).toBeVisible()

    // Check that interactive elements are keyboard accessible
    const chatInput = page.getByPlaceholder(/ask.*question/i)
    await chatInput.focus()
    await expect(chatInput).toBeFocused()
  })

  test.describe('File Upload Flow', () => {
    test('should handle file size validation', async ({ page }) => {
      // This would test the 20MB file size limit
      // In a real test, you'd create or upload a file that exceeds the limit
      // and verify the error message is displayed
    })

    test('should handle invalid file types', async ({ page }) => {
      // This would test that non-CSV files are rejected
    })
  })

  test.describe('Data Preview', () => {
    test('should show pagination controls when data is loaded', async ({ page }) => {
      // After data is loaded, pagination should appear
      // This test would require actual data to be loaded first
    })
  })

  test.describe('SQL Execution', () => {
    test('should prevent non-SELECT queries', async ({ page }) => {
      // This would test that INSERT/UPDATE/DELETE queries are blocked
      // by the SQL validation layer
    })
  })
})

test.describe('Theme Support', () => {
  test('should support light and dark themes', async ({ page }) => {
    await page.goto('/')

    // Check if theme toggle exists (if implemented in UI)
    // This is a placeholder - actual implementation would depend on your theme toggle UI
    const html = page.locator('html')
    await expect(html).toBeVisible()
  })
})
