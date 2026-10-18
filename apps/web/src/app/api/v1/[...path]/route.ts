import { NextRequest, NextResponse } from 'next/server';

const API_SERVER_URL =
  process.env.API_SERVER_URL ||
  process.env.NEXT_PUBLIC_API_SERVER_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'https://nexus-rail.onrender.com';

async function proxy(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (!API_SERVER_URL) {
    return NextResponse.json(
      { success: false, error: 'API_SERVER_URL is not set. The web app does not answer API calls itself.' },
      { status: 503 }
    );
  }
  const { path } = await context.params;
  const target = `${API_SERVER_URL.replace(/\/$/, '')}/api/v1/${(path || []).join('/')}${req.nextUrl.search}`;
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!['host', 'connection', 'content-length', 'origin'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer();
  try {
    const upstream = await fetch(target, { method: req.method, headers, body, cache: 'no-store' });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'The API server is unreachable' },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
