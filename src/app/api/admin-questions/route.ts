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

// POST: save questions to DB
export async function POST(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getServiceClient();
  const body = await req.json();
  const { class_id, subject_id, questions } = body;

  if (!class_id || !subject_id || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  await supabase.from('questions').delete().eq('class_id', class_id).eq('subject_id', subject_id);

  const inserts = questions.map((q: any) => ({
    class_id,
    subject_id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_option: q.correct_option,
    image_url: q.image_url || null,
  }));

  const { error } = await supabase.from('questions').insert(inserts);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ count: inserts.length });
}

// DELETE: delete all questions for class+subject
export async function DELETE(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = getServiceClient();
  const body = await req.json();
  const { class_id, subject_id } = body;

  if (!class_id || !subject_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const { data: qData } = await supabase
    .from('questions')
    .select('image_url')
    .eq('class_id', class_id)
    .eq('subject_id', subject_id);

  if (qData) {
    const paths = qData
      .map((q: any) => q.image_url)
      .filter(Boolean)
      .map((url: string) => {
        const parts = url.split('/question-images/');
        return parts.length > 1 ? parts[1] : null;
      })
      .filter(Boolean);

    if (paths.length > 0) {
      await supabase.storage.from('question-images').remove(paths);
    }
  }

  const { error } = await supabase
    .from('questions')
    .delete()
    .eq('class_id', class_id)
    .eq('subject_id', subject_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
