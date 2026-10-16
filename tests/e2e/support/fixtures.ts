import {
  test as base,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import QRCode from "qrcode";
import ExcelJS from "exceljs";
import {
  baseline,
  type Seed,
  type SeedResult,
  type Snapshot,
  type Status,
} from "./data";

const harnessURL = process.env.E2E_HARNESS_URL ?? "http://127.0.0.1:4400";

export class Harness {
  constructor(private request: APIRequestContext) {}
  private async call<T>(path: string, data: unknown): Promise<T> {
    let response;
    try {
      response = await this.request.post(`${harnessURL}/__e2e/${path}`, {
        data,
      });
    } catch (error) {
      throw new Error(
        `Missing E2E Emulator harness at ${harnessURL}. See tests/e2e/README.md. ${error}`,
      );
    }
    if (!response.ok())
      throw new Error(
        `E2E harness ${path}: ${response.status()} ${await response.text()}`,
      );
    return (await response.json()) as T;
  }
  seed(data: Seed = baseline()) {
    return this.call<SeedResult>("seed", data);
  }
  snapshot() {
    return this.call<Snapshot>("snapshot", {});
  }
  clock(now: string) {
    return this.call("clock", { now });
  }
  // Faults are applied to real callable execution, not mocked success responses.
  fault(
    mode: "before-commit" | "after-commit" | "hold-response" | "release",
    action = "saveWork",
  ) {
    return this.call("fault", { mode, action });
  }
  async qr(studentId: string) {
    return (await this.call<{ payload: string }>("qr", { studentId })).payload;
  }
}

// Feed QR pixels through getUserMedia; the app's actual QR decoder still runs.
export async function installCamera(page: Page, denied = false) {
  if (denied) {
    await page.addInitScript(() => {
      Object.assign(window, { __denyCamera: true });
    });
    return;
  }
  await page.addInitScript(
    ({ denied }) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 800;
      const context = canvas.getContext("2d")!;
      let qr: HTMLImageElement | undefined;
      const paint = () => {
        context.fillStyle = "white";
        context.fillRect(0, 0, 800, 800);
        if (qr)
          context.drawImage(qr, (800 - qr.width) / 2, (800 - qr.height) / 2);
      };
      setInterval(paint, 50);
      Object.assign(window, {
        __camera: {
          async show(src: string | null) {
            if (!src) {
              qr = undefined;
              paint();
              return;
            }
            const image = new Image();
            image.src = src;
            await image.decode();
            qr = image;
            paint();
          },
        },
        __sounds: [] as string[],
      });
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        value: async () => {
          if (
            denied ||
            (window as unknown as { __denyCamera?: boolean }).__denyCamera
          )
            throw new DOMException("Camera denied", "NotAllowedError");
          return canvas.captureStream(20);
        },
      });
      const nativePlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (this instanceof HTMLAudioElement) {
          if (!this.muted)
            (window as unknown as { __sounds: string[] }).__sounds.push(
              this.currentSrc || this.src,
            );
          return Promise.resolve();
        }
        return nativePlay.call(this);
      };
    },
    { denied },
  );
}

export async function signIn(page: Page, teacher = "teacher-a") {
  await page.goto(`/sign-in?e2eTeacher=${teacher}`);
  await page
    .getByRole("button", { name: "เข้าสู่ระบบด้วย Google", exact: true })
    .click();
  await expect(page).toHaveURL(/\/home$/);
}

export class App {
  constructor(
    readonly page: Page,
    readonly harness: Harness,
    readonly seed: SeedResult,
  ) {}
  async login(teacher = "teacher-a") {
    await signIn(this.page, teacher);
  }
  async classTab(tab: "summary" | "students" | "tasks", id = "class-a") {
    await this.page.goto(`/classes/${id}`);
    await this.page.getByTestId(`tab-${tab}`).click();
  }
  async scan(mode: "normal" | "past" = "normal") {
    await this.page.goto("/scan");
    await this.page.getByTestId(`scan-mode-${mode}`).click();
    await expect(this.page.getByTestId("camera-state")).toHaveAttribute(
      "data-state",
      "ready",
    );
  }
  async status(status: Status) {
    await this.page.getByTestId("work-status").selectOption({ label: status });
  }
  async showQr(payload: string | null) {
    // Keep modules on whole pixels; resizing certain patterns from 500px creates
    // artifacts that cannot be decoded even from the original PNG. Use a fixed
    // mask because ZXing misdetects the auto-selected pattern of the expiry QR.
    const src =
      payload === null
        ? null
        : await QRCode.toDataURL(payload, {
            scale: 8,
            margin: 4,
            maskPattern: 0,
          });
    await this.page.evaluate(async (src) => {
      await (
        window as unknown as {
          __camera: { show(src: string | null): Promise<void> };
        }
      ).__camera.show(src);
    }, src);
  }
  async read(student = "student-a") {
    await this.showQr(this.seed.qr[student]);
  }
  result() {
    return this.page.getByTestId("scan-result");
  }
  cell(student = "student-a", task = "task-3") {
    return this.page.getByTestId(`work-cell-${student}-${task}`);
  }
  async sounds() {
    return this.page.evaluate(
      () => (window as unknown as { __sounds: string[] }).__sounds,
    );
  }
  async editWork(status: Status, student = "student-a", task = "task-3") {
    await this.cell(student, task).click();
    await this.status(status);
    await this.page.getByTestId("save-work-status").click();
  }
  async excel(rows: (string | number | { formula: string })[][]) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("นักเรียน");
    sheet.addRow(["เลขที่", "ชื่อ-นามสกุล"]);
    rows.forEach((row) => sheet.addRow(row));
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    await this.page.getByTestId("excel-file").setInputFiles({
      name: "students.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer,
    });
  }
  async work(student = "student-a", task = "task-3") {
    return (await this.harness.snapshot()).work.filter(
      (w) => w.studentId === student && w.taskId === task,
    );
  }
}

export const test = base.extend<{ harness: Harness; app: App }>({
  harness: async ({ request }, use) => {
    await use(new Harness(request));
  },
  app: async ({ page, harness }, use) => {
    const seeded = await harness.seed();
    await installCamera(page);
    await use(new App(page, harness, seeded));
    await harness.fault("release");
  },
});
export { expect };
