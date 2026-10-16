import { test, expect } from './support/fixtures';
import { baseline } from './support/data';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`teacher menu and main navigation at ${viewport.width}px`, async ({ app, page, harness }) => {
    await page.setViewportSize(viewport);
    const data = baseline();
    data.teachers[0].name = 'ครูทดสอบชื่อยาวสำหรับตรวจการแสดงผลบนมือถือและคอมพิวเตอร์';
    data.teachers[0].email = 'teacher.with.a.long.email.address.for.mobile.layout@example.test';
    await harness.seed(data);
    await app.login();
    const nav = page.getByRole('navigation', { name: 'เมนูหลัก' });
    await expect(nav).toBeVisible();
    for (const label of ['หน้าหลัก', 'สแกนงาน', 'ห้องเรียน']) {
      await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'ครู', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ครู', exact: true }).click();
    const teacher = page.getByRole('region', { name: 'ข้อมูลครู' });
    await expect(teacher).toBeVisible();
    await expect(teacher).toContainText(data.teachers[0].name);
    await expect(teacher).toContainText(data.teachers[0].email);
    await expect(page.getByTestId('teacher-plan-summary')).toContainText('Starter');
    const bounds = await teacher.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    await teacher.getByRole('link', { name: 'กรอกโค้ด', exact: true }).focus();
    await page.keyboard.press('Escape');
    await expect(teacher).toHaveCount(0);
    await expect(page.getByTestId('account-menu')).toBeFocused();
    await nav.getByRole('link', { name: 'สแกนงาน', exact: true }).click();
    await expect(page).toHaveURL(/\/scan$/);
    await nav.getByRole('link', { name: 'ห้องเรียน', exact: true }).click();
    await expect(page).toHaveURL(/\/classes$/);
    await nav.getByRole('link', { name: 'หน้าหลัก', exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
  });
}
