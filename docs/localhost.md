# คู่มือรันเว็บบน localhost

คู่มือนี้ใช้ Firebase Emulators กับโปรเจกต์จำลอง `demo-home-work` บนเครื่องของคุณ เปิดเว็บและทดลองบันทึกข้อมูลได้โดยไม่ต้องสร้าง Firebase project จริง ตั้งค่า App Check หรือเข้าสู่ระบบ Firebase CLI

## 1. เตรียมเครื่อง

ต้องมี Node.js 22 เวอร์ชัน 22.12 ขึ้นไป, npm และ Java 21 สำหรับ Firestore Emulator ตรวจสอบใน Terminal:

```bash
node --version
npm --version
java --version
```

หากใช้ nvm ให้เลือก Node 22 ก่อนรันคำสั่ง:

```bash
nvm use 22
```

เครื่องที่มี Java อยู่ใน `.tools/java21/Contents/Home/bin/java` แล้ว สคริปต์ของโปรเจกต์จะเลือกใช้ให้อัตโนมัติ แม้คำสั่ง `java --version` จาก PATH จะแสดงเวอร์ชันอื่น โฟลเดอร์ `.tools/` ไม่ได้อยู่ใน git เครื่องใหม่จึงต้องติดตั้ง Java 21 เอง

เข้าโฟลเดอร์โปรเจกต์และติดตั้ง dependencies จาก lockfile ครั้งแรก:

```bash
cd /Users/lek/teacher_project/home-work
npm ci
```

หาก clone ไว้ที่อื่น ให้เปลี่ยน path ในคำสั่ง `cd` ให้ตรงกับเครื่องของคุณ รันคำสั่ง npm ทั้งหมดในคู่มือนี้จากโฟลเดอร์ราก `home-work/`

## 2. ตั้งค่าเว็บสำหรับ Emulators

คัดลอกไฟล์ตัวอย่างครั้งแรก:

```bash
cp web/.env.example web/.env.local
```

หากมี `web/.env.local` อยู่แล้ว ให้แก้ไฟล์เดิมโดยไม่คัดลอกทับ จากนั้นตั้งค่าบรรทัดนี้:

```dotenv
VITE_USE_EMULATORS=true
```

ค่า `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` และ `VITE_APPCHECK_SITE_KEY` ในไฟล์ตัวอย่างปล่อยว่างได้สำหรับโหมดนี้ แอปจะใช้ค่าของโปรเจกต์จำลองเอง ไม่ต้องสร้าง `functions/.env` หรือกำหนด `APP_ORIGINS` สำหรับ Emulators

ถ้ามี `VITE_E2E_PROXY` จากการตั้งค่าทดสอบก่อนหน้า ให้ลบออกหรือตั้งเป็น `false` เพราะการรันปกติใช้ Functions ที่พอร์ต 5001

หลังเปลี่ยน `.env.local` ให้หยุดและเปิด `npm run dev` ใหม่

## 3. เปิด backend และเว็บ

ใช้ Terminal สองหน้าต่างและเปิดค้างไว้ทั้งคู่

### Terminal ที่ 1: Firebase Emulators

```bash
cd /Users/lek/teacher_project/home-work
npm run emulators
```

คำสั่งนี้ build shared, Functions และเว็บก่อนเปิด Auth, Firestore และ Functions Emulators รอจนแสดงว่า Emulators พร้อมใช้งานและโหลด Functions สำเร็จ ครั้งแรกอาจต้องดาวน์โหลดไฟล์ Emulator จึงต้องมีอินเทอร์เน็ต

### Terminal ที่ 2: เว็บ Vite

```bash
cd /Users/lek/teacher_project/home-work
npm run dev
```

เปิด [http://127.0.0.1:5173](http://127.0.0.1:5173) ในเบราว์เซอร์ ใช้ URL ที่ Terminal ของ Vite แสดงหากพอร์ต 5173 ถูกใช้อยู่และ Vite เลือกพอร์ตถัดไป

| บริการ                  | พอร์ตปกติ |
| ----------------------- | --------- |
| เว็บ                    | 5173      |
| Authentication Emulator | 9099      |
| Firestore Emulator      | 8080      |
| Functions Emulator      | 5001      |

Firebase Emulator UI ปิดอยู่ใน config ปัจจุบัน

## 4. เข้าสู่ระบบและทดลองใช้งาน

สำหรับบัญชีทดลองที่ใช้ซ้ำได้ เปิด:

```text
http://127.0.0.1:5173/sign-in?e2eTeacher=teacher-a
```

กด **เข้าสู่ระบบด้วย Google** แอปจะสร้างตัวตน Google จำลองใน Auth Emulator แล้วเปิดหน้าหลัก ไม่ต้องใช้บัญชี Google จริง ตัวเลือกนี้ทำงานเฉพาะ dev server ที่เปิด Emulators รวมถึงโหมด Wi-Fi ด้านล่าง

หากต้องการทดสอบครูอีกคน ให้ออกจากระบบก่อน แล้วเปิด URL เดิมโดยเปลี่ยน `teacher-a` เป็น `teacher-b` ชื่อบัญชีจำลองใช้ตัวอักษรอังกฤษ ตัวเลข `-` หรือ `_` ได้

หน้า `/sign-in` ที่ไม่มี `e2eTeacher` จะเปิด popup ของ Auth Emulator ผ่านปุ่ม Google ให้ใช้ข้อมูลบัญชีทดลองใน popup และอนุญาต popup หากเบราว์เซอร์บล็อก

เมื่อเริ่ม Emulator ใหม่จะยังไม่มีห้องเรียนหรือรายชื่อให้:

1. เปิด **ห้องเรียน** เลือกปีและภาคเรียน แล้วเพิ่มห้องเรียน
2. เปิดแท็บ **นักเรียน** เพิ่มรายชื่อ หรือนำเข้าจาก Excel
3. เปิดแท็บ **ชิ้นงาน** เพิ่มงานอย่างน้อยหนึ่งชิ้น
4. ดาวน์โหลด QR ของนักเรียน แล้วเปิด **สแกนงาน** และอนุญาตให้ใช้กล้อง
5. ตรวจผลในแท็บ **สรุปการส่งงาน**

สำหรับสแกนบนคอมพิวเตอร์ ให้แสดง QR บนอีกจอหรือใช้กระดาษเพื่อให้กล้องเห็นครบทั้งใบ สำหรับมือถือที่ต่อ Wi-Fi เดียวกัน ให้ใช้โหมด HTTPS ตามหัวข้อถัดไป

## ใช้งานผ่านมือถือที่ต่อ Wi-Fi เดียวกัน

โหมดนี้เปิดเว็บ HTTPS ที่พอร์ต **5174** แล้วส่งคำขอ Auth, Firestore และ Functions ผ่าน Vite ไปยัง Emulators ในคอมพิวเตอร์ มือถือจึงไม่ต้องเข้าถึงพอร์ต backend โดยตรง และใช้กล้องสแกน QR ได้ ไม่ต้องแก้ `firebase.json` หรือ `APP_ORIGINS`

### เตรียม HTTPS ครั้งแรก (macOS)

ติดตั้ง [mkcert](https://github.com/FiloSottile/mkcert) และสร้าง certificate ที่ตรงกับ IP ของคอมพิวเตอร์:

```bash
brew install mkcert
mkcert -install
ipconfig getifaddr en0
```

หาก `en0` ไม่แสดง IP ให้ดู IP ของ Wi-Fi ใน System Settings → Wi-Fi → Details → TCP/IP ใช้ IP นั้นแทน `192.168.1.123` ในคำสั่งต่อไปนี้:

```bash
mkdir -p .tools/lan
mkcert -key-file .tools/lan/key.pem -cert-file .tools/lan/cert.pem localhost 127.0.0.1 192.168.1.123
mkcert -CAROOT
```

นำไฟล์ **`rootCA.pem` เท่านั้น** จากโฟลเดอร์ที่คำสั่งสุดท้ายแสดงไปติดตั้งบนมือถือ เช่นส่งผ่าน AirDrop สำหรับ Android หากหน้าติดตั้งไม่รับ `.pem` ให้คัดลอกเปลี่ยนชื่อเป็น `rootCA.crt` ก่อนส่ง ห้ามส่ง `rootCA-key.pem` หรือ `.tools/lan/key.pem` ให้ผู้อื่น ไฟล์ certificate ใน `.tools/` ไม่ถูกเก็บใน git

- **iPhone/iPad:** ติดตั้ง profile ใน Settings → General → VPN & Device Management แล้วเปิดความเชื่อถือใน Settings → General → About → Certificate Trust Settings
- **Android:** ติดตั้งเป็น CA certificate ใน Settings → Security → Encryption & credentials → Install a certificate → CA certificate (ชื่อเมนูอาจต่างตามรุ่น) แล้วเปิดด้วย Chrome

มือถือจำเป็นต้องเชื่อถือ CA จึงจะเปิด HTTPS และขอใช้กล้องได้ตามปกติ รายละเอียดอ้างอิงจาก [คู่มือ mkcert สำหรับมือถือ](https://github.com/FiloSottile/mkcert#mobile-devices)

### เปิดระบบและเข้าใช้งาน

เปิด backend ตามปกติใน Terminal แรก (หากเปิดอยู่แล้ว ใช้ตัวเดิมได้):

```bash
npm run emulators
```

เปิดเว็บสำหรับ Wi-Fi ในอีก Terminal:

```bash
npm run dev:lan
```

คำสั่งนี้เปิดโหมด Emulators ให้อัตโนมัติ และใช้ certificate ใน `.tools/lan/` หากยังไม่ได้สร้างไฟล์จะเริ่มไม่ได้ สามารถเปิดพร้อมเว็บ localhost พอร์ต 5173 ได้

ต่อมือถือกับ Wi-Fi เดียวกับคอมพิวเตอร์ แล้วเปิด URL นี้โดยเปลี่ยน IP ให้ตรงกับเครื่อง:

```text
https://192.168.1.123:5174/sign-in?e2eTeacher=teacher-a
```

กด **เข้าสู่ระบบด้วย Google** เพื่อใช้บัญชีครูจำลองเดียวกับบนคอมพิวเตอร์ จากนั้นเปิด **สแกนงาน** และอนุญาตกล้อง ใช้ URL ที่มี `e2eTeacher` สำหรับโหมดมือถือ

หากเปิดไม่ได้ ให้ตรวจว่าใช้ `https://`, ยอมให้ Node รับการเชื่อมต่อใน firewall ของ macOS และ Wi-Fi ไม่ใช่เครือข่าย Guest ที่แยกอุปกรณ์ออกจากกัน หาก IP คอมพิวเตอร์เปลี่ยน ให้สร้าง certificate ใหม่ด้วย IP ใหม่แล้วเปิด `npm run dev:lan` อีกครั้ง โหมดนี้เปิดให้เครื่องในเครือข่ายเข้าถึงข้อมูลจำลอง จึงควรใช้เฉพาะ Wi-Fi ที่ไว้ใจได้และหยุดด้วย `Ctrl+C` เมื่อเลิกใช้

## 5. หยุดระบบและเปิดครั้งถัดไป

กด `Ctrl+C` ใน Terminal ของเว็บและ Terminal ของ Emulators รอให้ Emulators ปิดเสร็จ

คำสั่ง `npm run emulators` ปัจจุบันไม่ได้ export/import ข้อมูล เมื่อหยุดแล้วเปิดใหม่ ข้อมูลใน Auth และ Firestore Emulator จะเริ่มใหม่ หากเบราว์เซอร์ยังแสดงบัญชีเดิมแต่ทำรายการไม่ได้ ให้ออกจากระบบแล้วเข้าสู่ระบบจำลองใหม่

ครั้งถัดไปใช้ `npm run emulators` และ `npm run dev` ในสอง Terminal ได้เลย ไม่ต้องติดตั้ง dependencies หรือคัดลอก `.env.local` ใหม่

เว็บจะอัปเดตเมื่อแก้ source ผ่าน Vite ส่วน backend ที่ Emulator ใช้เป็นไฟล์ build หากแก้ `functions/` หรือ contracts ใน `shared/` ให้หยุด Emulators แล้วรัน `npm run emulators` ใหม่เพื่อ build และโหลดโค้ดล่าสุด

## 6. รันทดสอบ

ตรวจ types และ unit tests:

```bash
npm run typecheck
npm test
```

ทดสอบ backend integration และ Firestore Rules:

```bash
npm run test:integration
```

ทดสอบผ่านเบราว์เซอร์:

```bash
npm run test:e2e:local
```

หยุดเว็บและ Emulators ที่เปิดเองก่อนรัน integration หรือ E2E ทั้งสองคำสั่งเปิด/ปิดบริการให้เองและล้างข้อมูลทดสอบ ห้ามรันสองชุดพร้อมกัน E2E ต้องใช้พอร์ต 5173, 4400, 4410, 8080, 9099 และ 5001 ว่าง

E2E จะเลือก Google Chrome ที่ติดตั้งไว้ใน macOS ให้อัตโนมัติ หากไม่มี Chrome หรือยังขาด FFmpeg ให้ติดตั้ง browser assets จากโฟลเดอร์ราก:

```bash
PLAYWRIGHT_BROWSERS_PATH="$PWD/.tools/playwright" npx playwright install chromium ffmpeg
```

รายละเอียดชุดทดสอบอยู่ใน [tests/e2e/README.md](../tests/e2e/README.md)

## แก้ปัญหาที่พบบ่อย

| อาการ                                                 | วิธีตรวจและแก้                                                                                                              |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| ปุ่มเข้าสู่ระบบกดไม่ได้ หรือแจ้งว่ายังไม่ได้เชื่อมต่อ | ตรวจ `web/.env.local` ว่าเป็น `VITE_USE_EMULATORS=true` แล้วเปิด Vite ใหม่                                                  |
| หน้าเว็บเปิดได้ แต่โหลดข้อมูลหรือบันทึกไม่ได้         | ตรวจว่า Terminal ของ Emulators ยังทำงาน และ Functions โหลดสำเร็จ; ตรวจว่าไม่ได้เปิด `VITE_E2E_PROXY=true`                   |
| พอร์ตถูกใช้งาน / `EADDRINUSE`                         | หยุดบริการหรือชุดทดสอบเดิมที่ใช้พอร์ตนั้น แล้วเริ่มใหม่                                                                     |
| Firestore แจ้งเวอร์ชัน Java ไม่รองรับ                 | ใช้ Java 21 ผ่าน PATH หรือ Java ที่สคริปต์เลือกจาก `.tools/java21/Contents/Home/bin/java`                                   |
| Node หรือ Vite เริ่มไม่ได้                            | ตรวจว่าใช้ Node 22.12 ขึ้นไปใน Terminal ทั้งสองหน้าต่าง                                                                     |
| เข้าสู่ระบบผ่าน popup ไม่ได้                          | อนุญาต popup หรือใช้ URL บัญชีจำลอง `?e2eTeacher=teacher-a`                                                                 |
| กล้องเปิดไม่ได้                                       | คอมพิวเตอร์ใช้ `localhost`; มือถือใช้ HTTPS โหมด Wi-Fi และติดตั้ง CA ให้เชื่อถือ จากนั้นอนุญาตกล้องและปิดแอปอื่นที่ใช้กล้อง |
| เข้าบัญชีเดิมไม่ได้หลังเปิด Emulator ใหม่             | ออกจากระบบแล้วเข้าสู่ระบบอีกครั้ง เพราะข้อมูล Auth Emulator เริ่มใหม่                                                       |

การเชื่อมต่อ Firebase project จริงและขั้นตอน deploy อยู่ใน [deployment.md](deployment.md)
