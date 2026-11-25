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

export async function GET(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getServiceClient();
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('class_id');
  let query = supabase.from('students').select('*, classes(name)').order('full_name');
  if (classId) query = query.eq('class_id', classId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students: data });
}

export async function POST(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getServiceClient();
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await req.json();

    // Bulk JSON array (from client-side Excel parse)
    if (Array.isArray(body.students)) {
      const { error } = await supabase
        .from('students')
        .upsert(body.students, { onConflict: 'reg_no', ignoreDuplicates: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, count: body.students.length });
    }

    // Single student manual add
    const { reg_no, full_name, class_id } = body;
    if (!reg_no?.trim() || !full_name?.trim() || !class_id) {
      return NextResponse.json({ error: 'reg_no, full_name and class_id are required' }, { status: 400 });
    }
    const { error } = await supabase.from('students').insert({
      reg_no: reg_no.trim().toUpperCase(),
      full_name: full_name.trim(),
      class_id,
    });
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `Registration number "${reg_no.trim().toUpperCase()}" already exists` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: 'Student added successfully' });
  }

  return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getServiceClient();
  const body = await req.json();

  // Delete all students in a class
  if (body.class_id) {
    const { error } = await supabase.from('students').delete().eq('class_id', body.class_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Delete single student by id
  if (body.id) {
    const { error } = await supabase.from('students').delete().eq('id', body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Missing id or class_id' }, { status: 400 });
}
