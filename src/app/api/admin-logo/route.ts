import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const LOGO_PATH = 'logos/school-logo';
const BUCKET = 'question-images';

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

// GET — return current logo URL (public, no auth needed)
export async function GET() {
  const supabase = getServiceClient();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(LOGO_PATH);
  // Check if file actually exists
  const { data: list } = await supabase.storage.from(BUCKET).list('logos');
  const exists = (list ?? []).some((f: any) => f.name === 'school-logo');
  if (!exists) return NextResponse.json({ url: null });
  return NextResponse.json({ url: data.publicUrl });
}

// POST — upload new logo
export async function POST(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getServiceClient();
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = file.type || 'image/png';

  // Remove old logo first (upsert doesn't work reliably for different content types)
  await supabase.storage.from(BUCKET).remove([LOGO_PATH]);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(LOGO_PATH, buffer, { contentType, upsert: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(LOGO_PATH);
  return NextResponse.json({ success: true, url: data.publicUrl });
}

// DELETE — remove logo
export async function DELETE() {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(BUCKET).remove([LOGO_PATH]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
