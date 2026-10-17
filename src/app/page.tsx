'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { ClassRecord, Subject } from '@/lib/supabase';

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

      if (!test.test_code || test.test_code.trim().toUpperCase() !== testCode.trim().toUpperCase()) {
        setError('Incorrect test code. Please ask your teacher for the correct code.');
        setLoading(false);
        return;
      }

      const { data: existing } = await supabase
        .from('results')
        .select('id')
        .eq('reg_no', regNo.trim())
        .eq('test_id', test.id);

      if (existing && existing.length > 0) {
        setError('You have already taken this test. You cannot retake it.');
        setLoading(false);
        return;
      }

      const studentData = {
        reg_no: regNo.trim(),
        full_name: fullName.trim(),
        class_id: classId,
        subject_id: subjectId,
      };

      sessionStorage.setItem('quest_student', JSON.stringify(studentData));
      sessionStorage.setItem('quest_test', JSON.stringify(test));

      router.push(`/test/${test.id}`);
    } catch (err: any) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-quest-light flex flex-col items-center justify-center px-4 py-10">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. QC/2024/001"
              value={regNo}
              onChange={(e) => setRegNo(e.target.value)}
              required
            />
          </div>

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
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

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
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

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
          </div>

          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
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
