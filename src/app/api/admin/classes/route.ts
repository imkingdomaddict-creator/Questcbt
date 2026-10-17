import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

function isAdmin() {
  const cookieStore = cookies();
  const cookie = cookieStore.get('quest_admin');
  return cookie?.value === 'ok';
}

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('classes').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { data, error } = await supabaseAdmin.from('classes').insert([body]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from('classes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
