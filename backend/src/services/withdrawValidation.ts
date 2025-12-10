import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function validateWithdrawParams(userId: number, amount: number) {
  const setting = await prisma.withdrawalSetting.findFirst({ orderBy: { id: 'desc' } });
  if (!setting || !setting.isActive) return { ok: false, error: 'Withdrawal is temporarily disabled' };
  if (amount < setting.minAmount) return { ok: false, error: `Amount below minimum: ${setting.minAmount}` };
  if (amount > setting.maxAmount) return { ok: false, error: `Amount exceeds maximum: ${setting.maxAmount}` };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const todayWithdrawSum = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      userId,
      type: 'withdraw',
      status: { in: ['pending', 'approved', 'locked'] },
      createdAt: { gte: startOfDay, lte: endOfDay }
    }
  });
  const used = todayWithdrawSum._sum.amount || 0;
  if (used + amount > setting.dailyLimit) {
    return { ok: false, error: `Daily limit exceeded: used ${used}, limit ${setting.dailyLimit}` };
  }
  return { ok: true, setting, usedToday: used };
}
