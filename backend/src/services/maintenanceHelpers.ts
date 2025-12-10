import { Gateway } from '@prisma/client';

function timeToMinutes(t?: string | null) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function isDepositMaintenance(gw: Gateway, now = new Date()) {
  const start = timeToMinutes(gw.maintenanceDepositStart);
  const end = timeToMinutes(gw.maintenanceDepositEnd);
  if (start == null || end == null) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  if (start <= end) return current >= start && current <= end;
  return current >= start || current <= end;
}

export function isWithdrawMaintenance(gw: Gateway, now = new Date()) {
  const start = timeToMinutes(gw.maintenanceWithdrawStart);
  const end = timeToMinutes(gw.maintenanceWithdrawEnd);
  if (start == null || end == null) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  if (start <= end) return current >= start && current <= end;
  return current >= start || current <= end;
}
