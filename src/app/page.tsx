'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { ClassRecord, Subject } from '@/lib/supabase';

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export default function StudentLogi'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { ClassRecord, Subject } from '@/lib/supabase';

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export default function StudentLoginPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [testCode, setTestCode] = useState('');
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      const { data: classData } = await supabase.from('classes').select('*').order('name');
      const { data: subjectData } = await supabase.from('subjects').select('*').order('name');
      if (classData) setClasses(classData as ClassRecord[]);
      if (subjectData) setSubjects(subjectData as Subject[]);
    }
    fetchData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !regNo.trim() || !classId || !subjectId || !testCode.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      // ── 1. Verify student exists ───────────────────────────────────────
      const { data: students, error: studentErr } = await supabase
        .from('students')
        .select('*')
        .eq('reg_no', regNo.trim())
        .eq('class_id', classId);

      if (studentErr) throw studentErr;

      if (!students || students.length === 0) {
        setError('Student not found. Please check your registration number and class.');
        setLoading(false);
        return;
      }

      // ── 2. Find active test for class + subject ────────────────────────
      const { data: tests, error: testErr } = await supabase
        .from('tests')
        .select('*')
        .eq('is_active', true)
        .eq('class_id', classId)
        .eq('subject_id', subjectId);

      if (testErr) throw testErr;

      if (!tests || tests.length === 0) {
        setError('No active test found for your class and subject at this time.');
        setLoading(false);
        return;
      }

      const test = tests[0];

      // ── 3. Block entry before start_time ──────────────────────────────
      if (test.start_time && new Date() < new Date(test.start_time)) {
        const startStr = new Date(test.start_time).toLocaleTimeString('en-NG', {
          hour: '2-digit',
          minute: '2-digit',
        });
        setError(`This test has not started yet. It begins at ${startStr}.`);
        setLoading(false);
        return;
      }

      // ── 4. Block entry after end_time (deadline) ──────────────────────
      if (test.end_time && new Date() > new Date(test.end_time)) {
        setError('The test window has closed. Please contact your teacher.');
        setLoading(false);
        return;
      }

      // ── 5. Verify test code (only if the test has one set) ───────────────
      if (test.test_code && test.test_code.trim() !== '') {
        if (test.test_code.toUpperCase() !== testCode.trim().toUpperCase()) {
          setError('Invalid test code. Please check with your teacher.');
          setLoading(false);
          return;
        }
      }

      // ── 6. No-retake check ────────────────────────────────────────────
      const { data: existing } = await supabase
        .from('results')
        .select('id')
        .eq('test_id', test.id)
        .eq('reg_no', regNo.trim());

      if (existing && existing.length > 0) {
        setError('You have already submitted this test. Results have been recorded.');
        setLoading(false);
        return;
      }

      // ── 7. IP / Device lock ───────────────────────────────────────────
      // Retrieve or create a session token for this device
      const myToken = sessionStorage.getItem('quest_session_token') || generateToken();
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      const { data: existingSession } = await supabase
        .from('sessions')
        .select('*')
        .eq('test_id', test.id)
        .eq('reg_no', regNo.trim())
        .single();

      if (existingSession) {
        const isRecent = new Date(existingSession.last_seen) > new Date(twoMinutesAgo);
        const isSameDevice = existingSession.session_token === myToken;

        if (isRecent && !isSameDevice) {
          setError(
            'This test is already in progress on another device. Contact your teacher if this is an error.'
          );
          setLoading(false);
          return;
        }
      }

      // Register or refresh session
      await supabase.from('sessions').upsert(
        {
          test_id: test.id,
          reg_no: regNo.trim(),
          session_token: myToken,
          last_seen: new Date().toISOString(),
        },
        { onConflict: 'test_id,reg_no' }
      );

      sessionStorage.setItem('quest_session_token', myToken);

      // ── 8. Store student + test data in sessionStorage ────────────────
      const studentData = {
        reg_no: regNo.trim(),
        full_name: fullName.trim(),
        class_id: classId,
        subject_id: subjectId,
      };

      sessionStorage.setItem('quest_student', JSON.stringify(studentData));
      sessionStorage.setItem('quest_test', JSON.stringify(test));

      // Only set started_at on first entry; preserve on re-entry
      const existingStart = sessionStorage.getItem('quest_started_at');
      if (!existingStart) {
        sessionStorage.setItem('quest_started_at', new Date().toISOString());
      }

      router.push(`/test/${test.id}`);
    } catch (err: unknown) {
      console.error(err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-quest-light flex flex-col items-center justify-center px-4 py-10">
      {/* Header / branding */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-quest-navy rounded-2xl mb-4">
          <span className="text-white text-2xl font-bold">Q</span>
        </div>
        <h1 className="text-3xl font-bold text-quest-navy">Quest College CBT</h1>
        <p className="text-gray-500 mt-1">Computer Based Test Platform</p>
      </div>

      <div className="w-full max-w-md card">
        <h2 className="text-xl font-semibold text-quest-navy mb-6">Student Login</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              className="input"
              placeholder="Enter your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          {/* Registration Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Registration Number
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. QC/2024/001"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
              required
            />
          </div>

          {/* Class */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select
              className="input"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              required
            >
              <option value="">-- Select Class --</option>
              {classes.map((c: ClassRecord) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select
              className="input"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
            >
              <option value="">-- Select Subject --</option>
              {subjects.map((s: Subject) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Test Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Code</label>
            <input
              type="text"
              className="input font-mono tracking-widest uppercase"
              placeholder="Enter test code"
              value={testCode}
              onChange={(e) => setTestCode(e.target.value.toUpperCase())}
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Ask your teacher for the test code before starting.
            </p>
          </div>

          <button
            type="submit"
            className="btn-primary w-full mt-2"
            disabled={loading}
          >
            {loading ? 'Verifying...' : 'Start Test'}
          </button>
        </form>
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        &copy; {new Date().getFullYear()} Quest College. All rights reserved.
        <br />
        <span className="text-gray-300">Developed by Adekunle Temitope Olamilekan</span>
      </p>
    </div>
  );
}
