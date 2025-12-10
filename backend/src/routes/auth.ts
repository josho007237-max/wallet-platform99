import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
} from '../services/authService';

const prisma = new PrismaClient();
const router = express.Router();

const LINE_AUTH_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile';

// ---------- Local account (username/password) ----------

router.post(
  '/auth/register-admin',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body as {
        username?: string;
        password?: string;
      };

      // กันกรณี body ไม่มีค่า → จะไม่ไปเรียก Prisma ด้วย undefined
      if (!username || !password) {
        res.status(400).json({ error: 'username and password are required' });
        return;
      }

      const exists = await prisma.user.findUnique({ where: { username } });
      if (exists) {
        res.status(400).json({ error: 'Username exists' });
        return;
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.user.create({
        data: { username, passwordHash, role: 'admin' },
      });

      res.json({ id: user.id, username: user.username, role: user.role });
    } catch (err) {
      console.error('register-admin error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

router.post(
  '/auth/login',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body as {
        username?: string;
        password?: string;
      };

      if (!username || !password) {
        res.status(400).json({ error: 'username and password are required' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { username } });
      if (!user || !user.passwordHash) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const accessToken = signAccessToken({ userId: user.id, role: user.role });
      const refreshToken = await issueRefreshToken(user.id);
      res.json({ accessToken, refreshToken, role: user.role });
    } catch (err) {
      console.error('login error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

router.post(
  '/auth/refresh',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };
      if (!refreshToken) {
        res.status(400).json({ error: 'refreshToken required' });
        return;
      }

      const newRefresh = await rotateRefreshToken(refreshToken);
      const tokenRow = await prisma.refreshToken.findUnique({
        where: { token: newRefresh },
      });
      if (!tokenRow) {
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: tokenRow.userId } });
      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      const accessToken = signAccessToken({
        userId: user.id,
        role: user.role,
      });
      res.json({ accessToken, refreshToken: newRefresh });
    } catch (e: any) {
      console.error('refresh error', e);
      res.status(401).json({ error: e.message ?? 'Invalid refresh token' });
    }
  },
);

router.post(
  '/auth/logout',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };
      if (refreshToken) {
        await prisma.refreshToken
          .delete({ where: { token: refreshToken } })
          .catch(() => {});
      }
      res.json({ ok: true });
    } catch (err) {
      console.error('logout error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------- LINE Login (ส่วนนี้ของเดิมใช้ได้แล้ว เลยไม่แตะ) ----------
// ... ถ้าไฟล์คุณมีส่วน LINE Login ต่อด้านล่าง ให้คงไว้เหมือนเดิม ...

export default router;
