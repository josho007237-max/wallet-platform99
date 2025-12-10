import express from 'express';
import { PrismaClient } from '@prisma/client';
import { validateWithdrawParams } from '../services/withdrawValidation';
import { isWithdrawMaintenance } from '../services/maintenanceHelpers';
import { lockAmount, unlockAmount } from '../services/lockService';
import { enqueue } from '../queue';

const prisma = new PrismaClient();
const router = express.Router();

// TODO: replace with real auth middleware
function requireUser(req: any, _res: any, next: any) { req.userId = 123; next(); }

router.post('/withdraw', requireUser, async (req, res) => {
  const userId = (req as any).userId as number;
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  const gw = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  if (!gw || !gw.isActive) return res.status(503).json({ error: 'Gateway unavailable' });
  if (isWithdrawMaintenance(gw)) {
    return res.status(503).json({ error: 'Withdraw under maintenance window' });
  }
  const check = await validateWithdrawParams(userId, amount);
  if (!check.ok) return res.status(400).json({ error: check.error });

  const tx = await prisma.transaction.create({
    data: { userId, type: 'withdraw', amount, fee: check.setting?.fee ?? 0, status: 'locked' }
  });

  try {
    await lockAmount({
      userId,
      amount: amount + (check.setting?.fee ?? 0),
      txId: tx.id,
      note: 'Withdraw request locked',
      idempotencyKey: `lock_withdraw_${userId}_${tx.id}`
    });
  } catch (e: any) {
    await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'failed' } });
    return res.status(400).json({ error: e.message });
  }

  enqueue({ name: 'withdraw_process', data: { txId: tx.id } });
  res.json({ message: 'Withdraw locked', tx });
});

router.post('/withdraw/:id/approve', async (req, res) => {
  const id = Number(req.params.id);
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx || tx.status !== 'locked') {
    return res.status(400).json({ error: 'Invalid transaction state' });
  }

  const userId = tx.userId;
  const total = tx.amount + (tx.fee || 0);

  const updated = await prisma.$transaction(async (trx) => {
    const wallet = await trx.walletBalance.findUnique({ where: { userId } });
    if (!wallet || wallet.locked < total) throw new Error('Locked balance not enough');
    const beforeAvail = wallet.available;
    const beforeLocked = wallet.locked;
    const afterAvail = beforeAvail;
    const afterLocked = beforeLocked - total;
    await trx.ledgerEntry.create({
      data: {
        userId,
        txId: tx.id,
        type: 'debit',
        amount: total,
        balanceBefore: beforeAvail,
        balanceAfter: afterAvail,
        lockedBefore: beforeLocked,
        lockedAfter: afterLocked,
        note: 'Withdraw approved (deduct from locked)',
        idempotencyKey: `debit_withdraw_${userId}_${tx.id}`
      }
    });
    await trx.walletBalance.update({
      where: { userId },
      data: { available: afterAvail, locked: afterLocked }
    });
    return trx.transaction.update({ where: { id: tx.id }, data: { status: 'approved' } });
  });

  res.json({ message: 'Withdraw approved', tx: updated });
});

router.post('/withdraw/:id/cancel', async (req, res) => {
  const id = Number(req.params.id);
  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx || tx.status !== 'locked') {
    return res.status(400).json({ error: 'Invalid transaction state' });
  }
  const total = tx.amount + (tx.fee || 0);
  await unlockAmount({
    userId: tx.userId,
    amount: total,
    txId: tx.id,
    note: 'Withdraw cancelled (unlock)',
    idempotencyKey: `unlock_withdraw_${tx.userId}_${tx.id}`
  });
  const updated = await prisma.transaction.update({
    where: { id: tx.id },
    data: { status: 'cancelled' }
  });
  res.json({ message: 'Withdraw cancelled', tx: updated });
});

export default router;
