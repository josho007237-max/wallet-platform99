import express from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

router.get('/withdrawal/settings', async (_req, res) => {
  const setting = await prisma.withdrawalSetting.findFirst({ orderBy: { id: 'desc' } });
  res.json(setting);
});

router.post('/withdrawal/settings', async (req, res) => {
  const { minAmount, maxAmount, dailyLimit, fee, processingTime, isActive } = req.body;
  if (minAmount < 0 || maxAmount <= 0 || dailyLimit <= 0) {
    return res.status(400).json({ error: 'Invalid numeric settings' });
  }
  if (minAmount > maxAmount) {
    return res.status(400).json({ error: 'minAmount must be <= maxAmount' });
  }
  const setting = await prisma.withdrawalSetting.create({
    data: { minAmount, maxAmount, dailyLimit, fee, processingTime, isActive: isActive ?? true }
  });
  res.json(setting);
});

export default router;
