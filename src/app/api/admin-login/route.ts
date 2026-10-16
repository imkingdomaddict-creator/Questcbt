import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { password } = await request.json()

  if (password === 'QuestAdmin2024!') {
    const response = NextResponse.json({ success: true })
    response.cookies.set('quest_admin', 'ok', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24,
      path: '/',
    })
    return response
  }

  return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
}
