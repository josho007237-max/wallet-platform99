import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function ensureWallet(userId: number) {
  const found = await prisma.walletBalance.findUnique({ where: { userId } });
  if (found) return found;
  return prisma.walletBalance.create({ data: { userId } });
}

export async function credit({
  userId,
  amount,
  txId,
  reference,
  note,
  idempotencyKey
}: {
  userId: number;
  amount: number;
  txId?: number;
  reference?: string;
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
    const before = wallet!.available;
    const after = before + amount;
    const entry = await trx.ledgerEntry.create({
      data: {
        userId,
        txId,
        type: 'credit',
        amount,
        balanceBefore: before,
        balanceAfter: after,
        reference,
        idempotencyKey,
        note
      }
    });
    await trx.walletBalance.update({ where: { userId }, data: { available: after } });
    return entry;
  });
}

export async function debit({
  userId,
  amount,
  txId,
  reference,
  note,
  idempotencyKey
}: {
  userId: number;
  amount: number;
  txId?: number;
  reference?: string;
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
    if (wallet!.available < amount) throw new Error('Insufficient balance');
    const before = wallet!.available;
    const after = before - amount;
    const entry = await trx.ledgerEntry.create({
      data: {
        userId,
        txId,
        type: 'debit',
        amount,
        balanceBefore: before,
        balanceAfter: after,
        reference,
        idempotencyKey,
        note
      }
    });
    await trx.walletBalance.update({ where: { userId }, data: { available: after } });
    return entry;
  });
}
