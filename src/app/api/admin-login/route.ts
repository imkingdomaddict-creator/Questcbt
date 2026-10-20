import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = 'QuestAdmin2024!';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password } = body;

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_auth', 'true', {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 8,
    sameSite: 'lax',
  });

  return response;
}
