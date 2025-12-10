import express from 'express';
import { PrismaClient } from '@prisma/client';
import { validateDepositParams } from '../services/depositValidation';
import { isDepositMaintenance } from '../services/maintenanceHelpers';

const prisma = new PrismaClient();
const router = express.Router();

// TODO: replace with real auth middleware
function requireUser(req: any, _res: any, next: any) { req.userId = 123; next(); }

router.post('/deposit', requireUser, async (req, res) => {
  const userId = (req as any).userId as number;
  const { amount, channel } = req.body;
  if (!amount || amount <= 0 || !channel) {
    return res.status(400).json({ error: 'Invalid params' });
  }
  const gw = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  if (gw && gw.isActive && isDepositMaintenance(gw)) {
    return res.status(503).json({ error: 'Deposit under maintenance window' });
  }

  const check = await validateDepositParams(userId, amount, channel);
  if (!check.ok) return res.status(400).json({ error: check.error });

  const tx = await prisma.transaction.create({
    data: { userId, type: 'deposit', channel, amount, status: 'pending' }
  });
  res.json({ message: 'Deposit request created', tx });
});

export default router;
