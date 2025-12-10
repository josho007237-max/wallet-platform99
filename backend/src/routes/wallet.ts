import express from 'express';
import { PrismaClient } from '@prisma/client';
import { credit, debit } from '../services/balanceService';

const prisma = new PrismaClient();
const router = express.Router();

// TODO: replace with real auth middleware
function requireUser(req: any, _res: any, next: any) { req.userId = 123; next(); }

router.get('/wallet/balance', requireUser, async (req, res) => {
  const userId = (req as any).userId;
  const wallet = await prisma.walletBalance.findUnique({ where: { userId } });
  res.json(wallet || { available: 0, locked: 0 });
});

router.get('/wallet/ledger', requireUser, async (req, res) => {
  const userId = (req as any).userId;
  const { page = 1, pageSize = 20 } = req.query as any;
  const skip = (Number(page) - 1) * Number(pageSize);
  const [items, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      skip,
      take: Number(pageSize)
    }),
    prisma.ledgerEntry.count({ where: { userId } })
  ]);
  res.json({ items, total, page: Number(page), pageSize: Number(pageSize) });
});

router.post('/wallet/manual/credit', async (req, res) => {
  const { userId, amount, note } = req.body;
  try {
    const entry = await credit({
      userId,
      amount,
      note,
      idempotencyKey: `manual_credit_${userId}_${Date.now()}`
    });
    res.json(entry);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/wallet/manual/debit', async (req, res) => {
  const { userId, amount, note } = req.body;
  try {
    const entry = await debit({
      userId,
      amount,
      note,
      idempotencyKey: `manual_debit_${userId}_${Date.now()}`
    });
    res.json(entry);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
