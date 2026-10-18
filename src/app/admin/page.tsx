'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { ClassRecord, Subject, Student, Test, Result } from '@/lib/supabase';
import * as XLSX from 'xlsx';

interface QuestionCount {
  class_id: string;
  subject_id: string;
  class_name: string;
  subject_name: string;
  count: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState(0);

  async function logout() {
    await fetch('/api/admin-logout', { method: 'POST' });
    router.push('/admin/login');
  }

  const tabs = ['Classes & Subjects', 'Students', 'Questions', 'Tests', 'Results'];

  return (
    <div className="min-h-screen bg-quest-light">
      <div className="bg-quest-navy text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-quest-accent rounded-lg flex items-center justify-center">
            <span className="text-quest-navy font-extrabold text-lg">Q</span>
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Quest College CBT</p>
            <p className="text-blue-200 text-xs">Admin Dashboard</p>
          </div>
        </div>
        <button onClick={logout} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
          Logout
        </button>
      </div>

      <div className="bg-white border-b border-blue-100 px-4 flex overflow-x-auto gap-1">
        {tabs.map((t: string, i: number) => (
          <button key={i} onClick={() => setTab(i)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === i ? 'border-quest-blue text-quest-blue' : 'border-transparent text-gray-500 hover:text-quest-navy'
            }`}>
            {t}
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {tab === 0 && <ClassesSubjectsTab />}
        {tab === 1 && <StudentsTab />}
        {tab === 2 && <QuestionsTab />}
        {tab === 3 && <TestsTab />}
        {tab === 4 && <ResultsTab />}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-quest-navy mb-4">{children}</h2>;
}

function Alert({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  if (!msg) return null;
  return (
    <div className={`mb-4 p-3 rounded-lg text-sm ${
      type === 'success' ? 'bg-green-50 border border-green-200 text-green-700'
      : 'bg-red-50 border border-red-200 text-red-700'
    }`}>{msg}</div>
  );
}

// ── Classes & Subjects ─────────────────────────────────────────────────────
function ClassesSubjectsTab() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [newClass, setNewClass] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    const { data: cd } = await supabase.from('classes').select('*').order('name');
    const { data: sd } = await supabase.from('subjects').select('*').order('name');
    if (cd) setClasses(cd as ClassRecord[]);
    if (sd) setSubjects(sd as Subject[]);
  }

  useEffect(() => { load(); }, []);

  async function addClass() {
    if (!newClass.trim()) return;
    const { error } = await supabase.from('classes').insert([{ name: newClass.trim() }]);
    if (error) { setErr('Failed to add class - maybe duplicate name.'); return; }
    setMsg('Class added.'); setNewClass(''); load();
  }

  async function deleteClass(id: string, name: string) {
    if (!confirm(`Delete class "${name}"?`)) return;
    setErr(''); setMsg('');
    const { count: studentCount } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('class_id', id);
    if (studentCount && studentCount > 0) {
      setErr(`Cannot delete "${name}" - it has ${studentCount} students. Delete students first.`);
      return;
    }
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) setErr('Cannot delete: ' + error.message);
    else { setMsg('Class deleted.'); load(); }
  }

  async function addSubject() {
    if (!newSubject.trim()) return;
    const { error } = await supabase.from('subjects').insert([{ name: newSubject.trim() }]);
    if (error) { setErr('Failed to add subject.'); return; }
    setMsg('Subject added.'); setNewSubject(''); load();
  }

  async function deleteSubject(id: string, name: string) {
    if (!confirm(`Delete subject "${name}"?`)) return;
    const { error } = await supabase.from('subjects').delete().eq('id', id);
    if (error) setErr('Cannot delete subject: ' + error.message);
    else { setMsg('Subject deleted.'); load(); }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card">
        <SectionTitle>Classes (Protected)</SectionTitle>
        <Alert type="success" msg={msg} />
        <Alert type="error" msg={err} />
        <div className="flex gap-2 mb-4">
          <input className="input flex-1" placeholder="Class name e.g. JSS 1" value={newClass} onChange={(e) => setNewClass(e.target.value)} />
          <button onClick={addClass} className="btn-primary px-4">Add</button>
        </div>
        <p className="text-xs text-amber-600 mb-2">Classes are protected. You must delete all students in that class first.</p>
        <ul className="space-y-2">
          {classes.map((c: ClassRecord) => (
            <li key={c.id} className="flex items-center justify-between bg-quest-light rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-quest-navy">{c.name}</span>
              <button onClick={() => deleteClass(c.id, c.name)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
            </li>
          ))}
          {classes.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No classes yet.</p>}
        </ul>
      </div>

      <div className="card">
        <SectionTitle>Subjects</SectionTitle>
        <div className="flex gap-2 mb-4">
          <input className="input flex-1" placeholder="Subject name e.g. Mathematics" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
          <button onClick={addSubject} className="btn-primary px-4">Add</button>
        </div>
        <ul className="space-y-2">
          {subjects.map((s: Subject) => (
            <li key={s.id} className="flex items-center justify-between bg-quest-light rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-quest-navy">{s.name}</span>
              <button onClick={() => deleteSubject(s.id, s.name)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
            </li>
          ))}
          {subjects.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No subjects yet.</p>}
        </ul>
      </div>
    </div>
  );
}

// ── Students ───────────────────────────────────────────────────────────────
function StudentsTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data: cd } = await supabase.from('classes').select('*').order('name');
    if (cd) setClasses(cd as ClassRecord[]);
    const { data } = await supabase.from('students').select('*').order('full_name');
    if (data) setStudents(data as Student[]);
  }

  useEffect(() => { load(); }, []);

  function getClassName(id: string) {
    return classes.find((cl: ClassRecord) => cl.id === id)?.name ?? id;
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr(''); setMsg('');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      const classMap: Record<string, string> = {};
      classes.forEach((c: ClassRecord) => { classMap[c.name.toLowerCase()] = c.id; });
      const inserts: any[] = [];
      for (const row of rows) {
        const reg_no = String(row['reg_no'] || row['Reg No'] || row['RegNo'] || '').trim();
        const full_name = String(row['full_name'] || row['Full Name'] || row['FullName'] || '').trim();
        const className = String(row['class'] || row['Class'] || '').trim();
        const class_id = classMap[className.toLowerCase()];
        if (reg_no && full_name && class_id) inserts.push({ reg_no, full_name, class_id });
      }
      if (inserts.length === 0) { setErr('No valid rows found. Ensure columns: reg_no, full_name, class'); setUploading(false); return; }

      // Use API route (service role) to bypass RLS
      const res = await fetch('/api/admin-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: inserts }),
      });
      const json = await res.json();
      if (!res.ok) setErr('Upload failed: ' + json.error);
      else { setMsg(`Uploaded ${json.count} students.`); load(); }
      setUploading(false);
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function deleteStudent(id: string, reg_no: string, name: string) {
    if (!confirm(`Delete student "${name}"? This will also delete their results.`)) return;
    const res = await fetch('/api/admin-students', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reg_no }),
    });
    const json = await res.json();
    if (!res.ok) setErr('Delete failed: ' + json.error);
    else { setMsg('Student deleted.'); load(); }
  }

  async function deleteAllStudents() {
    if (!filterClass) { setErr('Select a class to delete all students in that class.'); return; }
    const className = getClassName(filterClass);
    if (!confirm(`DELETE ALL STUDENTS in ${className}? This cannot be undone!`)) return;
    const res = await fetch('/api/admin-students', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: filterClass }),
    });
    const json = await res.json();
    if (!res.ok) setErr('Delete failed: ' + json.error);
    else { setMsg(`Deleted all students in ${className}.`); load(); }
  }

  const filtered = filterClass ? students.filter((s: Student) => s.class_id === filterClass) : students;

  return (
    <div className="card">
      <SectionTitle>Students - Deletable</SectionTitle>
      <Alert type="success" msg={msg} />
      <Alert type="error" msg={err} />
      <div className="flex flex-wrap gap-3 mb-5">
        <label className="btn-secondary cursor-pointer">
          {uploading ? 'Uploading...' : 'Upload Excel'}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
        </label>
        <select className="input w-auto" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map((c: ClassRecord) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="flex items-center text-sm text-gray-500">{filtered.length} student(s)</span>
        {filterClass && <button onClick={deleteAllStudents} className="btn-secondary bg-red-50 text-red-600 border-red-200">Delete All in Class</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-quest-light text-quest-navy text-left">
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Reg No</th>
              <th className="px-3 py-2 font-semibold">Class</th>
              <th className="px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s: Student) => (
              <tr key={s.id} className="border-b border-blue-50 hover:bg-blue-50/30">
                <td className="px-3 py-2">{s.full_name}</td>
                <td className="px-3 py-2 font-mono text-xs">{s.reg_no}</td>
                <td className="px-3 py-2">{getClassName(s.class_id)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => deleteStudent(s.id, s.reg_no, s.full_name)} className="text-red-500 hover:text-red-700 text-xs font-bold">Delete</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-gray-400 text-sm">No students found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Questions ──────────────────────────────────────────────────────────────
function QuestionsTab() {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [counts, setCounts] = useState<QuestionCount[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data: cd } = await supabase.from('classes').select('*').order('name');
    const { data: sd } = await supabase.from('subjects').select('*').order('name');
    if (cd) setClasses(cd as ClassRecord[]);
    if (sd) setSubjects(sd as Subject[]);
    const { data: qData } = await supabase.from('questions').select('class_id, subject_id');
    if (!qData || !cd || !sd) return;
    const classArr = cd as ClassRecord[];
    const subjectArr = sd as Subject[];
    const countMap: Record<string, number> = {};
    qData.forEach((q: any) => { const key = `${q.class_id}__${q.subject_id}`; countMap[key] = (countMap[key] || 0) + 1; });
    const result: QuestionCount[] = Object.keys(countMap).map((key: string) => {
      const [cid, sid] = key.split('__');
      const cls = classArr.find((c: ClassRecord) => c.id === cid);
      const sub = subjectArr.find((s: Subject) => s.id === sid);
      return { class_id: cid, subject_id: sid, class_name: cls ? cls.name : cid, subject_name: sub ? sub.name : sid, count: countMap[key] };
    });
    result.sort((a: any, b: any) => a.class_name.localeCompare(b.class_name));
    setCounts(result);
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!filterClass || !filterSubject) { setErr('Select a class and subject before uploading.'); return; }
    setUploading(true); setErr(''); setMsg('');
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = evt.target?.result;
      const wb = XLSX.read(data, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      const inserts: any[] = [];
      for (const row of rows) {
        const question_text = String(row['question_text'] || row['Question'] || '').trim();
        const option_a = String(row['option_a'] || row['Option A'] || '').trim();
        const option_b = String(row['option_b'] || row['Option B'] || '').trim();
        const option_c = String(row['option_c'] || row['Option C'] || '').trim();
        const option_d = String(row['option_d'] || row['Option D'] || '').trim();
        const correct_option = String(row['correct_option'] || row['Answer'] || '').trim().toUpperCase();
        if (question_text && option_a && option_b && correct_option) {
          inserts.push({ class_id: filterClass, subject_id: filterSubject, question_text, option_a, option_b, option_c, option_d, correct_option });
        }
      }
      if (inserts.length === 0) { setErr('No valid rows.'); setUploading(false); return; }
      const { error } = await supabase.from('questions').insert(inserts);
      if (error) setErr('Upload failed: ' + error.message);
      else { setMsg(`Uploaded ${inserts.length} questions.`); load(); }
      setUploading(false);
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function deleteQuestions(classId: string, subjectId: string) {
    if (!confirm('Delete ALL questions for this class/subject? This is permanent!')) return;
    const { error } = await supabase.from('questions').delete().eq('class_id', classId).eq('subject_id', subjectId);
    if (error) setErr(error.message);
    else { setMsg('Questions deleted.'); load(); }
  }

  return (
    <div className="card">
      <SectionTitle>Questions - Deletable (AI Test Data)</SectionTitle>
      <Alert type="success" msg={msg} />
      <Alert type="error" msg={err} />
      <div className="flex flex-wrap gap-3 mb-2">
        <select className="input w-auto" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="">Select Class</option>
          {classes.map((c: ClassRecord) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-auto" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
          <option value="">Select Subject</option>
          {subjects.map((s: Subject) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="btn-secondary cursor-pointer">
          {uploading ? 'Uploading...' : 'Upload Excel'}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
        </label>
      </div>
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-quest-light text-quest-navy text-left">
              <th className="px-3 py-2 font-semibold">Class</th>
              <th className="px-3 py-2 font-semibold">Subject</th>
              <th className="px-3 py-2 font-semibold text-right">Questions</th>
              <th className="px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {counts.map((c: QuestionCount) => (
              <tr key={`${c.class_id}_${c.subject_id}`} className="border-b border-blue-50 hover:bg-blue-50/30">
                <td className="px-3 py-2">{c.class_name}</td>
                <td className="px-3 py-2">{c.subject_name}</td>
                <td className="px-3 py-2 text-right font-semibold">{c.count}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => deleteQuestions(c.class_id, c.subject_id)} className="text-red-500 hover:text-red-700 text-xs font-bold">Delete All</button>
                </td>
              </tr>
            ))}
            {counts.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-gray-400 text-sm">No questions uploaded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────
function TestsTab() {
  const [tests, setTests] = useState<Test[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [editingTest, setEditingTest] = useState<Test | null>(null);

  const emptyForm = {
    title: '', class_id: '', subject_id: '', test_type: 'CA',
    duration_minutes: 30, total_questions: 20,
    start_time: '', end_time: '', test_code: '',
  };
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const { data: cd } = await supabase.from('classes').select('*').order('name');
    const { data: sd } = await supabase.from('subjects').select('*').order('name');
    const { data: td } = await supabase.from('tests').select('*').order('created_at', { ascending: false });
    if (cd) setClasses(cd as ClassRecord[]);
    if (sd) setSubjects(sd as Subject[]);
    if (td) setTests(td as Test[]);
  }

  useEffect(() => { load(); }, []);

  function getClassName(id: string) { return classes.find((cl: ClassRecord) => cl.id === id)?.name ?? id; }
  function getSubjectName(id: string) { return subjects.find((su: Subject) => su.id === id)?.name ?? id; }

  function startEdit(t: Test) {
    setEditingTest(t);
    setForm({
      title: t.title,
      class_id: t.class_id,
      subject_id: t.subject_id,
      test_type: t.test_type,
      duration_minutes: t.duration_minutes,
      total_questions: t.total_questions,
      start_time: t.start_time ? t.start_time.slice(0, 16) : '',
      end_time: t.end_time ? t.end_time.slice(0, 16) : '',
      test_code: (t as any).test_code ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingTest(null);
    setForm(emptyForm);
    setErr(''); setMsg('');
  }

  async function saveTest(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');
    const payload: any = {
      ...form,
      test_code: form.test_code.toUpperCase().trim(),
      start_time: form.start_time ? new Date(form.start_time).toISOString() : new Date().toISOString(),
      end_time: form.end_time ? new Date(form.end_time).toISOString() : new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    };
    if (editingTest) payload.id = editingTest.id;

    const res = await fetch('/api/admin-tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) { setErr('Failed: ' + json.error); return; }
    setMsg(editingTest ? 'Test updated.' : 'Test created and activated.');
    setEditingTest(null);
    setForm(emptyForm);
    load();
  }

  async function toggleActive(test: Test) {
    const newActive = !test.is_active;
    const res = await fetch('/api/admin-tests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: test.id, is_active: newActive, end_time: test.end_time }),
    });
    const json = await res.json();
    if (!res.ok) setErr('Toggle failed: ' + json.error);
    else load();
  }

  async function deleteTest(id: string, title: string) {
    if (!confirm(`Delete test "${title}"? This will delete ALL results for this test permanently!`)) return;
    setErr(''); setMsg('');
    const res = await fetch('/api/admin-tests', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (!res.ok) setErr('Delete failed: ' + json.error);
    else { setMsg('Test and its results deleted.'); load(); }
  }

  function formatDateTime(dt: string) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="space-y-6">
      <div className={`card ${editingTest ? 'border-2 border-quest-accent' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>{editingTest ? '✏️ Edit Test' : 'Create Test'}</SectionTitle>
          {editingTest && <button onClick={cancelEdit} className="text-xs text-gray-500 hover:text-red-600 font-medium">✕ Cancel</button>}
        </div>
        <Alert type="success" msg={msg} />
        <Alert type="error" msg={err} />
        <form onSubmit={saveTest} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select className="input" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })} required>
              <option value="">-- Select --</option>
              {classes.map((c: ClassRecord) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select className="input" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })} required>
              <option value="">-- Select --</option>
              {subjects.map((s: Subject) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
            <select className="input" value={form.test_type} onChange={(e) => setForm({ ...form, test_type: e.target.value })}>
              <option value="CA">CA</option>
              <option value="Exam">Exam</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Code <span className="text-gray-400 font-normal">(optional — leave blank for no code)</span>
            </label>
            <input
              className="input font-mono uppercase"
              placeholder="e.g. ENG001 (optional)"
              value={form.test_code}
              onChange={(e) => setForm({ ...form, test_code: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (mins)</label>
            <input type="number" className="input" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Questions</label>
            <input type="number" className="input" value={form.total_questions} onChange={(e) => setForm({ ...form, total_questions: Number(e.target.value) })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
            <input type="datetime-local" className="input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
            <input type="datetime-local" className="input" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex gap-3">
            <button type="submit" className="btn-primary">{editingTest ? 'Save Changes' : 'Create Test'}</button>
            {editingTest && <button type="button" onClick={cancelEdit} className="btn-secondary">Cancel</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <SectionTitle>All Tests - Deletable</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-quest-light text-quest-navy text-left">
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Class</th>
                <th className="px-3 py-2 font-semibold">Subject</th>
                <th className="px-3 py-2 font-semibold">Window</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t: Test) => (
                <tr key={t.id} className="border-b border-blue-50 hover:bg-blue-50/30">
                  <td className="px-3 py-2 font-medium">{t.title}</td>
                  <td className="px-3 py-2">
                    {(t as any).test_code
                      ? <span className="bg-yellow-100 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded font-mono font-bold text-xs">{(t as any).test_code}</span>
                      : <span className="text-gray-300 text-xs">none</span>}
                  </td>
                  <td className="px-3 py-2">{getClassName(t.class_id)}</td>
                  <td className="px-3 py-2">{getSubjectName(t.subject_id)}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{t.start_time ? `${formatDateTime(t.start_time)} → ${formatDateTime(t.end_time)}` : '—'}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleActive(t)}
                      title={t.is_active ? 'Click to deactivate' : 'Click to activate (extends window if expired)'}
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {t.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => startEdit(t)} className="text-quest-blue text-xs font-medium">Edit</button>
                      <button onClick={() => deleteTest(t.id, t.title)} className="text-red-500 text-xs font-bold">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {tests.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-gray-400 text-sm">No tests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Results ────────────────────────────────────────────────────────────────
function ResultsTab() {
  const [results, setResults] = useState<Result[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    const { data: cd } = await supabase.from('classes').select('*').order('name');
    const { data: sd } = await supabase.from('subjects').select('*').order('name');
    const { data: rd } = await supabase.from('results').select('*').order('created_at', { ascending: false });
    if (cd) setClasses(cd as ClassRecord[]);
    if (sd) setSubjects(sd as Subject[]);
    if (rd) setResults(rd as Result[]);
  }

  useEffect(() => { load(); }, []);

  function getClassName(id: string) { return classes.find((cl: ClassRecord) => cl.id === id)?.name ?? id; }
  function getSubjectName(id: string) { return subjects.find((su: Subject) => su.id === id)?.name ?? id; }

  const filtered = results.filter((r: Result) => {
    if (filterClass && r.class_id !== filterClass) return false;
    if (filterSubject && r.subject_id !== filterSubject) return false;
    if (filterType && r.test_type !== filterType) return false;
    return true;
  });

  const broadsheet = Array.from(new Map(filtered.map((r: Result) => [r.reg_no + '_' + r.subject_id + '_' + r.test_type, r])).values());
  broadsheet.sort((a: any, b: any) => b.percentage - a.percentage);

  async function deleteResult(id: string) {
    if (!confirm('Delete this result?')) return;
    const res = await fetch('/api/admin-results', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (!res.ok) setErr('Delete failed: ' + json.error);
    else { setMsg('Result deleted.'); load(); }
  }

  async function deleteAllFiltered() {
    if (filtered.length === 0) return;
    if (!confirm(`Delete ALL ${filtered.length} filtered results? Cannot be undone!`)) return;
    const ids = filtered.map(r => r.id);
    const res = await fetch('/api/admin-results', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const json = await res.json();
    if (!res.ok) setErr('Delete failed: ' + json.error);
    else { setMsg(`Deleted ${json.count} results.`); load(); }
  }

  function exportBroadsheet() {
    const rows = broadsheet.map((r: Result, idx: number) => ({
      '#': idx + 1, 'Name': r.student_name, 'Reg No': r.reg_no,
      'Class': getClassName(r.class_id), 'Subject': getSubjectName(r.subject_id),
      'Type': r.test_type, 'Score': r.score, 'Total': r.total,
      'Percentage': r.percentage + '%', 'Status': r.percentage >= 50 ? 'Pass' : 'Fail',
      'Date': new Date(r.created_at).toLocaleDateString(),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Broadsheet');
    XLSX.writeFile(wb, 'quest_broadsheet.xlsx');
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <SectionTitle>Results - Deletable</SectionTitle>
        <Alert type="success" msg={msg} />
        <Alert type="error" msg={err} />
        <div className="flex flex-wrap gap-3 mb-0">
          <select className="input w-auto" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
            <option value="">All Classes</option>
            {classes.map((c: ClassRecord) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input w-auto" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            <option value="">All Subjects</option>
            {subjects.map((s: Subject) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input w-auto" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            <option value="CA">CA</option>
            <option value="Exam">Exam</option>
          </select>
          <span className="flex items-center text-sm text-gray-500">{filtered.length} result(s)</span>
          {filtered.length > 0 && <button onClick={deleteAllFiltered} className="btn-secondary bg-red-50 text-red-600 border-red-200 text-xs">Delete All Filtered</button>}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-quest-navy">Broadsheet</h3>
          <button onClick={exportBroadsheet} className="btn-secondary text-sm py-1.5 px-4">Export Excel</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-quest-navy text-white text-left">
                <th className="px-3 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-3 py-2 font-semibold">Reg No</th>
                <th className="px-3 py-2 font-semibold">Class</th>
                <th className="px-3 py-2 font-semibold">Subject</th>
                <th className="px-3 py-2 font-semibold">Score</th>
                <th className="px-3 py-2 font-semibold">%</th>
                <th className="px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {broadsheet.map((r: Result, i: number) => (
                <tr key={r.id} className="border-b border-blue-50">
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-quest-navy">{r.student_name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.reg_no}</td>
                  <td className="px-3 py-2">{getClassName(r.class_id)}</td>
                  <td className="px-3 py-2">{getSubjectName(r.subject_id)}</td>
                  <td className="px-3 py-2 text-right">{r.score}/{r.total}</td>
                  <td className="px-3 py-2 text-right font-bold">{r.percentage}%</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => deleteResult(r.id)} className="text-red-500 text-xs font-bold">Delete</button></td>
                </tr>
              ))}
              {broadsheet.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-gray-400 text-sm">No results found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
