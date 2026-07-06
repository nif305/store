import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest) {
  const secret = process.env.KEEP_ALIVE_SECRET;
  if (!secret) return true;

  const headerSecret = request.headers.get('x-keep-alive-secret');
  const querySecret = request.nextUrl.searchParams.get('secret');

  return headerSecret === secret || querySecret === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await prisma.$queryRaw`SELECT 1`;

  return NextResponse.json({ ok: true, checkedAt: new Date().toISOString() });
}
