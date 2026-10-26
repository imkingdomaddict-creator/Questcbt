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

// POST /api/admin-tests  — create or update a test
export async function POST(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, ...payload } = await req.json();
  const supabase = getServiceClient();

  if (id) {
    const { error } = await supabase.from('tests').update(payload).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'updated' });
  } else {
    const { error } = await supabase.from('tests').insert([{ ...payload, is_active: true }]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, action: 'created' });
  }
}

// PATCH /api/admin-tests  — toggle is_active (and extend window if needed)
export async function PATCH(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, is_active, end_time } = await req.json();
  const supabase = getServiceClient();

  let update: any = { is_active };
  if (is_active) {
    const end = end_time ? new Date(end_time) : null;
    if (!end || end < new Date()) {
      update.start_time = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      update.end_time = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    }
  }

  const { error } = await supabase.from('tests').update(update).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, update });
}

// DELETE /api/admin-tests  — delete test + all its results
export async function DELETE(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const supabase = getServiceClient();

  await supabase.from('results').delete().eq('test_id', id);
  await supabase.from('drafts').delete().eq('test_id', id);
  await supabase.from('sessions').delete().eq('test_id', id);
  const { error } = await supabase.from('tests').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
