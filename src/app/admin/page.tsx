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

interface EditableQuestion {
  id?: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  image_url?: string | null;
  image_preview?: string | null;
  image_file?: File | null;
}

interface BroadRow {
  reg_no: string;
  student_name: string;
  class_id: string;
  subject_id: string;
  [key: string]: Result | string | undefined;
}

function typeColor(t: string) {
  const l = t.toLowerCase();
  if (l.includes('exam')) return 'bg-orange-100 text-orange-700 border border-orange-200';
  if (l.includes('ca')) return 'bg-blue-100 text-blue-700 border border-blue-200';
  return 'bg-gray-100 text-gray-600 border border-gray-200';
}

async function compressImage(file: File, maxW = 800, quality = 0.75): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/webp', quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function emptyQuestion(): EditableQuestion {
  return { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_option: 'A', image_url: null, image_preview: null, image_file: null };
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [storageUsed, setStorageUsed] = useState<number | null>(null);
  const [storageTotal] = useState(1024);

  async function logout() {
    await fetch('/api/admin-logout', { method: 'POST' });
    router.push('/admin/login');
  }

  function refreshStorage() {
    fetch('/api/admin-storage')
      .then(r => r.json())
      .then(d => { if (d.usedMB !== undefined) setStorageUsed(d.usedMB); })
      .catch(() => {});
  }

  useEffect(() => { refreshStorage(); }, []);

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
        <div className="flex items-center gap-4">
          {storageUsed !== null && (
            <div className="hidden sm:block text-right">
              <p className="text-xs text-blue-200">Storage</p>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-quest-accent" style={{ width: `${Math.min(100, (storageUsed / storageTotal) * 100)}%` }} />
                </div>
                <span className="text-xs text-white font-medium">{storageUsed.toFixed(1)} / {storageTotal} MB</span>
              </div>
            </div>
          )}
          <button onClick={logout} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">Logout</button>
        </div>
      </div>
      <div className="bg-white border-b border-blue-100 px-4 flex overflow-x-auto gap-1">
        {tabs.map((t, i) => (
          <button key={i} onClick={() => setTab(i)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === i ? 'border-quest-blue text-quest-blue' : 'border-transparent text-gray-500 hover:text-quest-navy'}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {tab === 0 && <ClassesSubjectsTab />}
        {tab === 1 && <StudentsTab />}
        {tab === 2 && <QuestionsTab onStorageChange={refreshStorage} />}
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
    <div className={`mb-4 p-3 rounded-lg text-sm ${type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>{msg}</div>
  );
}function ClassesSubjectsTab() {
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
    if (error) { setErr('Failed to add class.'); return; }
    setMsg('Class added.'); setNewClass(''); load();
  }
  async function deleteClass(id: string, name: string) {
    if (!confirm(`Delete class "${name}"?`)) return;
    const { count: sc } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('class_id', id);
    if (sc && sc > 0) { setErr(`Cannot delete "${name}" — ${sc} students in it.`); return; }
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
    if (error) setErr('Cannot delete: ' + error.message);
    else { setMsg('Subject deleted.'); load(); }
  }
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card">
        <SectionTitle>Classes</SectionTitle>
        <Alert type="success" msg={msg} />
        <Alert type="error" msg={err} />
        <div className="flex gap-2 mb-4">
          <input className="input flex-1" placeholder="Class name e.g. JSS 1" value={newClass} onChange={e => setNewClass(e.target.value)} />
          <button onClick={addClass} className="btn-primary px-4">Add</button>
        </div>
        <p className="text-xs text-amber-600 mb-2">Delete all students in a class first before deleting it.</p>
        <ul className="space-y-2">
          {classes.map(c => (
            <li key={c.id} className="flex items-center justify-between bg-quest-light rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-quest-navy">{c.name}</span>
              <button onClick={() => deleteClass(c.id, c.name)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <SectionTitle>Subjects</SectionTitle>
        <div className="flex gap-2 mb-4">
          <input className="input flex-1" placeholder="Subject name e.g. Mathematics" value={newSubject} onChange={e => setNewSubject(e.target.value)} />
          <button onClick={addSubject} className="btn-primary px-4">Add</button>
        </div>
        <ul className="space-y-2">
          {subjects.map(s => (
            <li key={s.id} className="flex items-center justify-between bg-quest-light rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-quest-navy">{s.name}</span>
              <button onClick={() => deleteSubject(s.id, s.name)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

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
  function getClassName(id: string) { return classes.find(cl => cl.id === id)?.name ?? id; }

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
      classes.forEach(c => { classMap[c.name.toLowerCase()] = c.id; });
      const inserts: any[] = [];
      for (const row of rows) {
        const reg_no = String(row['reg_no'] || '').trim();
        const full_name = String(row['full_name'] || '').trim();
        const className = String(row['class'] || '').trim();
        const class_id = classMap[className.toLowerCase()];
        if (reg_no && full_name && class_id) inserts.push({ reg_no, full_name, class_id });
      }
      if (inserts.length === 0) { setErr('No valid rows found.'); setUploading(false); return; }
      const res = await fetch('/api/admin-students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ students: inserts }) });
      const json = await res.json();
      if (!res.ok) setErr('Upload failed: ' + json.error);
      else { setMsg(`Uploaded ${json.count} students.`); load(); }
      setUploading(false);
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function deleteStudent(id: string, reg_no: string, name: string) {
    if (!confirm(`Delete student "${name}"?`)) return;
    const res = await fetch('/api/admin-students', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reg_no }) });
    const json = await res.json();
    if (!res.ok) setErr('Delete failed: ' + json.error);
    else { setMsg('Student deleted.'); load(); }
  }

  async function deleteAllStudents() {
    if (!filterClass) { setErr('Select a class first.'); return; }
    if (!confirm(`DELETE ALL STUDENTS in ${getClassName(filterClass)}?`)) return;
    const res = await fetch('/api/admin-students', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ class_id: filterClass }) });
    const json = await res.json();
    if (!res.ok) setErr('Delete failed: ' + json.error);
    else { setMsg(`Deleted all students.`); load(); }
  }

  const filtered = filterClass ? students.filter(s => s.class_id === filterClass) : students;
  return (
    <div className="card">
      <SectionTitle>Students</SectionTitle>
      <Alert type="success" msg={msg} />
      <Alert type="error" msg={err} />
      <div className="flex flex-wrap gap-3 mb-5">
        <label className="btn-secondary cursor-pointer">
          {uploading ? 'Uploading...' : 'Upload Excel'}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
        </label>
        <select className="input w-auto" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="flex items-center text-sm text-gray-500">{filtered.length} student(s)</span>
        {filterClass && <button onClick={deleteAllStudents} className="btn-secondary bg-red-50 text-red-600 border-red-200">Delete All in Class</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-quest-light text-quest-navy text-left"><th className="px-3 py-2">Name</th><th className="px-3 py-2">Reg No</th><th className="px-3 py-2">Class</th><th className="px-3 py-2"></th></tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-blue-50"><td className="px-3 py-2">{s.full_name}</td><td className="px-3 py-2 font-mono text-xs">{s.reg_no}</td><td className="px-3 py-2">{getClassName(s.class_id)}</td><td className="px-3 py-2 text-right"><button onClick={() => deleteStudent(s.id, s.reg_no, s.full_name)} className="text-red-500 text-xs font-bold">Delete</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}function QuestionEditor({ q, index, onChange, onDelete, onImagePick }: { q: EditableQuestion; index: number; onChange: (updated: EditableQuestion) => void; onDelete: () => void; onImagePick: (file: File) => void; }) {
  const imgRef = useRef<HTMLInputElement>(null);
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onImagePick(file);
    if (imgRef.current) imgRef.current.value = '';
  }
  function removeImage() { onChange({ ...q, image_url: null, image_preview: null, image_file: null }); }
  const previewSrc = q.image_preview || q.image_url;
  return (
    <div className="border border-blue-100 rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-start justify-between gap-2"><span className="text-xs font-bold text-gray-400">Q{index + 1}</span><button onClick={onDelete} className="text-red-400 text-xs font-bold">✕ Remove</button></div>
      <textarea className="input text-sm w-full" rows={3} placeholder="Question text" value={q.question_text} onChange={e => onChange({ ...q, question_text: e.target.value })} />
      <div>{previewSrc ? (<div className="relative inline-block"><img src={previewSrc} alt="diagram" className="max-h-40 rounded border" /><button onClick={removeImage} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs">✕</button></div>) : (<label className="inline-flex items-center gap-1 cursor-pointer text-xs text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 bg-blue-50">📷 Add Image<input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} /></label>)}</div>
      <div className="grid sm:grid-cols-2 gap-2">
        {(['a','b','c','d'] as const).map(opt => (
          <div key={opt} className="flex items-center gap-2">
            <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${q.correct_option === opt.toUpperCase() ? 'bg-green-500 text-white' : 'bg-gray-100'}`}>{opt.toUpperCase()}</span>
            <input className="input text-sm flex-1 py-1.5" placeholder={`Option ${opt.toUpperCase()}`} value={(q as any)[`option_${opt}`]} onChange={e => onChange({ ...q, [`option_${opt}`]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3"><span className="text-xs">Correct:</span>{['A','B','C','D'].map(opt => (<button key={opt} onClick={() => onChange({ ...q, correct_option: opt })} className={`w-8 h-8 rounded-full text-xs font-bold ${q.correct_option === opt ? 'bg-green-500 text-white' : 'bg-gray-100'}`}>{opt}</button>))}</div>
    </div>
  );
}

function QuestionsTab({ onStorageChange }: { onStorageChange: () => void }) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [counts, setCounts] = useState<QuestionCount[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [uploading, setUploading] = useState(false);
  const excelRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data: cd } = await supabase.from('classes').select('*').order('name');
    const { data: sd } = await supabase.from('subjects').select('*').order('name');
    if (cd) setClasses(cd as ClassRecord[]);
    if (sd) setSubjects(sd as Subject[]);
    const { data: qData } = await supabase.from('questions').select('class_id, subject_id');
    if (!qData || !cd || !sd) return;
    const countMap: Record<string, number> = {};
    qData.forEach((q: any) => { const key = `${q.class_id}__${q.subject_id}`; countMap[key] = (countMap[key] || 0) + 1; });
    const result: QuestionCount[] = Object.keys(countMap).map(key => {
      const [cid, sid] = key.split('__');
      const cls = (cd as ClassRecord[]).find(c => c.id === cid);
      const sub = (sd as Subject[]).find(s => s.id === sid);
      return { class_id: cid, subject_id: sid, class_name: cls?.name ?? cid, subject_name: sub?.name ?? sid, count: countMap[key] };
    });
    setCounts(result);
  }
  useEffect(() => { load(); }, []);

  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!filterClass || !filterSubject) { setErr('Select class and subject first.'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);
        const parsed: EditableQuestion[] = [];
        for (const row of rows) {
          const qt = String(row['question_text'] || '').trim();
          const oa = String(row['option_a'] || '').trim();
          const ob = String(row['option_b'] || '').trim();
          const oc = String(row['option_c'] || '').trim();
          const od = String(row['option_d'] || '').trim();
          const co = String(row['correct_option'] || '').trim().toUpperCase();
          if (qt && oa && ob && ['A','B','C','D'].includes(co)) parsed.push({ question_text: qt, option_a: oa, option_b: ob, option_c: oc, option_d: od, correct_option: co, image_url: null, image_preview: null, image_file: null });
        }
        if (parsed.length === 0) setErr('No valid rows.');
        else { setQuestions(prev => [...prev, ...parsed]); setMsg(`Loaded ${parsed.length} questions.`); }
      } catch (ex: any) { setErr('Failed to read Excel'); }
      setUploading(false);
    };
    reader.readAsBinaryString(file);
    if (excelRef.current) excelRef.current.value = '';
  }

  function addBlankQuestion() {
    if (!filterClass || !filterSubject) { setErr('Select class and subject first.'); return; }
    setQuestions(prev => [...prev, emptyQuestion()]);
  }
  function updateQuestion(i: number, updated: EditableQuestion) { setQuestions(prev => prev.map((q, idx) => idx === i ? updated : q)); }
  function deleteQuestion(i: number) { setQuestions(prev => prev.filter((_, idx) => idx !== i)); }
  async function handleImagePick(i: number, file: File) {
    const preview = URL.createObjectURL(file);
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, image_file: file, image_preview: preview } : q));
  }
  async function uploadImageForQuestion(file: File, classId: string, subjectId: string): Promise<string | null> {
    try {
      const compressed = await compressImage(file);
      const filename = `${classId}_${subjectId}_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
      const { data, error } = await supabase.storage.from('question-images').upload(filename, compressed, { contentType: 'image/webp' });
      if (error || !data) return null;
      const { data: urlData } = supabase.storage.from('question-images').getPublicUrl(filename);
      return urlData.publicUrl;
    } catch { return null; }
  }
  async function saveAll() {
    if (!filterClass || !filterSubject) { setErr('Select class and subject first.'); return; }
    setSaving(true); setErr(''); setMsg('');
    const withUrls: EditableQuestion[] = [];
    for (const q of questions) {
      if (q.image_file) { const url = await uploadImageForQuestion(q.image_file, filterClass, filterSubject); withUrls.push({ ...q, image_url: url, image_preview: null, image_file: null }); }
      else withUrls.push({ ...q, image_preview: null, image_file: null });
    }
    const payload = withUrls.map(q => ({ question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option, image_url: q.image_url || null }));
    const res = await fetch('/api/admin-questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ class_id: filterClass, subject_id: filterSubject, questions: payload }) });
    const json = await res.json();
    if (!res.ok) { setErr('Save failed: ' + json.error); setSaving(false); return; }
    setMsg(`Saved ${json.count} questions.`); setQuestions([]); onStorageChange(); load(); setSaving(false);
  }
  async function deleteBank(classId: string, subjectId: string) {
    if (!confirm('Delete ALL questions?')) return;
    const res = await fetch('/api/admin-questions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ class_id: classId, subject_id: subjectId }) });
    if (res.ok) { setMsg('Deleted.'); onStorageChange(); load(); }
  }
  const canAct = !!(filterClass && filterSubject);
  return (
    <div className="space-y-6">
      <div className="card">
        <SectionTitle>Questions Editor</SectionTitle>
        <Alert type="success" msg={msg} /><Alert type="error" msg={err} />
        <div className="flex flex-wrap gap-3 mb-4">
          <select className="input w-auto" value={filterClass} onChange={e => setFilterClass(e.target.value)}><option value="">Select Class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="input w-auto" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}><option value="">Select Subject</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <div className="flex flex-wrap gap-3 mb-4">
          <label className={`btn-secondary cursor-pointer ${!canAct ? 'opacity-50 pointer-events-none' : ''}`}>{uploading ? 'Reading...' : '📊 Upload Excel'}<input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} /></label>
          <button onClick={addBlankQuestion} className="btn-secondary">✏️ Add Manually</button>
          {questions.length > 0 && <button onClick={() => setQuestions([])} className="btn-secondary text-red-600 bg-red-50">Clear All</button>}
        </div>
        {questions.length > 0 && (
          <div className="space-y-4">
            <div className="flex justify-between"><p className="text-sm font-semibold">{questions.length} questions</p><button onClick={saveAll} className="btn-primary px-5">{saving ? 'Saving...' : `Save All`}</button></div>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">{questions.map((q, i) => (<QuestionEditor key={i} q={q} index={i} onChange={u => updateQuestion(i, u)} onDelete={() => deleteQuestion(i)} onImagePick={f => handleImagePick(i, f)} />))}</div>
            <button onClick={saveAll} className="btn-primary w-full">{saving ? 'Saving...' : `Save All ${questions.length}`}</button>
          </div>
        )}
      </div>
      <div className="card">
        <SectionTitle>Question Banks</SectionTitle>
        <table className="w-full text-sm"><thead><tr className="bg-quest-light text-left"><th className="px-3 py-2">Class</th><th className="px-3 py-2">Subject</th><th className="px-3 py-2 text-right">Count</th><th className="px-3 py-2"></th></tr></thead><tbody>{counts.map(c => (<tr key={`${c.class_id}_${c.subject_id}`} className="border-b"><td className="px-3 py-2">{c.class_name}</td><td className="px-3 py-2">{c.subject_name}</td><td className="px-3 py-2 text-right">{c.count}</td><td className="px-3 py-2 text-right"><button onClick={() => deleteBank(c.class_id, c.subject_id)} className="text-red-500 text-xs">Delete Bank</button></td></tr>))}</tbody></table>
      </div>
    </div>
  );
}function TestsTab() {
  const [tests, setTests] = useState<Test[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const emptyForm = { title: '', class_id: '', subject_id: '', test_type: 'CA 1', duration_minutes: 30, total_questions: 20, total_marks: 20, start_time: '', end_time: '', test_code: '' };
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
  function getClassName(id: string) { return classes.find(cl => cl.id === id)?.name ?? id; }
  function getSubjectName(id: string) { return subjects.find(su => su.id === id)?.name ?? id; }
  function startEdit(t: Test) { setEditingTest(t); setForm({ title: t.title, class_id: t.class_id, subject_id: t.subject_id, test_type: t.test_type, duration_minutes: t.duration_minutes, total_questions: t.total_questions, total_marks: (t as any).total_marks ?? t.total_questions, start_time: t.start_time ? t.start_time.slice(0, 16) : '', end_time: t.end_time ? t.end_time.slice(0, 16) : '', test_code: (t as any).test_code ?? '' }); }
  function cancelEdit() { setEditingTest(null); setForm(emptyForm); }

  async function saveTest(e: React.FormEvent) {
    e.preventDefault();
    const payload: any = { ...form, test_code: form.test_code.toUpperCase().trim(), start_time: form.start_time ? new Date(form.start_time).toISOString() : new Date().toISOString(), end_time: form.end_time ? new Date(form.end_time).toISOString() : new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() };
    if (editingTest) payload.id = editingTest.id;
    const res = await fetch('/api/admin-tests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (!res.ok) { setErr('Failed: ' + json.error); return; }
    setMsg(editingTest ? 'Test updated.' : 'Test created.'); setEditingTest(null); setForm(emptyForm); load();
  }
  async function toggleActive(test: Test) { await fetch('/api/admin-tests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: test.id, is_active: !test.is_active }) }); load(); }
  async function deleteTest(id: string, title: string) { if (!confirm(`Delete "${title}"?`)) return; await fetch('/api/admin-tests', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); load(); }

  return (
    <div className="space-y-6">
      <div className={`card ${editingTest ? 'border-2 border-quest-accent' : ''}`}>
        <SectionTitle>{editingTest ? 'Edit Test' : 'Create Test'}</SectionTitle>
        <Alert type="success" msg={msg} /><Alert type="error" msg={err} />
        <form onSubmit={saveTest} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Test Title" required /></div>
          <div><select className="input" value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })} required><option value="">Class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><select className="input" value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} required><option value="">Subject</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><input className="input" value={form.test_type} onChange={e => setForm({ ...form, test_type: e.target.value })} placeholder="Type CA 1, Exam" /></div>
          <div><input className="input" value={form.test_code} onChange={e => setForm({ ...form, test_code: e.target.value.toUpperCase() })} placeholder="Code optional" /></div>
          <div><input type="number" className="input" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} required /></div>
          <div><input type="number" className="input" value={form.total_questions} onChange={e => setForm({ ...form, total_questions: Number(e.target.value) })} required /></div>
          <div><input type="number" className="input" value={form.total_marks} onChange={e => setForm({ ...form, total_marks: Number(e.target.value) })} required /></div>
          <div><input type="datetime-local" className="input" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div>
          <div><input type="datetime-local" className="input" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></div>
          <div className="sm:col-span-2 flex gap-3"><button type="submit" className="btn-primary">{editingTest ? 'Save Changes' : 'Create Test'}</button>{editingTest && <button type="button" onClick={cancelEdit} className="btn-secondary">Cancel</button>}</div>
        </form>
      </div>
      <div className="card">
        <SectionTitle>All Tests</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-quest-light text-left"><th className="px-3 py-2">Title</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Class</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>{tests.map(t => (<tr key={t.id} className="border-b"><td className="px-3 py-2">{t.title}</td><td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${typeColor(t.test_type)}`}>{t.test_type}</span></td><td className="px-3 py-2">{getClassName(t.class_id)}</td><td className="px-3 py-2"><button onClick={() => toggleActive(t)} className={`px-2 py-0.5 rounded-full text-xs ${t.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>{t.is_active ? 'Active' : 'Inactive'}</button></td><td className="px-3 py-2 text-right"><button onClick={() => startEdit(t)} className="text-blue-600 text-xs mr-2">Edit</button><button onClick={() => deleteTest(t.id, t.title)} className="text-red-500 text-xs">Delete</button></td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}function ResultsTab() {
  const [results, setResults] = useState<Result[]>([]);
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
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
  function getClassName(id: string) { return classes.find(cl => cl.id === id)?.name ?? id; }
  function getSubjectName(id: string) { return subjects.find(su => su.id === id)?.name ?? id; }

  const filtered = results.filter(r => {
    if (filterClass && r.class_id !== filterClass) return false;
    if (filterSubject && r.subject_id !== filterSubject) return false;
    return true;
  });

  const testTypes = Array.from(new Set(filtered.map(r => r.test_type))).sort();
  const broadMap: Record<string, BroadRow> = {};
  filtered.forEach(r => {
    const key = `${r.reg_no}__${r.subject_id}`;
    if (!broadMap[key]) broadMap[key] = { reg_no: r.reg_no, student_name: r.student_name, class_id: r.class_id, subject_id: r.subject_id };
    broadMap[key][r.test_type] = r;
  });
  const broadsheet = Object.values(broadMap).sort((a, b) => a.student_name.localeCompare(b.student_name));

  async function deleteResult(id: string) {
    if (!confirm('Delete this result?')) return;
    await fetch('/api/admin-results', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    load();
  }

  function exportBroadsheet() {
    const rows = broadsheet.map((row, i) => {
      const out: any = { '#': i + 1, 'Name': row.student_name, 'Reg No': row.reg_no };
      testTypes.forEach(tt => { const r = row[tt] as Result | undefined; out[tt] = r ? `${r.score}/${r.total}` : ''; });
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Broadsheet');
    XLSX.writeFile(wb, 'quest_broadsheet.xlsx');
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <SectionTitle>Results</SectionTitle>
        <Alert type="success" msg={msg} />
        <Alert type="error" msg={err} />
        <div className="flex flex-wrap gap-3 mb-2">
          <select className="input w-auto" value={filterClass} onChange={e => setFilterClass(e.target.value)}><option value="">All Classes</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className="input w-auto" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}><option value="">All Subjects</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <span className="text-sm text-gray-500">{broadsheet.length} students</span>
        </div>
      </div>
      <div className="card">
        <div className="flex justify-between mb-4"><h3 className="font-semibold">Broadsheet</h3><button onClick={exportBroadsheet} className="btn-secondary text-sm">Export Excel</button></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-quest-navy text-white text-left"><th className="px-3 py-2">#</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Reg No</th>{testTypes.map(tt => <th key={tt} className="px-3 py-2">{tt}</th>)}</tr></thead>
            <tbody>
              {broadsheet.map((row, i) => (
                <tr key={`${row.reg_no}_${row.subject_id}`} className="border-b"><td className="px-3 py-2">{i + 1}</td><td className="px-3 py-2">{row.student_name}</td><td className="px-3 py-2">{row.reg_no}</td>{testTypes.map(tt => { const r = row[tt] as Result | undefined; return <td key={tt} className="px-3 py-2">{r ? `${r.score}/${r.total}` : '—'}</td>; })}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
