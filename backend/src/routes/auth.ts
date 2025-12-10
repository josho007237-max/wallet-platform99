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

router.post('/auth/register-admin', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) return res.status(400).json({ error: 'Username exists' });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { username, passwordHash, role: 'admin' },
  });

  res.json({ id: user.id, username: user.username, role: user.role });
});

router.post('/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);

  res.json({ accessToken, refreshToken, role: user.role });
});

router.post('/auth/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken: string };

  try {
    const newRefresh = await rotateRefreshToken(refreshToken);
    const tokenRow = await prisma.refreshToken.findUnique({
      where: { token: newRefresh },
    });
    if (!tokenRow) {
      return res.status(401).json({ error: 'Refresh token not found' });
    }

    const user = await prisma.user.findUnique({ where: { id: tokenRow.userId } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const accessToken = signAccessToken({
      userId: user.id,
      role: user.role,
    });

    res.json({ accessToken, refreshToken: newRefresh });
  } catch (e: any) {
    res.status(401).json({ error: e.message || 'Invalid refresh token' });
  }
});

router.post('/auth/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (refreshToken) {
    await prisma.refreshToken
      .delete({ where: { token: refreshToken } })
      .catch(() => {});
  }

  res.json({ ok: true });
});

// ---------- LINE Login ----------

// Redirect ไปหน้า LINE Login
router.get('/auth/line', (req: Request, res: Response) => {
  const clientId = process.env.LINE_CHANNEL_ID!;
  const callbackUrl = process.env.LINE_CALLBACK_URL!;
  const state = 'dev-state'; // TODO: เก็บ/ตรวจ state ให้ปลอดภัยในโปรดักชัน

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callbackUrl,
    state,
    scope: 'profile openid',
  });

  res.redirect(`${LINE_AUTH_URL}?${params.toString()}`);
});

// Callback จาก LINE
router.get('/auth/line/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query as { code?: string; error?: string };

  if (error) return res.status(400).send(`LINE error: ${error}`);
  if (!code) return res.status(400).send('Missing code');

  const clientId = process.env.LINE_CHANNEL_ID!;
  const clientSecret = process.env.LINE_CHANNEL_SECRET!;
  const callbackUrl = process.env.LINE_CALLBACK_URL!;

  // 1) ขอ access_token จาก LINE
  const tokenResp = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  const tokenJson: any = await tokenResp.json();
  if (!tokenResp.ok) {
    console.error('LINE token error', tokenJson);
    return res.status(400).send('Failed to get LINE token');
  }

  const accessTokenLine = tokenJson.access_token as string;

  // 2) ดึงโปรไฟล์ผู้ใช้จาก LINE
  const profileResp = await fetch(LINE_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessTokenLine}` },
  });
  const profile: any = await profileResp.json();

  if (!profile.userId) {
    console.error('LINE profile error', profile);
    return res.status(400).send('Failed to get LINE profile');
  }

  // 3) ผูกกับ User ในระบบ (upsert)
  let user = await prisma.user.findUnique({
    where: { lineId: profile.userId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        lineId: profile.userId,
        displayName: profile.displayName,
        avatarUrl: profile.pictureUrl,
        role: 'user',
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName: profile.displayName,
        avatarUrl: profile.pictureUrl,
      },
    });
  }

  // 4) ออก JWT + refresh token ของระบบเรา
  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);

  const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:5173';
  const redirectUrl = new URL(webAppUrl);
  redirectUrl.searchParams.set('accessToken', accessToken);
  redirectUrl.searchParams.set('refreshToken', refreshToken);

  res.redirect(redirectUrl.toString());
});

export default router;
