import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function processWithdraw(txId: number) {
  const tx = await prisma.transaction.findUnique({ where: { id: txId } });
  if (!tx || tx.type !== 'withdraw' || tx.status !== 'locked') return;
  // สมมติ gateway ผ่าน
  const ok = true;
  if (!ok) {
    await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'failed' } });
    return;
  }
  // หมายเหตุ: การตัดยอดจาก locked จะทำใน approve endpoint ตาม state machine ที่ตั้งไว้
  // ที่นี่สามารถ trigger approve อัตโนมัติ หากต้องการ
  await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'approved' } });
}
