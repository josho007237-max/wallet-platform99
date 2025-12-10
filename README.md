# Wallet & Payment Automation Platform

ระบบ Wallet & Payment Automation สำหรับการฝาก–ถอนอัตโนมัติ, การเชื่อมต่อ TrueMoney/PromptPay/Bank/Gateway, การจัดการยอดเงินสมาชิก, และแดชบอร์ด Admin/User

## Features

- รองรับ Bank Accounts, TrueMoney Wallet, PromptPay, Gateway (EZRich)
- ระบบ Deposit/Withdraw พร้อม validation, lock/unlock workflow
- Ledger & Balance ตรวจสอบย้อนหลังได้
- JWT Auth + (reserved) LINE Login สำหรับสมาชิก
- Queue Workers สำหรับงาน async (ฝาก–ถอน)
- React + Tailwind UI สำหรับ Admin/User

## Project Structure (สรุป)

- `backend/` — Node.js + Express + Prisma
  - REST API endpoints (auth, deposit, withdraw, wallet, webhooks, gateway)
  - Services: balance, lock, validation, maintenance windows
  - Workers + in-memory queue สำหรับ async jobs
  - Cron ดึงยอด balance จาก EZRich
- `frontend/` — React + Vite + Tailwind
  - หน้า Login (LINE + username/password)
  - (เตรียมโครง) Dashboard, WalletCard, TransactionTable
- `infra/`
  - ตัวอย่าง Nginx config + SSL cert placeholders
- `docker-compose.yml`
  - dev stack: Postgres + backend + frontend
- `.github/workflows/ci-cd.yml`
  - ตัวอย่าง GitHub Actions build

## Development (Dev)

```bash
# 1) Backend
cd backend
npm install
npm run prisma:generate
npm run dev

# 2) Frontend
cd ../frontend
npm install
npm run dev
```

จากนั้นเปิด `http://localhost:5173` เพื่อเข้า UI หน้า Login

## Notes / TODO

- `node-fetch` v3 เป็น ESM-only ถ้าใช้กับ CommonJS อาจต้องเปลี่ยนเป็น v2 หรือปรับเป็น ESM ทั้งโปรเจกต์
- ตอนนี้ route `/auth/line` และ LINE Login flow ยังไม่ได้ทำจริง เป็น placeholder
- middleware บางส่วนยังใช้ `requireUser` แบบ mock (userId = 123) ต้องเปลี่ยนมาใช้ `authGuard` จริงเมื่อต่อ JWT/LINE ครบ
