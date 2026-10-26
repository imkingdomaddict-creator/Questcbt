import { NextResponse } from 'next/server';

export async function GET() {
  const response = NextResponse.redirect(
    new URL('/admin/login', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
  );
  response.cookies.set('admin_auth', '', { httpOnly: true, path: '/', maxAge: 0 });
  response.cookies.set('quest_admin', '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_auth', '', { httpOnly: true, path: '/', maxAge: 0 });
  response.cookies.set('quest_admin', '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
