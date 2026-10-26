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

// DELETE /api/admin-results
export async function DELETE(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, ids } = await req.json();
  const supabase = getServiceClient();

  if (ids && Array.isArray(ids)) {
    const { error } = await supabase.from('results').delete().in('id', ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (id) {
    const { error } = await supabase.from('results').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'id or ids required' }, { status: 400 });
}
