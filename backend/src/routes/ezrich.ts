import express from 'express';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const router = express.Router();

router.post('/gateway/ezrich', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) return res.status(400).json({ error: 'apiKey required' });
  const existing = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  const gw = existing
    ? await prisma.gateway.update({ where: { id: existing.id }, data: { apiKey } })
    : await prisma.gateway.create({ data: { name: 'EZRich', apiKey } });
  await prisma.gatewayHistory.create({
    data: { gatewayId: gw.id, event: 'STATUS_TOGGLE', meta: { apiKeySet: true } }
  });
  res.json(gw);
});

router.post('/gateway/ezrich/toggle', async (_req, res) => {
  const existing = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  if (!existing) return res.status(404).json({ error: 'Gateway not found' });
  const gw = await prisma.gateway.update({
    where: { id: existing.id },
    data: { isActive: !existing.isActive }
  });
  await prisma.gatewayHistory.create({
    data: { gatewayId: gw.id, event: 'STATUS_TOGGLE', meta: { isActive: gw.isActive } }
  });
  res.json(gw);
});

router.post('/gateway/ezrich/maintenance', async (req, res) => {
  const { depositStart, depositEnd, withdrawStart, withdrawEnd } = req.body;
  const existing = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  if (!existing) return res.status(404).json({ error: 'Gateway not found' });
  const gw = await prisma.gateway.update({
    where: { id: existing.id },
    data: {
      maintenanceDepositStart: depositStart,
      maintenanceDepositEnd: depositEnd,
      maintenanceWithdrawStart: withdrawStart,
      maintenanceWithdrawEnd: withdrawEnd
    }
  });
  await prisma.gatewayHistory.create({
    data: {
      gatewayId: gw.id,
      event: 'MAINTENANCE_EDIT',
      meta: { depositStart, depositEnd, withdrawStart, withdrawEnd }
    }
  });
  res.json(gw);
});

router.post('/gateway/ezrich/pair', async (_req, res) => {
  const existing = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  if (!existing) return res.status(404).json({ error: 'Gateway not found' });
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await prisma.gatewayHistory.create({
    data: { gatewayId: existing.id, event: 'PAIRING', meta: { code, ttlSec: 300 } }
  });
  res.json({ pairingCode: code, expiresIn: 300 });
});

router.post('/gateway/ezrich/mobile', async (req, res) => {
  const { connected } = req.body;
  const existing = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  if (!existing) return res.status(404).json({ error: 'Gateway not found' });
  const gw = await prisma.gateway.update({
    where: { id: existing.id },
    data: { mobileConnected: !!connected }
  });
  await prisma.gatewayHistory.create({
    data: { gatewayId: gw.id, event: 'PAIRING', meta: { connected: !!connected } }
  });
  res.json(gw);
});

router.get('/gateway/ezrich', async (_req, res) => {
  const gw = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  if (!gw) return res.status(404).json({ error: 'Gateway not found' });
  res.json(gw);
});

export default router;
