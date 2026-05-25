import { stat, unlink } from 'node:fs/promises'

import { test, expect } from '@playwright/test'

import { readPersistedSqlite } from './helpers/persistedDb'

/** 스키마만 있어도 SQLite 파일 헤더 + 빈 페이지로 수 KB 이상 예상 */
const MIN_DB_BYTES = 800

test.describe('Issue #1 — PWA scaffold & SQLite persistence', () => {
  test('manifest JSON 및 앱 부트(E2E dev 는 SW 미등록)', async ({ page, request }) => {
    const res = await request.get('/manifest.webmanifest')
    expect(res.ok(), await res.text()).toBeTruthy()
    const manifest = await res.json()
    expect(manifest.short_name ?? manifest.name).toBe('restTime')

    await page.goto('/today')
    await expect(page.locator('.brand')).toBeVisible({ timeout: 60_000 })
    // Playwright 웹 서버는 VITE_E2E=1 로 기동되어 main.ts 에서 SW 를 끈다(sql.js 초기화·dev 충돌 방지).
    // SW 활성 상태 검증은 `npm run dev` 일반 실행 또는 preview 배포 브라우저에서 확인.
  })

  test('하단 네비: 오늘 / 주간 / 설정 라우팅', async ({ page }) => {
    await page.goto('/today')
    await expect(page.locator('.brand')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('.brand')).toContainText('restTime')
    await expect(page.getByRole('navigation', { name: '주요 화면' })).toBeVisible()

    await page.getByRole('link', { name: '주간' }).click()
    await expect(page).toHaveURL(/\/week$/)

    await page.getByRole('link', { name: '설정' }).click()
    await expect(page).toHaveURL(/\/settings$/)

    await page.getByRole('link', { name: '오늘' }).click()
    await expect(page).toHaveURL(/\/today$/)
  })

  test('새로고침 후에도 로컬 DB 바이너리 유지(OPFS 또는 IndexedDB)', async ({ page }) => {
    await page.goto('/today')
    await expect(page.locator('.brand')).toBeVisible({ timeout: 60_000 })

    await expect
      .poll(async () => (await readPersistedSqlite(page))?.bytes ?? 0, {
        timeout: 20_000,
        intervals: [100, 200, 400, 800],
      })
      .toBeGreaterThanOrEqual(MIN_DB_BYTES)

    const before = await readPersistedSqlite(page)
    expect(before).not.toBeNull()

    await page.reload()
    await expect(page.locator('.brand')).toBeVisible({ timeout: 60_000 })

    const after = await readPersistedSqlite(page)
    expect(after).not.toBeNull()
    expect(after!.backend).toBe(before!.backend)
    expect(after!.bytes).toBeGreaterThanOrEqual(MIN_DB_BYTES)
    // 동일 브라우저 컨텍스트에서는 바이너리 길이가 동일해야 함(sql.js 재 export 가 동일)
    expect(Math.abs(after!.bytes - before!.bytes)).toBeLessThan(128)
  })

  test('설정 화면: export → import 라운드트립(에러 알럿 없음)', async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(browserName !== 'chromium', '다운로드·파일 업로드는 Chromium 우선 검증')

    await page.goto('/settings')
    await expect(page.locator('.brand')).toBeVisible({ timeout: 60_000 })

    page.on('dialog', (d) => {
      throw new Error(`가져오기 실패 알럿이 떴나요?: ${d.message()}`)
    })

    await expect
      .poll(async () => (await readPersistedSqlite(page))?.bytes ?? 0, {
        timeout: 20_000,
        intervals: [100, 200, 400, 800],
      })
      .toBeGreaterThanOrEqual(MIN_DB_BYTES)

    const beforeRoundTrip = await readPersistedSqlite(page)

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'DB 내보내기(blob)' }).click()
    const download = await downloadPromise
    const tmpPath = testInfo.outputPath(`roundtrip-${Date.now()}.sqlite`)
    await download.saveAs(tmpPath)
    const exportedSize = (await stat(tmpPath)).size
    expect(exportedSize).toBeGreaterThanOrEqual(MIN_DB_BYTES)

    try {
      const uploadInput = page.locator('.el-upload input[type="file"]')
      await uploadInput.setInputFiles(tmpPath)

      // 가져오기 후 OPFS/IndexedDB 에 기록된 길이가 내보낸 파일과 거의 같아야 함
      await expect
        .poll(
          async () => {
            const cur = await readPersistedSqlite(page)
            if (!cur) return Number.POSITIVE_INFINITY
            return Math.abs(cur.bytes - exportedSize)
          },
          { timeout: 20_000, intervals: [100, 200, 400, 800] },
        )
        .toBeLessThanOrEqual(256)

      const afterRoundTrip = await readPersistedSqlite(page)
      expect(afterRoundTrip).not.toBeNull()
      expect(afterRoundTrip!.backend).toBe(beforeRoundTrip!.backend)
      expect(afterRoundTrip!.bytes).toBeGreaterThanOrEqual(MIN_DB_BYTES)
      // 같은 앱에서 내보낸 blob 을 되살리므로 디스크에 저장된 바이너리 길이와 거의 일치해야 함
      expect(Math.abs(afterRoundTrip!.bytes - exportedSize)).toBeLessThanOrEqual(256)
    } finally {
      await unlink(tmpPath).catch(() => {})
    }
  })
})
