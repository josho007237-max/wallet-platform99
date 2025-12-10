import { PrismaClient } from '@prisma/client';
import { credit } from '../services/balanceService';

const prisma = new PrismaClient();

export async function creditDeposit(txId: number) {
  const tx = await prisma.transaction.findUnique({ where: { id: txId } });
  if (!tx || tx.type !== 'deposit' || tx.status !== 'matched') return;
  const idempotencyKey = `credit_tx_${tx.id}`;
  await credit({
    userId: tx.userId,
    amount: tx.amount,
    txId: tx.id,
    reference: tx.reference || undefined,
    note: 'Deposit credited',
    idempotencyKey
  });
  await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'credited' } });
}
