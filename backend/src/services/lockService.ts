import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureWallet(userId: number) {
  const found = await prisma.walletBalance.findUnique({ where: { userId } });
  if (found) return found;
  return prisma.walletBalance.create({ data: { userId } });
}

export async function lockAmount({
  userId,
  amount,
  txId,
  note,
  idempotencyKey
}: {
  userId: number;
  amount: number;
  txId?: number;
  note?: string;
  idempotencyKey?: string;
}) {
  if (amount <= 0) throw new Error('Amount must be positive');
  if (idempotencyKey) {
    const dup = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey } });
    if (dup) return dup;
  }
  return prisma.$transaction(async (trx) => {
    await ensureWallet(userId);
    const wallet = await trx.walletBalance.findUnique({ where: { userId } });
    if (!wallet || wallet.available < amount) throw new Error('Insufficient available balance');
    const beforeAvail = wallet.available;
    const beforeLocked = wallet.locked;
    const afterAvail = beforeAvail - amount;
    const afterLocked = beforeLocked + amount;
    const entry = await trx.ledgerEntry.create({
      data: {
        userId,
        txId,
        type: 'lock',
        amount,
        balanceBefore: beforeAvail,
        balanceAfter: afterAvail,
        lockedBefore: beforeLocked,
        lockedAfter: afterLocked,
        idempotencyKey,
        note
      }
    });
    await trx.walletBalance.update({
      where: { userId },
      data: { available: afterAvail, locked: afterLocked }
    });
    return entry;
  });
}

export async function unlockAmount({
  userId,
  amount,
  txId,
  note,
  idempotencyKey
}: {
  userId: number;
  amount: number;
  txId?: number;
  note?: string;
  idempotencyKey?: string;
}) {
  if (amount <= 0) throw new Error('Amount must be positive');
  if (idempotencyKey) {
    const dup = await prisma.ledgerEntry.findUnique({ where: { idempotencyKey } });
    if (dup) return dup;
  }
  return prisma.$transaction(async (trx) => {
    await ensureWallet(userId);
    const wallet = await trx.walletBalance.findUnique({ where: { userId } });
    if (!wallet || wallet.locked < amount) throw new Error('Insufficient locked balance');
    const beforeAvail = wallet.available;
    const beforeLocked = wallet.locked;
    const afterAvail = beforeAvail + amount;
    const afterLocked = beforeLocked - amount;
    const entry = await trx.ledgerEntry.create({
      data: {
        userId,
        txId,
        type: 'unlock',
        amount,
        balanceBefore: beforeAvail,
        balanceAfter: afterAvail,
        lockedBefore: beforeLocked,
        lockedAfter: afterLocked,
        idempotencyKey,
        note
      }
    });
    await trx.walletBalance.update({
      where: { userId },
      data: { available: afterAvail, locked: afterLocked }
    });
    return entry;
  });
}
