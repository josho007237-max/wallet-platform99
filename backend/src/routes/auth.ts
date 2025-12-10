import express from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword, signAccessToken, issueRefreshToken, rotateRefreshToken } from '../services/authService';

const prisma = new PrismaClient();
const router = express.Router();

router.post('/auth/register-admin', async (req, res) => {
  const { username, password } = req.body;
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return res.status(400).json({ error: 'Username exists' });
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { username, passwordHash, role: 'admin' } });
  res.json({ id: user.id, username: user.username, role: user.role });
});

router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);
  res.json({ accessToken, refreshToken, role: user.role });
});

router.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  try {
    const newRefresh = await rotateRefreshToken(refreshToken);
    const tokenRow = await prisma.refreshToken.findUnique({ where: { token: newRefresh } });
    const user = await prisma.user.findUnique({ where: { id: tokenRow!.userId } });
    const accessToken = signAccessToken({ userId: user!.id, role: user!.role });
    res.json({ accessToken, refreshToken: newRefresh });
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

router.post('/auth/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.delete({ where: { token: refreshToken } }).catch(() => {});
  }
  res.json({ ok: true });
});

// TODO: implement LINE Login callback at /auth/line/callback etc.

export default router;
