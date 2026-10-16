import { test, expect, App, installCamera } from './support/fixtures';
import { baseline, NOW, type Seed } from './support/data';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';

async function downloadBytes(download: import('@playwright/test').Download) {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test.describe('P1 release flows', { tag: '@P1' }, () => {
  test('E16 duplicate class respects trimmed values', async ({ app, page, harness }) => {
    // Leave room to open the creation form and exercise duplicate validation.
    const data: Seed = baseline();
    data.plans = [{ teacherUid: 'teacher-a', planId: 'level1', startedAt: NOW, expiresAt: '2027-11-10T05:00:00.000Z' }];
    await harness.seed(data);
    await app.login(); await page.goto('/classes');
    await page.getByTestId('school-year').selectOption('2569'); await page.getByTestId('term').selectOption('1');
    await page.getByTestId('add-class').click();
    await page.getByTestId('subject-name').fill(' คณิตศาสตร์ '); await page.getByTestId('group-name').fill(' ม.1/1 ');
    const before = await harness.snapshot();
    await page.getByTestId('save-class').click();
    await expect(page.getByTestId('form-error')).toContainText('ซ้ำ');
    expect(await harness.snapshot()).toEqual(before);
  });

  for (const number of ['', '0', '-1', '1.5', '01', '3']) {
    test(`E16 rejects invalid or reserved student number ${JSON.stringify(number)}`, async ({ app, page, harness }) => {
      await app.login(); await app.classTab('students'); await page.getByTestId('add-student').click();
      await page.getByTestId('student-number').fill(number); await page.getByTestId('student-name').fill('นักเรียน ทดสอบ');
      const before = await harness.snapshot();
      await page.getByTestId('save-student').click();
      await expect(page.getByTestId('student-number-error')).toBeVisible();
      expect(await harness.snapshot()).toEqual(before);
    });
  }

  test('E16 blank name is invalid and import over 200 rows is rejected', async ({ app, page, harness }) => {
    await app.login(); await app.classTab('students'); await page.getByTestId('add-student').click();
    await page.getByTestId('student-number').fill('4'); await page.getByTestId('student-name').fill('   ');
    await page.getByTestId('save-student').click(); await expect(page.getByTestId('student-name-error')).toBeVisible();
    await page.getByTestId('cancel-student').click();
    const before = await harness.snapshot();
    await app.excel(Array.from({ length: 201 }, (_, i) => [i + 10, `นักเรียน ${i}`]));
    await expect(page.getByTestId('import-error')).toContainText('200');
    expect(await harness.snapshot()).toEqual(before);
  });

  test('E16 formula cells cannot enter student data', async ({ app, page, harness }) => {
    await app.login(); await app.classTab('students'); const before = await harness.snapshot();
    await app.excel([[{ formula: '1+1' }, 'ชื่อ ทดสอบ']]);
    await expect(page.getByTestId('import-error')).toContainText('สูตร');
    expect(await harness.snapshot()).toEqual(before);
  });

  test('E17 task naming, rename, delete guard, clear then delete latest task', async ({ app, page, harness }) => {
    await app.login(); await app.classTab('tasks'); await page.getByTestId('add-task').click();
    await expect(page.getByTestId('task-name')).toHaveValue('ชิ้นงานที่ 4');
    await page.getByTestId('task-name').fill('งานใหม่'); await page.getByTestId('save-task').click();
    await expect(page.getByTestId('save-result')).toHaveAttribute('data-state', 'saved');
    const task = (await harness.snapshot()).tasks.find(t => t.order === 4)!; expect(task).toBeDefined();
    await page.getByTestId(`edit-task-${task.id}`).click(); await page.getByTestId('task-name').fill('งานแก้ชื่อ'); await page.getByTestId('save-task').click();
    await expect(page.getByTestId(`task-row-${task.id}`)).toContainText('งานแก้ชื่อ');
    await app.scan(); await app.read(); await expect(app.result()).toHaveAttribute('data-state', 'saved');
    await app.classTab('tasks'); await expect(page.getByTestId(`delete-task-${task.id}`)).toBeDisabled();
    await app.classTab('summary'); await app.editWork('ยังไม่ส่ง', 'student-a', task.id);
    await page.getByTestId('confirm-clear-work').getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    await expect(app.cell('student-a', task.id)).toHaveText('');
    await expect(app.cell('student-a', task.id)).toHaveClass(/not-sent/);
    await app.classTab('tasks'); await page.getByTestId(`delete-task-${task.id}`).click();
    await page.getByTestId('confirm-delete-task').getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    await expect(page.getByTestId(`task-row-${task.id}`)).toHaveCount(0);
    await page.getByTestId('add-task').click(); await expect(page.getByTestId('task-name')).toHaveValue('ชิ้นงานที่ 4');
    await page.getByTestId('cancel-task').click();
    await app.scan(); await app.read('student-a2'); await expect(app.result()).toHaveAttribute('data-state', 'saved');
    expect(await app.work('student-a2', 'task-3')).toHaveLength(1);
    expect((await harness.snapshot()).audit.some(a => a.action === 'deleteTask' && a.taskId === task.id)).toBe(true);
  });

  test('E18 class without tasks offers Add task and saves nothing', async ({ app, page, harness }) => {
    await app.login(); await app.scan(); await app.read('student-other');
    await expect(app.result()).toContainText('ยังไม่มีชิ้นงาน');
    await page.getByTestId('scan-add-task').click();
    await expect(page).toHaveURL(/\/classes\/class-other/);
    expect((await harness.snapshot()).work).toHaveLength(1);
    expect((await harness.snapshot()).tasks.filter(t => t.classId === 'class-other')).toHaveLength(0);
  });

  for (const payload of ['unknown-valid-token', 'https://example.test/should-never-open', '<script>alert(1)</script>']) {
    test(`E18 invalid QR is inert: ${payload}`, async ({ app, page }) => {
      let dialogs = 0; page.on('dialog', async d => { dialogs++; await d.dismiss(); });
      await app.login(); await app.scan(); await app.showQr(payload);
      await expect(app.result()).toHaveAttribute('data-state', 'error');
      await expect(app.result()).toContainText(/ไม่พบ|ใช้ไม่ได้|ไม่สามารถ/);
      await expect(page).toHaveURL(/\/scan$/); expect(dialogs).toBe(0); expect(await app.work()).toHaveLength(0);
      await app.showQr(null); await page.waitForTimeout(600); await app.read();
      await expect(app.result()).toHaveAttribute('data-state', 'saved');
    });
  }

  test('E18 camera blocked explains permission recovery', async ({ app, page }) => {
    await installCamera(page, true); await app.login(); await page.goto('/scan');
    await expect(page.getByTestId('camera-error')).toContainText('กล้อง');
    await expect(page.getByTestId('camera-retry')).toBeVisible(); expect(await app.work()).toHaveLength(0);
  });

  test('E18 offline before scan pauses saves until reconnect', async ({ app, page, context }) => {
    await app.login(); await app.scan(); await context.setOffline(true);
    try {
      await expect(page.getByTestId('network-error')).toContainText('อินเทอร์เน็ต');
      await app.read(); await page.waitForTimeout(800); expect(await app.work()).toHaveLength(0); expect(await app.sounds()).toHaveLength(0);
      // Remove the held QR while offline. Reconnecting restarts the camera;
      // leaving it visible can save before the explicit new scan below.
      await app.showQr(null);
    } finally { await context.setOffline(false); }
    await page.getByTestId('resume-scan').click(); await app.showQr(null); await page.waitForTimeout(600); await app.read();
    await expect(app.result()).toHaveAttribute('data-state', 'saved');
  });

  test('E19 scan status persists between students/modes/background and resets on re-entry', async ({ app, page, context }) => {
    await app.login(); await app.scan(); await expect(page.getByTestId('work-status')).toHaveValue('on-time');
    await app.status('ส่งสายระดับ 2'); await expect(page.getByTestId('late-range')).toContainText('3–7');
    await app.read(); await expect(app.result()).toHaveAttribute('data-state', 'saved');
    await app.showQr(null); await page.waitForTimeout(600); await app.read('student-a2');
    await expect(app.result()).toHaveAttribute('data-state', 'saved');
    await expect.poll(async () => (await app.work('student-a2'))[0]?.status).toBe('ส่งสายระดับ 2');
    await page.getByTestId('scan-mode-past').click(); await expect(page.getByTestId('work-status')).toHaveValue('late-2');
    const background = await context.newPage(); await background.goto('about:blank'); await background.bringToFront(); await page.bringToFront();
    await expect(page.getByTestId('camera-state')).toHaveAttribute('data-state', 'ready');
    await expect(page.getByTestId('work-status')).toHaveValue('late-2');
    await page.getByTestId('nav-home').click(); await page.getByTestId('scan-work').click();
    await expect(page.getByTestId('work-status')).toHaveValue('on-time');
  });

  test('E20 summary axes, full names, sticky headers, and large mobile table', async ({ app, page, harness }) => {
    const data = baseline();
    data.students = Array.from({ length: 50 }, (_, i) => ({ id: `large-${i}`, classId: 'class-a', number: i + 1, name: `นักเรียนชื่อภาษาไทยยาว ทดสอบคนที่ ${i + 1}`, active: true }));
    data.tasks = Array.from({ length: 30 }, (_, i) => ({ id: `large-task-${i}`, classId: 'class-a', order: i + 1, name: `ชิ้นงานที่ ${i + 1}`, createdAt: NOW }));
    data.work = []; await harness.seed(data);
    await page.setViewportSize({ width: 390, height: 844 }); await app.login(); await app.classTab('summary');
    const table = page.getByTestId('summary-table');
    await expect(table.getByTestId('student-header')).toHaveCount(50); await expect(table.getByTestId('task-header')).toHaveCount(30);
    await expect(table.getByTestId('task-header').first()).toHaveText('ชิ้นงานที่ 1');
    await expect(table.getByTestId('task-header').last()).toHaveText('ชิ้นงานที่ 30');
    await expect(app.cell('large-0', 'large-task-0')).toHaveText('');
    await expect(app.cell('large-0', 'large-task-0')).toHaveCSS('background-color', 'rgb(226, 232, 235)');
    await expect(table.locator('tbody tr')).toHaveCount(50);
    await expect(table.locator('thead').getByTestId('task-header')).toHaveCount(30);
    await expect(table.getByTestId('student-header').first()).toHaveText(data.students[0].name);
    await expect(table.getByTestId('student-header').last()).toHaveText(data.students[49].name);
    await expect(table.getByTestId('student-header').first()).not.toContainText('เลขที่');
    await expect(page.getByTestId('missing-count-large-0')).toHaveText('30');
    await expect(table.locator('.task-name').first()).toHaveCSS('writing-mode', 'vertical-rl');
    await expect(table.locator('.task-name').first()).toHaveCSS('transform', 'matrix(-1, 0, 0, -1, 0, 0)');
    await app.cell('large-0', 'large-task-0').click(); await expect(page.getByTestId('work-panel')).toContainText(data.students[0].name);
    await page.getByTestId('close-work-panel').click();
    const scroll = page.getByTestId('summary-scroll');
    await scroll.evaluate(el => { el.scrollTop = 500; el.scrollLeft = 500; });
    expect(await scroll.evaluate(el => ({ x: el.scrollLeft > 0, y: el.scrollTop > 0 }))).toEqual({ x: true, y: true });
    const bounds = await scroll.boundingBox(); expect(bounds).not.toBeNull();
    const studentHeader = await table.getByTestId('student-header').nth(15).boundingBox();
    const taskHeader = await table.getByTestId('task-header').nth(10).boundingBox();
    expect(taskHeader!.y).toBeGreaterThanOrEqual(bounds!.y - 1);
    expect(taskHeader!.y).toBeLessThan(bounds!.y + 10);
    expect(studentHeader!.x).toBeGreaterThanOrEqual(bounds!.x - 1);
    expect(studentHeader!.x).toBeLessThan(bounds!.x + 10);
    const count = await page.getByTestId('missing-count-large-15').boundingBox();
    expect(count!.x).toBeCloseTo(studentHeader!.x + studentHeader!.width, 0);
  });

  for (const event of ['open', 'return-page', 'foreground', 'save', 'refresh'] as const) {
    test(`E20 fresh summary on ${event}`, async ({ app, page, context, harness }) => {
      await app.login(); await app.classTab('summary');
      if (event === 'save') {
        await app.editWork('ส่งสายระดับ 1');
        await expect(app.cell()).toHaveClass(/late-1/);
        await expect(app.cell()).toHaveAccessibleName(/ส่งสายระดับ 1/);
        await expect(app.cell()).toHaveText('');
        await expect(app.cell()).toHaveCSS('background-color', 'rgb(255, 251, 227)');
        await expect(page.getByTestId('missing-count-student-a')).toHaveText('1');
        return;
      }
      const other = await context.newPage(); const b = new App(other, harness, app.seed);
      await b.classTab('summary'); await b.editWork('ส่งสายระดับ 1');
      await expect(other.getByTestId('save-result')).toHaveAttribute('data-state', 'saved');
      if (event === 'open') await page.reload();
      if (event === 'return-page') { await page.getByTestId('nav-home').click(); await app.classTab('summary'); }
      if (event === 'foreground') {
        await other.bringToFront(); await page.bringToFront();
        // Headless Chrome keeps both documents visible/focused and emits no focus
        // event for bringToFront. Exercise the browser event the app subscribes to.
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      }
      if (event === 'refresh') await page.getByTestId('refresh-summary').click();
      await expect(app.cell()).toHaveClass(/late-1/);
      await expect(app.cell()).toHaveAccessibleName(/ส่งสายระดับ 1/);
      await expect(app.cell()).toHaveText('');
      await expect(app.cell()).toHaveCSS('background-color', 'rgb(255, 251, 227)');
      await expect(page.getByTestId('missing-count-student-a')).toHaveText('1');
    });
  }

  test('E20 empty classes expose useful actions instead of empty grid', async ({ app, page, harness }) => {
    const data = baseline(); data.students = []; data.tasks = []; data.work = []; await harness.seed(data);
    await app.login(); await app.classTab('summary');
    await expect(page.getByTestId('empty-students')).toBeVisible(); await expect(page.getByTestId('empty-tasks')).toBeVisible();
    await expect(page.getByTestId('summary-table')).toHaveCount(0);
    await expect(page.getByTestId('empty-add-student')).toBeVisible(); await expect(page.getByTestId('empty-add-task')).toBeVisible();
  });

  test('E21 A4 PDF pagination, embedded Thai font, and decodable individual QR', async ({ app, page, harness }) => {
    const data = baseline();
    data.students = Array.from({ length: 22 }, (_, i) => ({ id: `pdf-${i}`, classId: 'class-a', number: i + 1, name: `นักเรียน ทดสอบ${i + 1}`, active: i !== 21 }));
    data.work = []; await harness.seed(data); await app.login(); await app.classTab('students');
    const pdfPromise = page.waitForEvent('download'); await page.getByTestId('download-class-qr').click();
    const pdf = await PDFDocument.load(await downloadBytes(await pdfPromise)); expect(pdf.getPageCount()).toBe(2);
    for (const pdfPage of pdf.getPages()) {
      expect(pdfPage.getWidth()).toBeCloseTo(595.28, 0); expect(pdfPage.getHeight()).toBeCloseTo(841.89, 0);
    }
    const embedded = pdf.context.enumerateIndirectObjects().some(([, object]) => object instanceof PDFDict &&
      (object.has(PDFName.of('FontFile2')) || object.has(PDFName.of('FontFile3'))));
    expect(embedded).toBe(true);
    const qrPromise = page.waitForEvent('download'); await page.getByTestId('download-student-qr-pdf-0').click();
    const png = PNG.sync.read(await downloadBytes(await qrPromise));
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    expect(decoded?.data).toBe(await harness.qr('pdf-0'));
  });

  test('E22 pending save and delayed old response stay isolated after switching account', async ({ app, page, harness }) => {
    await app.login(); await app.scan(); await harness.fault('hold-response'); await app.read();
    await expect(page.getByTestId('pending-save')).toBeVisible();
    await page.getByTestId('account-menu').click(); await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click();
    // Keep this document alive so the held fetch can reach the unmounted old session.
    // A full navigation would abort the request and only test reload isolation.
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.evaluate(() => history.replaceState(null, '', '/sign-in?e2eTeacher=teacher-b'));
    await page.getByRole('button', { name: 'เข้าสู่ระบบด้วย Google', exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
    const oldReply = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/saveWork'));
    await harness.fault('release'); await oldReply;
    await expect(page.getByTestId('pending-save')).toHaveCount(0); await expect(page.getByTestId('scan-result')).toHaveCount(0);
    await page.goto('/classes'); await page.getByTestId('school-year').selectOption('2569'); await page.getByTestId('term').selectOption('1');
    await expect(page.getByTestId('class-card-class-b')).toBeVisible(); await expect(page.getByTestId('class-card-class-a')).toHaveCount(0);
    const state = await harness.snapshot();
    expect(state.requests.filter(r => r.action === 'saveWork').every(r => r.ownerId === 'teacher-a')).toBe(true);
    expect(state.work.filter(w => w.classId === 'class-b')).toHaveLength(0);
  });

  test('E23 class filters, expiry notice and Thai May 1 boundary', async ({ app, page, harness }) => {
    const data = baseline(); data.now = '2026-04-01T17:00:00.000Z'; // April 2, 2569 in Thailand.
    data.classes[0].year = 2566;
    await harness.seed(data); const oldQr = await harness.qr('student-a');
    await app.login(); await page.goto('/classes'); await page.getByTestId('school-year').selectOption('2566'); await page.getByTestId('term').selectOption('1');
    await expect(page.getByTestId('class-card-class-a')).toBeVisible(); await expect(page.getByTestId('class-card-class-other')).toHaveCount(0);
    await page.getByTestId('class-card-class-a').click();
    for (const tab of ['tasks', 'students', 'summary']) {
      await page.getByTestId(`tab-${tab}`).click(); await expect(page.getByTestId('class-context')).toContainText('2566');
      await expect(page.getByTestId('class-context')).toContainText('ภาคเรียน 1');
    }
    await expect(page.getByTestId('expiry-notice')).toContainText('2566');
    await harness.clock('2026-04-30T16:59:59.000Z'); await page.reload(); await expect(page.getByTestId('class-context')).toContainText('2566');
    await harness.clock('2026-04-30T17:00:00.000Z'); await page.reload(); await expect(page.getByTestId('page-error')).toContainText('หมดอายุ');
    await app.scan(); await app.showQr(oldQr); await expect(app.result()).toContainText('หมดอายุ');
    expect((await harness.snapshot()).work.filter(w => w.taskId === 'task-3')).toHaveLength(0);
  });
});
