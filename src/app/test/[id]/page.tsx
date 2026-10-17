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
}

export default function TestPage() {
  const router = useRouter();
  const params = useParams();
  const testId = params.id as string;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [testData, setTestData] = useState<TestData | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [showStartWarning, setShowStartWarning] = useState(true);
  const warningCountRef = useRef(0);
  const submitted = useRef(false);

  const handleSubmit = useCallback(
    async (forced: boolean = false) => {
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
        return;
      }

      router.push(`/result/${data.id}`);
    },
    [studentData, testData, questions, answers, router]
  );

  useEffect(() => {
    const raw = sessionStorage.getItem('quest_student');
    const rawTest = sessionStorage.getItem('quest_test');
    if (!raw || !rawTest) { router.push('/'); return; }
    const sd: StudentData = JSON.parse(raw);
    const td: TestData = JSON.parse(rawTest);
    setStudentData(sd);
    setTestData(td);

    async function loadQuestions() {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('class_id', sd.class_id)
        .eq('subject_id', sd.subject_id);

      if (error || !data) { alert('Failed to load questions.'); router.push('/'); return; }

      const shuffled = shuffleArray(data as Question[]).slice(0, td.total_questions);
      setQuestions(shuffled);
      setTimeLeft(td.duration_minutes * 60);
      setLoading(false);
    }

    loadQuestions();
  }, [router]);

  // Anti-cheat: tab/focus detection
  useEffect(() => {
    if (loading || showStartWarning) return;

    function handleVisibilityChange() {
      if (document.hidden) {
        warningCountRef.current += 1;
        setWarningCount(warningCountRef.current);
        if (warningCountRef.current >= 2) { handleSubmit(true); }
        else { setShowWarning(true); }
      }
    }

    function handleBlur() {
      if (!document.hidden) {
        warningCountRef.current += 1;
        setWarningCount(warningCountRef.current);
        if (warningCountRef.current >= 2) { handleSubmit(true); }
        else { setShowWarning(true); }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [loading, showStartWarning, handleSubmit]);

  // Anti-cheat: block right-click, copy, paste
  useEffect(() => {
    function blockContextMenu(e: MouseEvent) { e.preventDefault(); }
    function blockCopy(e: ClipboardEvent) { e.preventDefault(); }
    function blockPaste(e: ClipboardEvent) { e.preventDefault(); }
    document.addEventListener('contextmenu', blockContextMenu);
    document.addEventListener('copy', blockCopy);
    document.addEventListener('paste', blockPaste);
    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('paste', blockPaste);
    };
  }, []);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0 || loading || showStartWarning) return;
    const interval = setInterval(() => {
      setTimeLeft((prev: number) => {
        if (prev <= 1) { clearInterval(interval); handleSubmit(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft, loading, showStartWarning, handleSubmit]);

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function selectAnswer(option: string) {
    setAnswers((prev: Record<number, string>) => ({ ...prev, [current]: option }));
  }

  // Start warning screen
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
            <li>✅ Ensure you are ready before proceeding</li>
          </ul>
          <button
            onClick={() => setShowStartWarning(false)}
            className="btn-primary w-full"
          >
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
  const options: Array<{ key: string; label: string; text: string }> = [
    { key: 'A', label: 'A', text: q.option_a },
    { key: 'B', label: 'B', text: q.option_b },
    { key: 'C', label: 'C', text: q.option_c },
    { key: 'D', label: 'D', text: q.option_d },
  ];

  const answeredCount = Object.keys(answers).length;
  const isTimeLow = timeLeft < 60;

  return (
    <div className="min-h-screen bg-quest-light" style={{ userSelect: 'none' }}>

      {/* Warning overlay */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="text-4xl mb-3">🚨</div>
            <h2 className="text-xl font-bold text-red-600 mb-2">Warning!</h2>
            <p className="text-gray-600 text-sm mb-4">
              You left the test window. <strong>One more time and your test will be automatically submitted.</strong>
            </p>
            <button
              onClick={() => setShowWarning(false)}
              className="btn-primary w-full bg-red-600 hover:bg-red-700"
            >
              Return to Test
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
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
        {/* Progress */}
        <div className="flex items-center justify-between mb-4 text-sm text-gray-500">
          <span>Question {current + 1} of {questions.length}</span>
          <span>{answeredCount} answered</span>
        </div>
        <div className="w-full bg-blue-100 rounded-full h-2 mb-6">
          <div className="bg-quest-blue h-2 rounded-full transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
        </div>

        {/* Question */}
        <div className="card mb-5">
          <p className="text-quest-navy font-semibold text-base leading-relaxed">
            {current + 1}. {q.question_text}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">
          {options.map((opt: { key: string; label: string; text: string }) => {
            const selected = answers[current] === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => selectAnswer(opt.key)}
                className={`w-full text-left px-5 py-4 rounded-xl border-2 font-medium transition-all ${
                  selected
                    ? 'bg-quest-blue border-quest-blue text-white'
                    : 'bg-white border-blue-100 text-gray-800 hover:border-quest-blue hover:bg-quest-light'
                }`}
              >
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold mr-3 ${selected ? 'bg-white text-quest-blue' : 'bg-quest-light text-quest-navy'}`}>
                  {opt.label}
                </span>
                {opt.text}
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setCurrent((p: number) => Math.max(0, p - 1))}
            disabled={current === 0}
            className="btn-secondary flex-1"
          >
            Previous
          </button>
          {current < questions.length - 1 ? (
            <button onClick={() => setCurrent((p: number) => Math.min(questions.length - 1, p + 1))} className="btn-primary flex-1">
              Next
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="flex-1 bg-quest-accent text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-yellow-500 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Test'}
            </button>
          )}
        </div>

        {/* Question grid */}
        <div className="mt-6 card">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Question Navigator</p>
          <div className="flex flex-wrap gap-2">
            {questions.map((_: Question, idx: number) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                  idx === current ? 'bg-quest-navy text-white' : answers[idx] ? 'bg-quest-blue text-white' : 'bg-blue-50 text-gray-500 hover:bg-blue-100'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-gray-300 pt-6 pb-2">
          Developed by Adekunle Temitope Olamilekan
        </p>
      </div>
    </div>
  );
}
