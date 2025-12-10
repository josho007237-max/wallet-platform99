import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

async function updateEzrichBalance() {
  const gw = await prisma.gateway.findFirst({ where: { name: 'EZRich' } });
  if (!gw || !gw.apiKey || !gw.isActive) return;

  // TODO: เปลี่ยนเป็น endpoint จริงของ EZRich
  const resp = await fetch('https://api.ezrich.example.com/v1/balance', {
    headers: { Authorization: `Bearer ${gw.apiKey}` },
  });

  if (!resp.ok) {
    await prisma.gatewayHistory.create({
      data: {
        gatewayId: gw.id,
        event: 'BALANCE_UPDATE',
        meta: JSON.stringify({ error: resp.status }),   // <- ตรงนี้
      },
    });
    return;
  }

  const data = await resp.json() as { balance?: number };
  const balance = Number(data.balance ?? 0);

  const updated = await prisma.gateway.update({
    where: { id: gw.id },
    data: { balance, lastUpdated: new Date() },
  });

  await prisma.gatewayHistory.create({
    data: {
      gatewayId: gw.id,
      event: 'BALANCE_UPDATE',
      meta: JSON.stringify({ balance }),               // <- และตรงนี้
    },
  });

  return updated;
}

// poll ทุก 60 วิ
setInterval(() => {
  updateEzrichBalance().catch(console.error);
}, 60_000);
