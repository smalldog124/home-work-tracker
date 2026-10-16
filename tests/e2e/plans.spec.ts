import { test, expect } from './support/fixtures';
import { baseline, NOW, type Seed } from './support/data';

const validCode = 'e2e-activation-code-with-at-least-32-random-characters';
function paidSeed(planId: 'level1' | 'level2' | 'level3' = 'level1'): Seed {
  return { ...baseline(), plans: [{ teacherUid: 'teacher-a', planId, startedAt: NOW, expiresAt: '2027-11-10T05:00:00.000Z' }] };
}
function codeSeed(): Seed {
  return { ...baseline(), planCodes: [{ code: validCode, teacherUid: 'teacher-a', planId: 'level2', status: 'unused', createdAt: NOW, expiresAt: '2026-11-09T05:00:00.000Z' }] };
}

// UI contracts for model-plan.md. These exercise the real app and callable backend.
test.describe('teacher plans and classroom limits', { tag: '@plans' }, () => {
  test('paid expiry is shown in Thailand time separately from the three-year policy', async ({ app, harness, page }) => {
    const data = paidSeed();
    data.plans![0].expiresAt = '2027-11-10T18:30:00.000Z';
    await harness.seed(data);
    await app.login();
    await page.goto('/classes');
    await expect(page.getByTestId('plan-summary')).toContainText('Level 1');
    await expect(page.getByTestId('plan-summary')).toContainText('2 / 6');
    await expect(page.getByTestId('plan-expires-at')).toContainText(/11\/11\/(2570|70|2027)/);
    await expect(page.getByTestId('data-retention-policy')).toContainText(/3.*ปี/);
  });

  test('Level 3 shows the used count and unlimited', async ({ app, harness, page }) => {
    await harness.seed(paidSeed('level3'));
    await app.login();
    await page.goto('/classes');
    await expect(page.getByTestId('plan-summary')).toContainText('Level 3');
    await expect(page.getByTestId('plan-summary')).toContainText('2');
    await expect(page.getByTestId('plan-summary')).toContainText(/ไม่จำกัด|Unlimited/);
  });

  test('expired paid plan shows Starter with 8 / 2 and keeps existing work readable', async ({ app, harness, page }) => {
    const data = paidSeed('level2');
    data.plans![0].expiresAt = NOW;
    for (let n = 0; n < 6; n++) data.classes.push({ id: `extra-${n}`, ownerId: 'teacher-a', year: 2569, term: 2, subject: 'ภาษาอังกฤษ', group: `ม.3/${n}` });
    await harness.seed(data);
    await app.login();
    await page.goto('/classes');
    await expect(page.getByTestId('plan-summary')).toContainText('Starter');
    await expect(page.getByTestId('plan-summary')).toContainText('8 / 2');
    await expect(page.getByTestId('add-class')).toBeDisabled();
    await app.classTab('summary');
    await expect(app.cell('student-a', 'task-1')).toHaveAccessibleName(/ส่งตรงเวลา/);
  });

  test('preview then confirmation applies the plan once even when the first reply is lost', async ({ app, harness, page }) => {
    await harness.seed(codeSeed());
    await app.login();
    await page.goto('/classes');
    await page.getByRole('button', { name: /กรอกโค้ด/ }).click();
    await page.getByLabel(/โค้ด/).fill(validCode);
    await page.getByRole('button', { name: /ตรวจสอบโค้ด/ }).click();
    await expect(page.getByTestId('plan-code-preview')).toContainText('Level 2');
    await expect(page.getByTestId('plan-code-preview')).toContainText(/10\/11\/(2570|70|2027)/);
    await harness.fault('after-commit', 'redeemPlanCode');
    await page.getByRole('button', { name: /ยืนยัน.*แพ็กเกจ|ยืนยัน.*แผน/ }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await harness.fault('release');
    await page.getByRole('button', { name: /ลองอีกครั้ง|ตรวจสอบผล/ }).click();
    await expect(page.getByText(/สำเร็จ/).first()).toBeVisible();
    await page.goto('/classes');
    await expect(page.getByTestId('plan-summary')).toContainText('Level 2');
    await expect(page.getByTestId('plan-summary')).toContainText('2 / 15');
    await expect(page.getByTestId('plan-expires-at')).toContainText(/10\/11\/(2570|70|2027)/);
  });

  test('upgrade preview explains that the new period starts now and remaining time is discarded', async ({ app, harness, page }) => {
    const data = codeSeed();
    data.plans = paidSeed().plans;
    await harness.seed(data);
    await app.login();
    await page.goto('/classes');
    await page.getByRole('button', { name: /กรอกโค้ด/ }).click();
    await page.getByLabel(/โค้ด/).fill(validCode);
    await page.getByRole('button', { name: /ตรวจสอบโค้ด/ }).click();
    await expect(page.getByTestId('plan-code-preview')).toContainText(/เริ่ม.*ทันที|เริ่ม.*ตอนนี้/);
    await expect(page.getByTestId('plan-code-preview')).toContainText(/ไม่.*(รวม|เพิ่ม|ทบ).*เวลา|เวลา.*ไม่.*(รวม|เพิ่ม|ทบ)/);
  });

  test('confirmation is disabled while a code-use request is running', async ({ app, harness, page }) => {
    await harness.seed(codeSeed());
    await app.login();
    await page.goto('/classes');
    await page.getByRole('button', { name: /กรอกโค้ด/ }).click();
    await page.getByLabel(/โค้ด/).fill(validCode);
    await page.getByRole('button', { name: /ตรวจสอบโค้ด/ }).click();
    await expect(page.getByTestId('plan-code-preview')).toBeVisible();
    await harness.fault('hold-response', 'redeemPlanCode');
    const confirm = page.getByRole('button', { name: /ยืนยัน.*แพ็กเกจ|ยืนยัน.*แผน/ });
    await confirm.click();
    await expect(confirm).toBeDisabled();
    await harness.fault('release');
    await expect(page.getByText(/สำเร็จ/).first()).toBeVisible();
  });
  test('summary counts both terms even when only one term is selected', async ({ app, harness, page }) => {
    const data = baseline();
    data.classes[1].term = 2;
    await harness.seed(data);
    await app.login();
    await page.goto('/classes');
    await expect(page.getByTestId('plan-summary')).toContainText('Starter');
    await expect(page.getByTestId('plan-summary')).toContainText('2 / 2');
    await expect(page.getByTestId('plan-summary')).toContainText('2569');
    await page.getByTestId('term').selectOption('2');
    await expect(page.getByTestId('plan-summary')).toContainText('2 / 2');
  });

  test('contact panel shows agreed contact details, copy actions and a phone link', async ({ app, page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await app.login();
    await page.goto('/classes');
    await page.getByRole('button', { name: /ติดต่อผู้ดูแล/ }).click();
    const panel = page.getByRole('dialog');
    await expect(panel).toContainText('smalldoc124');
    await expect(panel).toContainText('088-3564267');
    await expect(panel).toContainText(/อีเมล.*เข้าสู่ระบบ/);
    await expect(panel.getByRole('link', { name: /088-3564267/ })).toHaveAttribute('href', /^tel:088-?3564267$/);
    await panel.getByRole('button', { name: /คัดลอก.*LINE/i }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('smalldoc124');
    await panel.getByRole('button', { name: /คัดลอก.*เบอร์|คัดลอก.*โทรศัพท์/ }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('088-3564267');
  });

  test('a full plan explains the cap and offers enter-code and contact actions', async ({ app, page }) => {
    await app.login();
    await page.goto('/classes');
    await expect(page.getByTestId('plan-summary')).toContainText('2 / 2');
    await expect(page.getByText(/ครบ.*จำนวน|ถึง.*จำกัด|เต็ม/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /กรอกโค้ด/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /ติดต่อผู้ดูแล/ })).toBeVisible();
    await expect(page.getByTestId('add-class')).toBeDisabled();
  });

  test('a new classroom can use only the current year and shows details before saving', async ({ app, harness, page }) => {
    const data = baseline();
    data.classes = data.classes.filter(klass => klass.id !== 'class-other');
    data.students = data.students.filter(student => student.classId !== 'class-other');
    await harness.seed(data);
    await app.login();
    await page.goto('/classes');
    await page.getByTestId('add-class').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('2569');
    await expect(dialog).toContainText('1 / 2');
    await expect(dialog.getByRole('option', { name: /2567|2568|2570/ })).toHaveCount(0);
    await page.getByTestId('subject-name').fill('ประวัติศาสตร์');
    await page.getByTestId('group-name').fill('ม.3/1');
    await expect(dialog).toContainText(/ภาคเรียน/);
    await page.getByTestId('save-class').click();
    await expect(page.getByTestId('class-context')).toContainText('ประวัติศาสตร์');
    await page.goto('/classes');
    await expect(page.getByTestId('plan-summary')).toContainText('2 / 2');
  });

  test('an invalid code explains the error without changing the summary', async ({ app, page }) => {
    await app.login();
    await page.goto('/classes');
    await page.getByRole('button', { name: /กรอกโค้ด/ }).click();
    await page.getByLabel(/โค้ด/).fill('unknown-activation-code-with-at-least-32-characters');
    await page.getByRole('button', { name: /ตรวจสอบโค้ด/ }).click();
    await expect(page.getByRole('alert')).toContainText(/โค้ด.*ไม่ถูกต้อง|ไม่พบโค้ด/);
    await page.goto('/classes');
    await expect(page.getByTestId('plan-summary')).toContainText('Starter');
    await expect(page.getByTestId('plan-summary')).toContainText('2 / 2');
  });

  test('deletion requires the displayed name and refreshes usage after acceptance', async ({ app, page }) => {
    await app.login();
    await page.goto('/classes/class-a');
    await page.getByRole('button', { name: 'ลบห้องเรียน', exact: true }).click();
    const dialog = page.getByRole('dialog');
    for (const text of ['คณิตศาสตร์', 'ม.1/1', 'นักเรียน', 'ชิ้นงาน', 'คะแนน']) await expect(dialog).toContainText(text);
    await expect(dialog).toContainText(/กู้คืนไม่ได้|ไม่สามารถกู้คืน/);
    const confirm = dialog.getByRole('button', { name: /ยืนยัน.*ลบ/ });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/ชื่อห้องเรียน/).fill('ชื่อผิด');
    await expect(confirm).toBeDisabled();
    const name = await dialog.getByTestId('deletion-class-name').innerText();
    await dialog.getByLabel(/ชื่อห้องเรียน/).fill(name);
    await confirm.click();
    await expect(page).toHaveURL(/\/classes$/);
    await expect(page.getByTestId('plan-summary')).toContainText('1 / 2');
    await expect(page.getByText('คณิตศาสตร์', { exact: true })).toHaveCount(0);
    await page.goto('/classes/class-a');
    await expect(page.getByTestId('page-error')).toBeVisible();
  });
});
