import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function isAdmin() {
  const cookieStore = cookies();
  return cookieStore.get('admin_auth')?.value === 'true';
}

export async function POST(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { class_id, subject_id, questions } = await req.json();
  if (!class_id || !subject_id || !Array.isArray(questions))
    return NextResponse.json({ error: 'class_id, subject_id and questions required' }, { status: 400 });

  const supabase = getServiceClient();
  await supabase.from('questions').delete().eq('class_id', class_id).eq('subject_id', subject_id);
  if (questions.length > 0) {
    const rows = questions.map((q: any) => ({ ...q, class_id, subject_id }));
    const { error } = await supabase.from('questions').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: questions.length });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { class_id, subject_id } = await req.json();
  if (!class_id || !subject_id)
    return NextResponse.json({ error: 'class_id and subject_id required' }, { status: 400 });
  const supabase = getServiceClient();
  const { error } = await supabase.from('questions').delete().eq('class_id', class_id).eq('subject_id', subject_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
