import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function validateDepositParams(userId: number, amount: number, channel: string) {
  const setting = await prisma.depositSetting.findFirst({ orderBy: { id: 'desc' } });
  if (!setting || !setting.isActive) return { ok: false, error: 'Deposit disabled' };

  const allowed = setting.allowChannels.split(',').map((s) => s.trim());
  if (!allowed.includes(channel)) return { ok: false, error: `Channel not allowed: ${channel}` };

  if (amount < setting.minAmount) return { ok: false, error: `Below minimum: ${setting.minAmount}` };
  if (amount > setting.maxAmount) return { ok: false, error: `Exceeds maximum: ${setting.maxAmount}` };

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const todaySum = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      userId,
      type: 'deposit',
      status: { in: ['pending', 'matched', 'credited'] },
      createdAt: { gte: startOfDay, lte: endOfDay }
    }
  });
  const used = todaySum._sum.amount || 0;
  if (used + amount > setting.dailyLimit) {
    return { ok: false, error: `Daily limit exceeded: used ${used}, limit ${setting.dailyLimit}` };
  }
  return { ok: true, setting, usedToday: used };
}
