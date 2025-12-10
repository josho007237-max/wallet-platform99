import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ACCESS_TTL = '15m';
const REFRESH_TTL_SEC = 60 * 60 * 24 * 7;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: { userId: number; role: string }) {
  const secret = process.env.JWT_ACCESS_SECRET!;
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TTL });
}

export async function issueRefreshToken(userId: number) {
  const token = cryptoRandom();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
  await prisma.refreshToken.create({ data: { userId, token, expiresAt } });
  return token;
}

export async function rotateRefreshToken(oldToken: string) {
  const found = await prisma.refreshToken.findUnique({ where: { token: oldToken } });
  if (!found || found.expiresAt < new Date()) throw new Error('Invalid refresh token');
  await prisma.refreshToken.delete({ where: { token: oldToken } });
  return issueRefreshToken(found.userId);
}

function cryptoRandom() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
