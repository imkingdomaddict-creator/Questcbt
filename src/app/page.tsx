'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { ClassRecord, Subject, Test } from '@/lib/supabase';

function generateToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function typeColor(t: string) {
  const l = t.toLowerCase();
  if (l.includes('exam')) return 'bg-orange-100 text-orange-700 border border-orange-200';
  if (l.includes('ca')) return 'bg-blue-100 text-blue-700 border border-blue-200';
  return 'bg-gray-100 text-gray-600 border border-gray-200';
}

export default function StudentLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'login' | 'select-test'>('login');
  const [fullName, setFullName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTests, setActiveTests] = useState<Test[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [testCode, setTestCode] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  useEffect(() => {
    supabase.from('classes').select('*').order('name')
      .then(({ data }) => { if (data) setClasses(data as ClassRecord[]); });
    supabase.from('subjects').select('*').order('name')
      .then(({ data }) => { if (data) setSubjects(data as Subject[]); });
  }, []);

  function getSubjectName(id: string) {
    return subjects.find(s => s.id === id)?.name ?? id;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !regNo.trim() || !classId) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      const { data: students, error: sErr } = await supabase
        .from('students')
        .select('*')
        .eq('reg_no', regNo.trim())
        .eq('class_id', classId);
      if (sErr) throw sErr;
      if (!students || students.length === 0) {
        setError('Student not found. Check your registration number and class.');
        setLoading(false);
        return;
      }
      const { data: tests, error: tErr } = await supabase
        .from('tests')
        .select('*')
        .eq('is_active', true)
        .eq('class_id', classId)
        .order('test_type');
      if (tErr) throw tErr;
      if (!tests || tests.length === 0) {
        setError('No active tests for your class right now. Check back later.');
        setLoading(false);
        return;
      }
      const now = new Date();
      const validTests = (tests as Test[]).filter(t => {
        if (t.start_time && now < new Date(t.start_time)) return false;
        if (t.end_time && now > new Date(t.end_time)) return false;
        return true;
      });
      if (validTests.length === 0) {
        setError('No tests are currently open. The window may have closed or not started yet.');
        setLoading(false);
        return;
      }
      const { data: doneResults } = await supabase
        .from('results')
        .select('test_id')
        .eq('reg_no', regNo.trim());
      const doneIds = new Set((doneResults || []).map((r: any) => r.test_id));
      const availTests = validTests.filter(t => !doneIds.has(t.id));
      if (availTests.length === 0) {
        setError('You have already completed all available tests for your class.');
        setLoading(false);
        return;
      }
      setActiveTests(availTests);
      setStep('select-test');
    } catch (ex) {
      console.error(ex);
      setError('An error occurred. Please try again.');
    }
    setLoading(false);
  }

  async function handleStartTest() {
    if (!selectedTest) return;
    setStartError(''); setStarting(true);
    const now = new Date();
    if (selectedTest.end_time && now > new Date(selectedTest.end_time)) {
      setStartError('The test window has closed.');
      setStarting(false);
      return;
    }
    if ((selectedTest as any).test_code && (selectedTest as any).test_code.trim() !== '') {
      if ((selectedTest as any).test_code.toUpperCase() !== testCode.trim().toUpperCase()) {
        setStartError('Invalid test code. Check with your teacher.');
        setStarting(false);
        return;
      }
    }
    const { data: existing } = await supabase
      .from('results')
      .select('id')
      .eq('test_id', selectedTest.id)
      .eq('reg_no', regNo.trim());
    if (existing && existing.length > 0) {
      setStartError('You have already submitted this test.');
      setStarting(false);
      return;
    }
    const myToken = sessionStorage.getItem('quest_session_token') || generateToken();
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: existingSession } = await supabase
      .from('sessions')
      .select('*')
      .eq('test_id', selectedTest.id)
      .eq('reg_no', regNo.trim())
      .single();
    if (existingSession) {
      const isRecent = new Date(existingSession.last_seen) > new Date(twoMinsAgo);
      const isSame = existingSession.session_token === myToken;
      if (isRecent && !isSame) {
        setStartError('This test is already open on another device. Contact your teacher if this is wrong.');
        setStarting(false);
        return;
      }
    }
    await supabase.from('sessions').upsert({
      test_id: selectedTest.id, reg_no: regNo.trim(),
      session_token: myToken, last_seen: new Date().toISOString(),
    }, { onConflict: 'test_id,reg_no' });
    sessionStorage.setItem('quest_session_token', myToken);
    sessionStorage.setItem('quest_student', JSON.stringify({ reg_no: regNo.trim(), full_name: fullName.trim(), class_id: classId, subject_id: selectedTest.subject_id }));
    sessionStorage.setItem('quest_test', JSON.stringify(selectedTest));
    if (!sessionStorage.getItem('quest_started_at')) {
      sessionStorage.setItem('quest_started_at', new Date().toISOString());
    }
    router.push(`/test/${selectedTest.id}`);
  }

  const testsBySubject: Record<string, Test[]> = {};
  activeTests.forEach(t => {
    if (!testsBySubject[t.subject_id]) testsBySubject[t.subject_id] = [];
    testsBySubject[t.subject_id].push(t);
  });

  return (
    <div className="min-h-screen bg-quest-light flex flex-col items-center justify-center px-4 py-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-quest-navy rounded-2xl mb-4">
          <span className="text-white text-2xl font-bold">Q</span>
        </div>
        <h1 className="text-3xl font-bold text-quest-navy">Quest College CBT</h1>
        <p className="text-gray-500 mt-1">Computer Based Test Platform</p>
      </div>

      {step === 'login' && (
        <div className="w-full max-w-md card">
          <h2 className="text-xl font-semibold text-quest-navy mb-6">Student Login</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" className="input" placeholder="Enter your full name" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
              <input type="text" className="input" placeholder="e.g. QC/2024/001" value={regNo} onChange={e => setRegNo(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <select className="input" value={classId} onChange={e => setClassId(e.target.value)} required>
                <option value="">-- Select Class --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading ? 'Verifying...' : 'Continue →'}
            </button>
          </form>
        </div>
      )}

      {step === 'select-test' && (
        <div className="w-full max-w-lg">
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-xl font-semibold text-quest-navy">Choose Your Test</h2>
              <button onClick={() => { setStep('login'); setSelectedTest(null); setStartError(''); }} className="text-xs text-gray-500 hover:text-quest-blue">← Back</button>
            </div>
            <p className="text-sm text-gray-500">Welcome, <span className="font-medium text-quest-navy">{fullName}</span>. Select the test you want to take.</p>
          </div>
          {startError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{startError}</div>}
          {Object.entries(testsBySubject).map(([subjId, tests]) => (
            <div key={subjId} className="card mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{getSubjectName(subjId)}</p>
              <div className="space-y-2">
                {tests.map(test => (
                  <button key={test.id} onClick={() => { setSelectedTest(test); setTestCode(''); setStartError(''); }}
                    className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${selectedTest?.id === test.id ? 'border-quest-blue bg-blue-50' : 'border-blue-100 bg-white hover:border-blue-300'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold mb-1 ${typeColor(test.test_type)}`}>{test.test_type}</span>
                        <p className="text-sm font-semibold text-quest-navy">{test.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{test.duration_minutes} mins · {test.total_questions} questions</p>
                      </div>
                      {selectedTest?.id === test.id && (
                        <div className="w-5 h-5 rounded-full bg-quest-blue flex items-center justify-center shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {selectedTest && (
            <div className="card">
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-600 font-medium mb-0.5">You are about to start:</p>
                <p className="font-bold text-quest-navy">{selectedTest.title}</p>
                <p className="text-xs text-gray-500 mt-1">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mr-2 ${typeColor(selectedTest.test_type)}`}>{selectedTest.test_type}</span>
                  {selectedTest.duration_minutes} mins &nbsp;·&nbsp; {selectedTest.total_questions} questions
                </p>
              </div>
              {(selectedTest as any).test_code && (selectedTest as any).test_code.trim() !== '' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Test Code</label>
                  <input type="text" className="input font-mono tracking-widest uppercase" placeholder="Enter test code from your teacher" value={testCode} onChange={e => setTestCode(e.target.value.toUpperCase())} />
                </div>
              )}
              <button onClick={handleStartTest} className="btn-primary w-full" disabled={starting}>
                {starting ? 'Starting...' : 'Start Test →'}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6 text-center">
        &copy; {new Date().getFullYear()} Quest College. All rights reserved.
        <br />
        <span className="text-gray-300">Developed by Adekunle Temitope Olamilekan</span>
      </p>
    </div>
  );
}
