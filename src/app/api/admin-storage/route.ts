import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

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

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const supabase = getServiceClient();
    const { data: files } = await supabase.storage
      .from('question-images')
      .list('', { limit: 10000 });

    let totalBytes = 0;
    if (files) {
      for (const f of files) {
        totalBytes += f.metadata?.size ?? 0;
      }
    }

    return NextResponse.json({ usedMB: totalBytes / (1024 * 1024) });
  } catch {
    return NextResponse.json({ usedMB: 0 });
  }
}
