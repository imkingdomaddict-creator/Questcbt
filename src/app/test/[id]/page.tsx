'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Question } from '@/lib/supabase';
import { shuffleArray } from '@/lib/utils';

interface StudentData {
  reg_no: string;
  full_name: string;
  class_id: string;
  subject_id: string;
}

interface TestData {
  id: string;
  title: string;
  class_id: string;
  subject_id: string;
  test_type: string;
  duration_minutes: number;
  total_questions: number;
  end_time?: string;
}

export default function TestPage() {
  const router = useRouter();
  const params = useParams();
  const testId = params.id as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [testData, setTestData] = useState<TestData | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [showStartWarning, setShowStartWarning] = useState(true);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [expired, setExpired] = useState(false);

  const timeWarningShown = useRef(false);
  const warningCountRef = useRef(0);
  const submitted = useRef(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionIdsRef = useRef<string[]>([]);

  // ── Save draft ─────────────────────────────────────────────────────────
  const saveDraft = useCallback(async (
    currentAnswers: Record<number, string>,
    currentFlagged: Set<number>,
    sd: StudentData,
    td: TestData,
    qIds: string[]
  ) => {
    if (!sd || !td || qIds.length === 0) return;
    await supabase.from('drafts').upsert({
      test_id: td.id,
      reg_no: sd.reg_no,
      answers: currentAnswers,
      question_ids: qIds,
      flagged: Array.from(currentFlagged),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'test_id,reg_no' });
  }, []);

  // ── Ping session every 30s ─────────────────────────────────────────────
  const pingSession = useCallback(async (sd: StudentData, td: TestData) => {
    const token = sessionStorage.getItem('quest_session_token');
    if (!token) return;
    await supabase.from('sessions').upsert({
      test_id: td.id,
      reg_no: sd.reg_no,
      session_token: token,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'test_id,reg_no' });
  }, []);

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (forced: boolean = false) => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);

    const sd = studentData;
    const td = testData;
    if (!sd || !td || questions.length === 0) return;

    let score = 0;
    questions.forEach((q: Question, idx: number) => {
      if (answers[idx] === q.correct_option) score++;
    });

    const total = questions.length;
    const percentage = Math.round((score / total) * 100);

    const { data, error } = await supabase
      .from('results')
      .insert([{
        test_id: td.id,
        reg_no: sd.reg_no,
        student_name: sd.full_name,
        class_id: sd.class_id,
        subject_id: sd.subject_id,
        test_type: td.test_type,
        score,
        total,
        percentage,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error saving result:', error);
      alert('Error saving result. Please contact admin.');
      submitted.current = false;
      setSubmitting(false);
      return;
    }

    // Clean up draft AND session on submit
    await Promise.all([
      supabase.from('drafts').delete().eq('test_id', td.id).eq('reg_no', sd.reg_no),
      supabase.from('sessions').delete().eq('test_id', td.id).eq('reg_no', sd.reg_no),
    ]);
    sessionStorage.removeItem('quest_session_token');
    sessionStorage.removeItem('quest_started_at');

    router.push(`/result/${data.id}`);
  }, [studentData, testData, questions, answers, router]);

  // ── Load questions + restore draft ────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem('quest_student');
    const rawTest = sessionStorage.getItem('quest_test');
    const startedAt = sessionStorage.getItem('quest_started_at') || new Date().toISOString();
    if (!raw || !rawTest) { router.push('/'); return; }

    const sd: StudentData = JSON.parse(raw);
    const td: TestData = JSON.parse(rawTest);
    setStudentData(sd);
    setTestData(td);
    sessionStorage.setItem('quest_started_at', startedAt);

    if (td.end_time && new Date() > new Date(td.end_time)) {
      setExpired(true); setLoading(false); return;
    }

    const elapsedSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const totalSeconds = td.duration_minutes * 60;
    const remaining = Math.max(0, totalSeconds - elapsedSeconds);

    if (remaining === 0) { setExpired(true); setLoading(false); return; }

    async function loadQuestions() {
      const { data: draft } = await supabase
        .from('drafts').select('*')
        .eq('test_id', td.id).eq('reg_no', sd.reg_no).single();

      let shuffled: Question[];

      if (draft && draft.question_ids?.length > 0) {
        const { data: allQ } = await supabase
          .from('questions').select('*')
          .eq('class_id', sd.class_id).eq('subject_id', sd.subject_id);

        const qMap: Record<string, Question> = {};
        (allQ || []).forEach((q: Question) => { qMap[q.id] = q; });
        shuffled = draft.question_ids.map((id: string) => qMap[id]).filter(Boolean) as Question[];

        if (draft.answers) setAnswers(draft.answers);
        if (draft.flagged) setFlagged(new Set(draft.flagged));
      } else {
        const { data, error } = await supabase
          .from('questions').select('*')
          .eq('class_id', sd.class_id).eq('subject_id', sd.subject_id);

        if (error || !data) { alert('Failed to load questions.'); router.push('/'); return; }
        shuffled = shuffleArray(data as Question[]).slice(0, td.total_questions);
      }

      questionIdsRef.current = shuffled.map((q: Question) => q.id);
      setQuestions(shuffled);
      setTimeLeft(remaining);
      if (remaining <= 60) timeWarningShown.current = true;
      setLoading(false);
    }

    loadQuestions();
  }, [router]);

  // ── Session ping every 30s ─────────────────────────────────────────────
  useEffect(() => {
    if (!studentData || !testData || loading || showStartWarning) return;
    const interval = setInterval(() => {
      pingSession(studentData, testData);
    }, 30000);
    return () => clearInterval(interval);
  }, [studentData, testData, loading, showStartWarning, pingSession]);

  // ── Anti-cheat: tab/focus ──────────────────────────────────────────────
  useEffect(() => {
    if (loading || showStartWarning) return;
    function handleVisibilityChange() {
      if (document.hidden) {
        warningCountRef.current += 1;
        if (warningCountRef.current >= 2) handleSubmit(true);
        else setShowWarning(true);
      }
    }
    function handleBlur() {
      if (!document.hidden) {
        warningCountRef.current += 1;
        if (warningCountRef.current >= 2) handleSubmit(true);
        else setShowWarning(true);
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [loading, showStartWarning, handleSubmit]);

  // ── Anti-cheat: block right-click/copy/paste ───────────────────────────
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', block);
    document.addEventListener('copy', block);
    document.addEventListener('paste', block);
    return () => {
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('copy', block);
      document.removeEventListener('paste', block);
    };
  }, []);

  // ── Timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft <= 0 || loading || showStartWarning) return;
    const interval = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev === 60 && !timeWarningShown.current) {
          timeWarningShown.current = true;
          setShowTimeWarning(true);
        }
        if (prev <= 1) { clearInterval(interval); handleSubmit(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, loading, showStartWarning, handleSubmit]);

  // ── Auto-save on answer/flag change ───────────────────────────────────
  useEffect(() => {
    if (!studentData || !testData || questionIdsRef.current.length === 0) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      saveDraft(answers, flagged, studentData, testData, questionIdsRef.current);
    }, 1500);
    return () => { if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current); };
  }, [answers, flagged, studentData, testData, saveDraft]);

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function selectAnswer(option: string) {
    setAnswers((prev) => ({ ...prev, [current]: option }));
  }

  function toggleFlag(idx: number) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-quest-navy flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">⏰</div>
          <h2 className="text-xl font-bold text-red-600 mb-3">Test Window Closed</h2>
          <p className="text-gray-600 text-sm mb-6">
            The time allocated for this test has expired. Please contact your teacher.
          </p>
          <button onClick={() => router.push('/')} className="btn-primary w-full">Return to Login</button>
        </div>
      </div>
    );
  }

  if (showStartWarning) {
    return (
      <div className="min-h-screen bg-quest-navy flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-quest-navy mb-3">Important Notice</h2>
          <ul className="text-sm text-gray-600 text-left space-y-2 mb-6">
            <li>🔒 Do <strong>not</strong> switch tabs or minimize this window</li>
            <li>📵 Do <strong>not</strong> press the home button</li>
            <li>⏱️ The timer starts immediately when you click Begin</li>
            <li>⚠️ First offence: a warning. Second offence: test auto-submits</li>
            <li>🚩 Flag questions to review them before submitting</li>
            <li>💾 Your answers are saved automatically as you go</li>
            <li>✅ Ensure you are ready before proceeding</li>
          </ul>
          <button onClick={() => setShowStartWarning(false)} className="btn-primary w-full">
            I Understand — Begin Test
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-quest-light flex items-center justify-center">
        <div className="text-quest-navy text-lg font-medium">Loading questions...</div>
      </div>
    );
  }

  const q = questions[current];
  const options = [
    { key: 'A', text: q.option_a },
    { key: 'B', text: q.option_b },
    { key: 'C', text: q.option_c },
    { key: 'D', text: q.option_d },
  ];
  const answeredCount = Object.keys(answers).length;
  const flaggedCount = flagged.size;
  const isTimeLow = timeLeft <= 60;
  const isFlagged = flagged.has(current);

  return (
    <div className="min-h-screen bg-quest-light" style={{ userSelect: 'none' }}>

      {showWarning && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="text-4xl mb-3">🚨</div>
            <h2 className="text-xl font-bold text-red-600 mb-2">Warning!</h2>
            <p className="text-gray-600 text-sm mb-4">
              You left the test window. <strong>One more time and your test will be automatically submitted.</strong>
            </p>
            <button onClick={() => setShowWarning(false)} className="btn-primary w-full bg-red-600 hover:bg-red-700">
              Return to Test
            </button>
          </div>
        </div>
      )}

      {showTimeWarning && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="text-5xl mb-3">⏰</div>
            <h2 className="text-xl font-bold text-quest-accent mb-2">1 Minute Left!</h2>
            <p className="text-gray-600 text-sm mb-2">You have <strong>60 seconds</strong> remaining.</p>
            <p className="text-gray-500 text-xs mb-5">
              Answered: {answeredCount} of {questions.length} &nbsp;|&nbsp; Flagged: {flaggedCount}
            </p>
            <button onClick={() => setShowTimeWarning(false)} className="btn-primary w-full">
              Continue Test
            </button>
          </div>
        </div>
      )}

      <div className="bg-quest-navy text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="font-bold text-sm">{testData?.title}</p>
          <p className="text-xs text-blue-200">{studentData?.full_name} &mdash; {studentData?.reg_no}</p>
        </div>
        <div className={`font-mono text-xl font-bold px-3 py-1 rounded-lg ${isTimeLow ? 'bg-red-500 animate-pulse' : 'bg-quest-blue'}`}>
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
          <span>Question {current + 1} of {questions.length}</span>
          <span>{answeredCount} answered {flaggedCount > 0 && `· ${flaggedCount} flagged`}</span>
        </div>
        <div className="w-full bg-blue-100 rounded-full h-2 mb-6">
          <div className="bg-quest-blue h-2 rounded-full transition-all"
            style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
        </div>

        <div className={`card mb-5 ${isFlagged ? 'border-2 border-amber-400' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-quest-navy font-semibold text-base leading-relaxed flex-1">
              {current + 1}. {q.question_text}
            </p>
            <button
              onClick={() => toggleFlag(current)}
              title={isFlagged ? 'Remove flag' : 'Flag for review'}
              className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                isFlagged
                  ? 'bg-amber-400 border-amber-400 text-white'
                  : 'bg-white border-gray-200 text-gray-400 hover:border-amber-400 hover:text-amber-500'
              }`}
            >
              🚩 {isFlagged ? 'Flagged' : 'Flag'}
            </button>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {options.map((opt) => {
            const selected = answers[current] === opt.key;
            return (
              <button key={opt.key} onClick={() => selectAnswer(opt.key)}
                className={`w-full text-left px-5 py-4 rounded-xl border-2 font-medium transition-all ${
                  selected
                    ? 'bg-quest-blue border-quest-blue text-white'
                    : 'bg-white border-blue-100 text-gray-800 hover:border-quest-blue hover:bg-quest-light'
                }`}>
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold mr-3 ${
                  selected ? 'bg-white text-quest-blue' : 'bg-quest-light text-quest-navy'
                }`}>{opt.key}</span>
                {opt.text}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setCurrent((p) => Math.max(0, p - 1))}
            disabled={current === 0} className="btn-secondary flex-1">
            Previous
          </button>
          {current < questions.length - 1 ? (
            <button onClick={() => setCurrent((p) => Math.min(questions.length - 1, p + 1))}
              className="btn-primary flex-1">Next</button>
          ) : (
            <button onClick={() => handleSubmit(false)} disabled={submitting}
              className="flex-1 bg-quest-accent text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Test'}
            </button>
          )}
        </div>

        <div className="mt-6 card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Question Navigator</p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-quest-blue inline-block" /> Answered</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Flagged</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {questions.map((_: Question, idx: number) => {
              const isAnswered = !!answers[idx];
              const isFlaggedIdx = flagged.has(idx);
              const isCurrent = idx === current;
              return (
                <button key={idx} onClick={() => setCurrent(idx)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all relative ${
                    isCurrent ? 'bg-quest-navy text-white ring-2 ring-quest-navy ring-offset-1'
                    : isFlaggedIdx ? 'bg-amber-400 text-white'
                    : isAnswered ? 'bg-quest-blue text-white'
                    : 'bg-blue-50 text-gray-500 hover:bg-blue-100'
                  }`}>
                  {idx + 1}
                </button>
              );
            })}
          </div>
          {flaggedCount > 0 && (
            <p className="text-xs text-amber-600 mt-3 font-medium">
              🚩 {flaggedCount} question{flaggedCount > 1 ? 's' : ''} flagged for review — remember to revisit before submitting.
            </p>
          )}
        </div>

        <p className="text-center text-xs text-gray-300 pt-6 pb-2">
          Developed by Adekunle Temitope Olamilekan
        </p>
      </div>
    </div>
  );
}
