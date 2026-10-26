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

  let totalBytes = 0;
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage
      .from('question-images')
      .list('', { limit, offset });

    if (error || !data) break;
    for (const file of data) {
      totalBytes += file.metadata?.size ?? 0;
    }
    if (data.length < limit) break;
    offset += limit;
  }

  const usedMB = totalBytes / (1024 * 1024);
  return NextResponse.json({ usedMB: parseFloat(usedMB.toFixed(2)) });
}
