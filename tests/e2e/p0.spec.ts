import { test, expect, App } from './support/fixtures';
import { baseline, NOW, OLD_DATE, statuses } from './support/data';

test.describe('P0 critical flows', { tag: '@P0' }, () => {
  test('E01 sign-in, route guard, sign-out', async ({ app, page }) => {
    await page.goto('/classes/class-a');
    await expect(page).toHaveURL(/\/sign-in/);
    await app.login();
    await expect(page.getByTestId('onboarding')).toHaveCount(0);
    await app.classTab('students');
    await expect(page.getByText('สมชาย ทดสอบ', { exact: true })).toBeVisible();
    await page.getByTestId('account-menu').click();
    await page.getByRole('button', { name: 'ออกจากระบบ', exact: true }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByText('สมชาย ทดสอบ', { exact: true })).toHaveCount(0);
    await page.goBack();
    await expect(page.getByTestId('student-row-student-a')).toHaveCount(0);
  });

  test('E02 another teacher cannot open or scan private data', async ({ app, page, harness }) => {
    await app.login('teacher-b');
    await page.goto('/classes/class-a');
    await expect(page.getByTestId('page-error')).toContainText('ไม่สามารถ');
    await expect(page.getByText('สมชาย ทดสอบ', { exact: true })).toHaveCount(0);
    await app.scan(); await app.read();
    await expect(app.result()).toContainText('บัญชี');
    await expect(app.result()).not.toContainText('สมชาย');
    expect(await app.work()).toHaveLength(0);
    expect((await harness.snapshot()).work).toHaveLength(1);
  });

  test('E03 create class, student, task, and QR', async ({ app, page }) => {
    await app.login(); await page.goto('/classes');
    await page.getByTestId('school-year').selectOption('2569');
    await page.getByTestId('term').selectOption('2');
    await page.getByTestId('add-class').click();
    await page.getByTestId('subject-name').fill('ประวัติศาสตร์');
    await page.getByTestId('group-name').fill('ม.3/1');
    await page.getByTestId('save-class').click();
    await expect(page.getByTestId('class-context')).toContainText('2569');
    await expect(page.getByTestId('class-context')).toContainText('ภาคเรียน 2');
    await page.getByTestId('tab-students').click();
    await page.getByTestId('add-student').click();
    await page.getByTestId('student-number').fill('1');
    await page.getByTestId('student-name').fill('นักเรียน ใหม่');
    await page.getByTestId('save-student').click();
    await expect(page.getByText('นักเรียน ใหม่', { exact: true })).toBeVisible();
    await page.getByTestId('tab-tasks').click();
    await page.getByTestId('add-task').click();
    await expect(page.getByTestId('task-name')).toHaveValue('ชิ้นงานที่ 1');
    await page.getByTestId('save-task').click();
    await page.getByTestId('tab-students').click();
    const download = page.waitForEvent('download');
    await page.getByTestId('download-class-qr').click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test('E04 scan uses QR class latest task despite missing older work', async ({ app, page }) => {
    await app.login(); await app.classTab('tasks', 'class-other');
    await page.getByTestId('scan-work').click();
    await expect(page.getByTestId('camera-state')).toHaveAttribute('data-state', 'ready');
    await app.read('student-a2');
    await expect(app.result()).toHaveAttribute('data-state', 'saved');
    expect(await app.work('student-a2', 'task-3')).toHaveLength(1);
    expect(await app.work('student-a2', 'task-1')).toHaveLength(0);
    expect(await app.work('student-a2', 'task-2')).toHaveLength(0);
  });

  for (const status of statuses) {
    test(`E05 records chosen status and Thai date: ${status}`, async ({ app, page }) => {
      await app.login(); await app.scan(); await app.status(status); await app.read();
      await expect(app.result()).toHaveAttribute('data-state', 'saved');
      await expect(app.result()).toHaveText(status);
      for (const hidden of ['สมชาย', 'ม.1/1', 'ชิ้นงาน', 'คณิตศาสตร์']) {
        await expect(app.result()).not.toContainText(hidden);
      }
      expect(await app.work()).toEqual([expect.objectContaining({ status, savedAt: NOW })]);
      await expect.poll(async () => (await app.sounds()).filter(s => s.endsWith('/scan-success.wav')).length).toBe(1);
      await app.classTab('summary');
      await expect(app.cell()).toHaveText('');
      await expect(app.cell()).toHaveAccessibleName(new RegExp(status));
      await app.cell().click();
      await expect(page.getByTestId('work-panel')).toContainText('10/10/69');
    });
  }

  test('E06 duplicate scan preserves original status and date', async ({ app, harness }) => {
    const data = baseline();
    data.work.push({ studentId: 'student-a', taskId: 'task-3', status: 'ส่งตรงเวลา', savedAt: OLD_DATE });
    await harness.seed(data);
    await app.login(); await app.scan(); await app.status('ส่งสายระดับ 4'); await app.read();
    await expect(app.result()).toContainText('ส่งแล้ว');
    await expect(app.result()).toContainText('8/10/69');
    await expect(app.result()).toContainText('ส่งตรงเวลา');
    expect(await app.work()).toEqual([expect.objectContaining({ status: 'ส่งตรงเวลา', savedAt: OLD_DATE })]);
    await expect.poll(async () => (await app.sounds()).filter(s => s.endsWith('/scan-error.wav')).length).toBe(1);
  });

  test('E07 held QR is read once until it leaves the camera', async ({ app, page, harness }) => {
    await app.login(); await app.scan(); await app.read();
    await expect(app.result()).toHaveAttribute('data-state', 'saved');
    // A real quiet interval is intentional: repeated video frames must not trigger reads.
    await page.waitForTimeout(1500);
    expect(await app.sounds()).toHaveLength(1);
    await expect(app.result()).toHaveAttribute('data-state', 'saved');
    await app.showQr(null); await page.waitForTimeout(600); await app.read();
    await expect(app.result()).toContainText('ส่งแล้ว');
    expect(await app.work()).toHaveLength(1);
    expect((await harness.snapshot()).audit.filter(a => a.action === 'saveWork' && a.taskId === 'task-3')).toHaveLength(1);
  });

  test('E08 past work needs selection and confirmation per student', async ({ app, page }) => {
    await app.login(); await app.scan('past'); await app.status('ส่งสายระดับ 2'); await app.read();
    const panel = page.getByTestId('past-work-panel');
    await expect(panel).toContainText('สมชาย ทดสอบ');
    expect(await panel.getByTestId('past-task').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-task-id')))).toEqual(['task-3', 'task-2', 'task-1']);
    await expect(page.getByTestId('choose-task-task-1')).toBeDisabled();
    await expect(page.getByTestId('confirm-past-work')).toBeDisabled();
    expect(await app.work('student-a', 'task-2')).toHaveLength(0);
    await page.getByTestId('choose-task-task-2').click();
    await expect(panel).toContainText('ส่งสายระดับ 2');
    expect(await app.work('student-a', 'task-2')).toHaveLength(0);
    await page.getByTestId('confirm-past-work').click();
    await expect(panel).toBeHidden();
    expect(await app.work('student-a', 'task-2')).toEqual([expect.objectContaining({ status: 'ส่งสายระดับ 2', savedAt: NOW })]);
    await app.showQr(null); await page.waitForTimeout(600); await app.read('student-a2');
    await expect(panel).toContainText('สมหญิง ทดสอบ');
    await expect(page.getByTestId('confirm-past-work')).toBeDisabled();
    await expect(page.getByTestId('work-status')).toHaveValue('late-2');
  });

  test('E08 another device submits selected past work before confirmation', async ({ app, page, context, harness }) => {
    await app.login(); await app.scan('past'); await app.read();
    await page.getByTestId('choose-task-task-2').click();
    const other = await context.newPage(); const b = new App(other, harness, app.seed);
    await b.classTab('summary'); await b.editWork('ส่งตรงเวลา', 'student-a', 'task-2');
    await expect(other.getByTestId('save-result')).toHaveAttribute('data-state', 'saved');
    await page.getByTestId('confirm-past-work').click();
    await expect(page.getByTestId('past-work-error')).toContainText('ส่งแล้ว');
    expect(await app.work('student-a', 'task-2')).toEqual([expect.objectContaining({ status: 'ส่งตรงเวลา' })]);
  });

  for (const fault of ['before-commit', 'after-commit'] as const) {
    test(`E09 lost save reply: ${fault}`, async ({ app, page, harness }) => {
      await app.login(); await app.scan(); await harness.fault(fault); await app.read();
      await expect(page.getByTestId('pending-save')).toContainText('ตรวจสอบ');
      await expect(app.result()).not.toHaveAttribute('data-state', 'saved');
      expect(await app.sounds()).toHaveLength(0);
      await app.showQr(null); await page.waitForTimeout(600); await app.read('student-a2');
      expect(await app.work('student-a2')).toHaveLength(0);
      await harness.fault('release');
      await page.getByTestId('check-save-result').click();
      await expect(app.result()).toHaveAttribute('data-state', 'saved');
      expect(await app.work()).toHaveLength(1);
      expect((await harness.snapshot()).requests.filter(r => r.action === 'saveWork' && r.confirmed)).toHaveLength(1);
      expect(await app.sounds()).toHaveLength(1);
    });
  }

  test('E10 reload recovers original confirmed request after a new task', async ({ app, page, context, harness }) => {
    await app.login(); await app.scan(); await harness.fault('after-commit'); await app.read();
    await expect(page.getByTestId('pending-save')).toBeVisible();
    const original = (await harness.snapshot()).requests.find(r => r.action === 'saveWork')!;
    expect(original).toBeDefined();
    const other = await context.newPage(); const b = new App(other, harness, app.seed);
    await b.classTab('tasks'); await other.getByTestId('add-task').click(); await other.getByTestId('save-task').click();
    await expect(other.getByTestId('save-result')).toHaveAttribute('data-state', 'saved');
    await harness.fault('release'); await page.reload();
    await expect(app.result()).toHaveAttribute('data-state', 'saved');
    expect(await app.work()).toHaveLength(1);
    const state = await harness.snapshot(); const latest = state.tasks.find(t => t.order === 4)!;
    expect(latest).toBeDefined(); expect(await app.work('student-a', latest.id)).toHaveLength(0);
    expect(state.requests.filter(r => r.action === 'saveWork').map(r => r.id)).toEqual([original.id]);
  });

  test('E11 rename keeps QR, renumber replaces QR and preserves history', async ({ app, page, harness }) => {
    await app.login(); await app.classTab('students');
    await page.getByTestId('edit-student-student-a').click();
    await page.getByTestId('student-name').fill('ชื่อใหม่ ทดสอบ');
    await page.getByTestId('save-student').click();
    await expect(page.getByTestId('student-row-student-a')).toContainText('ชื่อใหม่ ทดสอบ');
    expect(await harness.qr('student-a')).toBe(app.seed.qr['student-a']);
    await page.getByTestId('edit-student-student-a').click();
    await page.getByTestId('student-number').fill('10'); await page.getByTestId('save-student').click();
    await expect(page.getByTestId('confirm-number-change')).toContainText('QR เดิม');
    await page.getByTestId('confirm-number-change').getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    await expect(page.getByTestId('download-new-qr')).toBeVisible();
    expect(await app.work('student-a', 'task-1')).toHaveLength(1);
    const newQr = await harness.qr('student-a'); expect(newQr).not.toBe(app.seed.qr['student-a']);
    await app.scan(); await app.read(); await expect(app.result()).toContainText('QR นี้ใช้ไม่ได้แล้ว');
    await app.showQr(null); await page.waitForTimeout(600); await app.showQr(newQr);
    await expect(app.result()).toHaveAttribute('data-state', 'saved');
    expect(await app.work()).toHaveLength(1);
  });

  test('E12 disable and restore only current QR', async ({ app, page }) => {
    await app.login(); await app.classTab('students');
    await page.getByTestId('toggle-student-student-a').click();
    await page.getByTestId('confirm-student-toggle').getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    await expect(page.getByTestId('student-row-student-a')).toHaveCount(0);
    await app.classTab('summary'); await expect(app.cell('student-a', 'task-1')).toHaveCount(0);
    await page.getByTestId('show-inactive').check(); await expect(app.cell('student-a', 'task-1')).toHaveClass(/on-time/);
    await app.scan(); await app.read(); await expect(app.result()).toContainText('ปิดใช้งาน');
    await app.classTab('students'); await page.getByTestId('show-inactive').check();
    await page.getByTestId('toggle-student-student-a').click();
    await page.getByTestId('confirm-student-toggle').getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    await app.scan(); await app.showQr(app.seed.replacedQr); await expect(app.result()).toContainText('QR นี้ใช้ไม่ได้แล้ว');
    await app.showQr(null); await page.waitForTimeout(600); await app.read();
    await expect(app.result()).toHaveAttribute('data-state', 'saved');
  });

  test('E13 status transitions keep, clear, and assign server date', async ({ app, page, harness }) => {
    await app.login(); await app.classTab('summary');
    await app.editWork('ส่งสายระดับ 4', 'student-a', 'task-1');
    await expect(page.getByTestId('save-result')).toHaveAttribute('data-state', 'saved');
    expect(await app.work('student-a', 'task-1')).toEqual([expect.objectContaining({ savedAt: OLD_DATE, status: 'ส่งสายระดับ 4' })]);
    await app.editWork('ยังไม่ส่ง', 'student-a', 'task-1');
    await expect(page.getByTestId('confirm-clear-work')).toBeVisible();
    expect(await app.work('student-a', 'task-1')).toHaveLength(1);
    await page.getByTestId('confirm-clear-work').getByRole('button', { name: 'ยกเลิก', exact: true }).click();
    expect(await app.work('student-a', 'task-1')).toHaveLength(1);
    await page.getByTestId('save-work-status').click();
    await page.getByTestId('confirm-clear-work').getByRole('button', { name: 'ยืนยัน', exact: true }).click();
    await expect(app.cell('student-a', 'task-1')).toHaveText('');
    await expect(app.cell('student-a', 'task-1')).toHaveClass(/not-sent/);
    await expect(page.getByTestId('missing-count-student-a')).toHaveText('3');
    expect(await app.work('student-a', 'task-1')).toHaveLength(0);
    await app.editWork('ส่งสายระดับ 1', 'student-a', 'task-1');
    await expect(page.getByTestId('save-result')).toHaveAttribute('data-state', 'saved');
    expect(await app.work('student-a', 'task-1')).toEqual([expect.objectContaining({ savedAt: NOW })]);
    expect((await harness.snapshot()).audit.some(a => a.action === 'clearWork')).toBe(true);
  });

  test('E14 editable Excel review and repeat import preserve records', async ({ app, page, harness }) => {
    await app.login(); await app.classTab('students');
    const before = await harness.snapshot();
    await app.excel([[1, 'ชื่อแก้ไข ทดสอบ'], [4, 'นักเรียนใหม่ ทดสอบ'], [4, 'ซ้ำ ทดสอบ'], ['', '']]);
    await expect(page.getByTestId('save-import')).toBeDisabled();
    expect((await harness.snapshot()).students).toEqual(before.students);
    await page.getByTestId('import-remove-3').click();
    await page.getByTestId('import-number-2').fill('5');
    await expect(page.getByTestId('import-count-new')).toHaveText('2');
    await page.getByTestId('import-remove-2').click();
    await expect(page.getByTestId('import-count-new')).toHaveText('1');
    await expect(page.getByTestId('import-count-changed')).toHaveText('1');
    await page.getByTestId('save-import').click();
    await expect(page.getByTestId('import-result')).toHaveAttribute('data-state', 'saved');
    const state = await harness.snapshot();
    expect(state.students.find(s => s.id === 'student-a')?.name).toBe('ชื่อแก้ไข ทดสอบ');
    expect(state.students.find(s => s.id === 'student-a2')).toEqual(before.students.find(s => s.id === 'student-a2'));
    expect(state.students.find(s => s.id === 'student-off')?.active).toBe(false);
    expect(state.work).toEqual(before.work);
    await app.excel([[1, 'ชื่อแก้ไข ทดสอบ'], [4, 'นักเรียนใหม่ ทดสอบ']]);
    await expect(page.getByTestId('import-count-unchanged')).toHaveText('2');
    await page.getByTestId('save-import').click();
    await expect(page.getByTestId('import-result')).toHaveAttribute('data-state', 'saved');
    expect((await harness.snapshot()).students).toHaveLength(state.students.length);
  });

  for (const kind of ['student', 'task', 'work', 'import'] as const) {
    test(`E15 stale ${kind} edit cannot overwrite other device`, async ({ app, page, context, harness }) => {
      await app.login();
      const other = await context.newPage(); const b = new App(other, harness, app.seed);
      if (kind === 'student') {
        for (const a of [app, b]) { await a.classTab('students'); await a.page.getByTestId('edit-student-student-a').click(); }
        await other.getByTestId('student-name').fill('ข้อมูลล่าสุด ทดสอบ'); await other.getByTestId('save-student').click();
        await expect(other.getByTestId('save-result')).toHaveAttribute('data-state', 'saved');
        await page.getByTestId('student-name').fill('ข้อมูลเก่า ทดสอบ'); await page.getByTestId('save-student').click();
      } else if (kind === 'task') {
        for (const a of [app, b]) { await a.classTab('tasks'); await a.page.getByTestId('edit-task-task-1').click(); }
        await other.getByTestId('task-name').fill('งานล่าสุด'); await other.getByTestId('save-task').click();
        await expect(other.getByTestId('save-result')).toHaveAttribute('data-state', 'saved');
        await page.getByTestId('task-name').fill('งานเก่า'); await page.getByTestId('save-task').click();
      } else if (kind === 'work') {
        for (const a of [app, b]) { await a.classTab('summary'); await a.cell('student-a', 'task-1').click(); }
        await b.status('ส่งสายระดับ 1'); await other.getByTestId('save-work-status').click();
        await expect(other.getByTestId('save-result')).toHaveAttribute('data-state', 'saved');
        await app.status('ส่งสายระดับ 4'); await page.getByTestId('save-work-status').click();
      } else {
        await app.classTab('students'); await app.excel([[1, 'ข้อมูลเก่า ทดสอบ']]);
        await b.classTab('students'); await other.getByTestId('edit-student-student-a').click();
        await other.getByTestId('student-name').fill('ข้อมูลล่าสุด ทดสอบ'); await other.getByTestId('save-student').click();
        await expect(other.getByTestId('save-result')).toHaveAttribute('data-state', 'saved');
        await page.getByTestId('save-import').click();
      }
      const latest = await harness.snapshot();
      await expect(page.getByTestId('version-conflict')).toBeVisible();
      await expect(page.getByTestId('version-conflict')).toContainText('ตรวจสอบ');
      expect(await harness.snapshot()).toEqual(latest);
      if (kind === 'student' || kind === 'import') expect(latest.students.find(s => s.id === 'student-a')?.name).toBe('ข้อมูลล่าสุด ทดสอบ');
      if (kind === 'task') expect(latest.tasks.find(t => t.id === 'task-1')?.name).toBe('งานล่าสุด');
      if (kind === 'work') expect((await app.work('student-a', 'task-1'))[0].status).toBe('ส่งสายระดับ 1');
    });
  }
});
