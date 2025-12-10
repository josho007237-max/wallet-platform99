import express from 'express';
import { PrismaClient } from '@prisma/client';
import { enqueue } from '../queue';

const prisma = new PrismaClient();
const router = express.Router();

router.post('/webhook/truemoney', async (req, res) => {
  const { amount, transactionId } = req.body;

  const pending = await prisma.transaction.findFirst({
    where: { type: 'deposit', channel: 'truemoney', status: 'pending', amount },
    orderBy: { createdAt: 'desc' }
  });

  if (!pending) {
    await prisma.transaction.create({
      data: {
        userId: 0,
        type: 'deposit',
        channel: 'truemoney',
        amount,
        status: 'failed',
        reference: transactionId
      }
    });
    return res.status(200).json({ ok: false, message: 'No matching pending deposit' });
  }

  const matched = await prisma.transaction.update({
    where: { id: pending.id },
    data: { status: 'matched', reference: transactionId }
  });

  enqueue({ name: 'deposit_credit', data: { txId: matched.id } });
  res.json({ ok: true, matched });
});

export default router;
