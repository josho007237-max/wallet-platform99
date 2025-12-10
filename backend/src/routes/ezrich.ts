import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const router = express.Router();

// ตั้ง/อัปเดต apiKey ของ EZRich
router.post('/gateway/ezrich', async (req: Request, res: Response) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'apiKey required' });

  const existing = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  const gw = existing
    ? await prisma.gateway.update({ where: { id: existing.id }, data: { apiKey } })
    : await prisma.gateway.create({ data: { name: 'EZRich', apiKey } });

  await prisma.gatewayHistory.create({
    data: {
      gatewayId: gw.id,
      event: 'STATUS_TOGGLE',
      meta: JSON.stringify({ apiKeySet: true }),
    },
  });

  res.json(gw);
});

// เปิด/ปิดการใช้งาน EZRich
router.post('/gateway/ezrich/toggle', async (_req: Request, res: Response) => {
  const existing = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  if (!existing) return res.status(404).json({ error: 'Gateway not found' });

  const gw = await prisma.gateway.update({
    where: { id: existing.id },
    data: { isActive: !existing.isActive },
  });

  await prisma.gatewayHistory.create({
    data: {
      gatewayId: gw.id,
      event: 'STATUS_TOGGLE',
      meta: JSON.stringify({ isActive: gw.isActive }),
    },
  });

  res.json(gw);
});

// ตั้ง maintenance window สำหรับฝาก/ถอน
router.post('/gateway/ezrich/maintenance', async (req: Request, res: Response) => {
  const { depositStart, depositEnd, withdrawStart, withdrawEnd } = req.body;

  const existing = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  if (!existing) return res.status(404).json({ error: 'Gateway not found' });

  const gw = await prisma.gateway.update({
    where: { id: existing.id },
    data: {
      maintenanceDepositStart: depositStart,
      maintenanceDepositEnd: depositEnd,
      maintenanceWithdrawStart: withdrawStart,
      maintenanceWithdrawEnd: withdrawEnd,
    },
  });

  await prisma.gatewayHistory.create({
    data: {
      gatewayId: gw.id,
      event: 'MAINTENANCE_EDIT',
      meta: JSON.stringify({ depositStart, depositEnd, withdrawStart, withdrawEnd }),
    },
  });

  res.json(gw);
});

// สร้าง pairing code ให้ mobile app
router.post('/gateway/ezrich/pair', async (_req: Request, res: Response) => {
  const existing = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  if (!existing) return res.status(404).json({ error: 'Gateway not found' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();

  await prisma.gatewayHistory.create({
    data: {
      gatewayId: existing.id,
      event: 'PAIRING',
      meta: JSON.stringify({ code, ttlSec: 300 }),
    },
  });

  res.json({ pairingCode: code, expiresIn: 300 });
});

// อัปเดตสถานะ mobileConnected
router.post('/gateway/ezrich/mobile', async (req: Request, res: Response) => {
  const { connected } = req.body;

  const existing = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  if (!existing) return res.status(404).json({ error: 'Gateway not found' });

  const gw = await prisma.gateway.update({
    where: { id: existing.id },
    data: { mobileConnected: !!connected },
  });

  await prisma.gatewayHistory.create({
    data: {
      gatewayId: gw.id,
      event: 'PAIRING',
      meta: JSON.stringify({ connected: !!connected }),
    },
  });

  res.json(gw);
});

// ดึง config EZRich ปัจจุบัน
router.get('/gateway/ezrich', async (_req: Request, res: Response) => {
  const gw = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  if (!gw) return res.status(404).json({ error: 'Gateway not found' });
  res.json(gw);
});

export default router;
