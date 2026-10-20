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
  const { students } = await req.json();
  if (!Array.isArray(students) || students.length === 0)
    return NextResponse.json({ error: 'No students provided' }, { status: 400 });

  const supabase = getServiceClient();
  const { error } = await supabase.from('students').upsert(students, { onConflict: 'reg_no' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: students.length });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, reg_no, class_id } = await req.json();
  const supabase = getServiceClient();

  if (class_id) {
    const { data: students } = await supabase.from('students').select('reg_no').eq('class_id', class_id);
    if (students && students.length > 0) {
      const regNos = students.map((s: any) => s.reg_no);
      await supabase.from('results').delete().in('reg_no', regNos);
    }
    const { error } = await supabase.from('students').delete().eq('class_id', class_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (id && reg_no) {
    await supabase.from('results').delete().eq('reg_no', reg_no);
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'id+reg_no or class_id required' }, { status: 400 });
}
