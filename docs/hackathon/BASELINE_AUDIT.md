# Baseline Audit — HumanoidTH (upstream `bef80bd`)

ทีมตรวจ repository ต้นทาง `taechasith/HumanoidTH` ที่ commit `bef80bd` โดยอ่านโค้ดทุก route/module ที่เกี่ยวข้อง และรันเครื่องมือตรวจที่มากับ repo เอง
พบ **8 Gap** ที่ทำให้ระบบหลักยังไม่พร้อม Demo ทุกข้อด้านล่างระบุไฟล์และบรรทัดใน upstream เพื่อให้กรรมการตรวจซ้ำได้

## วิธีตรวจซ้ำ

```bash
git clone https://github.com/taechasith/HumanoidTH && cd HumanoidTH
pnpm install
pnpm check:no-mock-data     # upstream: ล้มเหลว 7 จุด (Gap 2)
grep -rn "gemini-1.5-flash" lib app          # Gap 1: 3 จุด
grep -n "admin_session" middleware.ts         # Gap 3
```

## สรุป Gap

| # | ความรุนแรง | Gap | หลักฐานใน upstream | ผลกระทบ | แผนแก้ใน Hack Day |
| --- | --- | --- | --- | --- | --- |
| 1 | สูง | AI เรียกโมเดล `gemini-1.5-flash` ที่ถูกปลดแล้ว และ hard-code ไว้ 3 จุด | `lib/classifiers.ts:138`, `app/map/actions.ts:174`, `lib/ingest/save.ts:48` | classification, stance และ map clustering ล้มทั้งระบบ | Gemini client กลาง `lib/gemini.ts` อ่านรุ่นจาก `GEMINI_MODEL`, ส่ง key ทาง header, มี timeout |
| 2 | สูง | เมื่อ Gemini ล้ม ระบบเขียนคลัสเตอร์ที่ hard-code ลง `StatsCache` แล้วแสดงบนแผนที่เหมือนข้อมูลจริง | `app/map/actions.ts:19, 264–275`; `pnpm check:no-mock-data` ล้ม 7 จุด | ผู้ใช้เห็นข้อมูลที่ไม่มีอยู่จริง ขัดกับกติกา no-mock ของ repo เอง | ลบข้อมูลที่ hard-code, แสดง error ล่าสุด, ตัดพิกัดนอกประเทศไทย |
| 3 | วิกฤต | ประตู admin เป็น cookie `admin_session=true` ที่ไม่มีลายเซ็น | `middleware.ts:19`, `app/actions.ts:150, 186, 222` | ตั้ง cookie เองในเบราว์เซอร์แล้วเข้า `/admin` ได้ทันที | Session แบบ HMAC-SHA256 มีวันหมดอายุ ตรวจทั้งใน middleware และ server action |
| 4 | วิกฤต | รหัสผ่าน admin มีค่า default อยู่ในโค้ดสาธารณะ | `middleware.ts:31`, `app/actions.ts:210` | ถ้า production ไม่ตั้ง env ใครก็ login และเรียก admin API ได้ | ลบค่า default; production ปิด admin จนกว่าจะตั้ง env ครบ |
| 5 | สูง | ยกระดับสิทธิ์เองได้: ฟอร์มสมัครรับ role จากผู้ใช้ และมีปุ่ม "Login as Administrator" สาธารณะ | `app/actions.ts:162`, `app/profile/page.tsx:79, 92` | ผู้ใช้ทั่วไปเป็น ADMIN ได้ | จำกัด role เป็น USER/RESEARCHER; ปุ่มจำลอง role ใช้ได้เฉพาะตอนพัฒนา |
| 6 | สูง | Admin server action ไม่ตรวจสิทธิ์ฝั่ง server | `app/actions.ts` (upsert CMS, `runDataPull`, `updateSubmissionStatus`), `app/map/actions.ts` (re-analyze) | เรียก action จากหน้าอื่นเพื่อแก้ข้อมูลหรือใช้ quota AI ได้ | `requireAdmin()` ทุก action |
| 7 | กลาง | คำสั่ง seed ใช้ `tsx.CMD` ที่รันได้แค่ Windows | `prisma.config.ts:11` | seed ผ่าน Prisma ใช้ไม่ได้บน macOS/Linux | `tsx prisma/seed.ts` |
| 8 | ต่ำ | script `network:check` ชี้โฟลเดอร์ `scratch/` ที่ไม่มีใน repo | `package.json:22` | script รันไม่ได้ | ลบ script |

## สิ่งที่ต้องตรวจเพิ่มในวัน Hack Day
- `@prisma/adapter-pg` (^7.8) กับ `@prisma/client` (6.19) คนละ major: ทดสอบ query จริง ถ้า error ให้ pin adapter ให้ตรงกับ client
- ระบบ Python เดิม (`src/humanoid_atlas`) อยู่คู่กับ Next.js: ทีมใช้ Next.js เป็นระบบหลักและจะระบุใน README

## Definition of Done ของ Baseline
- `pnpm build`, `pnpm test`, `pnpm check:no-mock-data` และ Playwright smoke ผ่าน
- ตั้ง cookie `admin_session=true` เองแล้วเข้า `/admin` ไม่ได้ และฟอร์มสมัครให้ role ADMIN ไม่ได้
- ทุก Gap มี commit ของตัวเอง (`fix:`) และบันทึกใน `CHANGELOG.md`
