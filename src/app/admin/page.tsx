'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { ClassRecord, Subject, Student, Test, Result } from '@/lib/supabase';
import * as XLSX from 'xlsx';

// ── Types ──────────────────────────────────────────────────────────────────
interface QuestionCount {
  class_id: string;
  subject_id: string;
  class_name: string;
  subject_name: string;
  count: number;
}

interface EditableQuestion {
  id?: string; // existing DB id, undefined if new
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  image_url?: string | null;
  image_preview?: string | null; // local preview only
  image_file?: File | null; // pending upload
}

interface BroadRow {
  reg_no: string;
  student_name: string;
  class_id: string;
  subject_id: string;
  [key: string]: Result | string | undefined;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function typeColor(t: string) {
  const l = t.toLowerCase();
  if (l.includes('exam')) return 'bg-orange-100 text-orange-700 border border-orange-200';
  if (l.includes('ca')) return 'bg-blue-100 text-blue-700 border border-blue-200';
  return 'bg-gray-100 text-gray-600 border border-gray-200';
}

// Compress image in browser to WebP before upload
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

      {storageUsed !== null && (
        <div className="sm:hidden bg-quest-navy/90 px-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-quest-accent" style={{ width: `${Math.min(100, (storageUsed / storageTotal) * 100)}%` }} />
            </div>
            <span className="text-xs text-blue-200">Storage: {storageUsed.toFixed(1)} / {storageTotal} MB</span>
          </div>
        </div>
      )}

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
          {classes.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No classes yet.</p>}
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
        const reg_no = String(row['reg_no'] || row['Reg No'] || row['RegNo'] || '').trim();
        const full_name = String(row['full_name'] || row['Full Name'] || row['FullName'] || '').trim();
        const className = String(row['class'] || row['Class'] || '').trim();
        const class_id = classMap[className.toLowerCase()];
        if (reg_no && full_name && class_id) inserts.push({ reg_no, full_name, class_id });
      }
      if (inserts.length === 0) { setErr('No valid rows found. Ensure columns: reg_no, full_name, class'); setUploading(false); return; }
      const res = await fetch('/api/admin-students', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    if (!confirm(`Delete student "${name}"?`)) return;
    const res = await fetch('/api/admin-students', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, reg_no }),
    });
    const json = await res.json();
    if (!res.ok) setErr('Delete failed: ' + json.error);
    else { setMsg('Student deleted.'); load(); }
  }

  async function deleteAllStudents() {
    if (!filterClass) { setErr('Select a class first.'); return; }
    if (!confirm(`DELETE ALL STUDENTS in ${getClassName(filterClass)}? Cannot be undone!`)) return;
    const res = await fetch('/api/admin-students', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: filterClass }),
    });
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
          <thead>
            <tr className="bg-quest-light text-quest-navy text-left">
              <th className="px-3 py-2 font-semibold">Name</th>
              <th className="px-3 py-2 font-semibold">Reg No</th>
              <th className="px-3 py-2 font-semibold">Class</th>
              <th className="px-3 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
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

// ── Single Question Editor Row ─────────────────────────────────────────────
function QuestionEditor({
  q, index, onChange, onDelete, onImagePick,
}: {
  q: EditableQuestion;
  index: number;
  onChange: (updated: EditableQuestion) => void;
  onDelete: () => void;
  onImagePick: (file: File) => void;
}) {
  const imgRef = useRef<HTMLInputElement>(null);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onImagePick(file);
    if (imgRef.current) imgRef.current.value = '';
  }

  function removeImage() {
    onChange({ ...q, image_url: null, image_preview: null, image_file: null });
  }

  const previewSrc = q.image_preview || q.image_url;

  return (
    <div className="border border-blue-100 rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold text-gray-400 mt-1">Q{index + 1}</span>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-xs font-bold shrink-0">✕ Remove</button>
      </div>

      {/* Question text — supports HTML via contentEditable for tables/formatting */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Question Text</label>
        <textarea
          className="input text-sm w-full resize-y"
          rows={3}
          placeholder="Type your question here..."
          value={q.question_text}
          onChange={e => onChange({ ...q, question_text: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-0.5">For a table or diagram, use the image option below.</p>
      </div>

      {/* Image */}
      <div>
        {previewSrc ? (
          <div className="relative inline-block">
            <img src={previewSrc} alt="question diagram" className="max-h-40 rounded border border-blue-100" />
            <button onClick={removeImage} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-700">✕</button>
          </div>
        ) : (
          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-1.5 bg-blue-50 hover:bg-blue-100 transition-colors">
            📷 Add Image / Diagram (optional)
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </label>
        )}
      </div>

      {/* Options */}
      <div className="grid sm:grid-cols-2 gap-2">
        {(['a', 'b', 'c', 'd'] as const).map(opt => (
          <div key={opt} className="flex items-center gap-2">
            <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${q.correct_option === opt.toUpperCase() ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {opt.toUpperCase()}
            </span>
            <input
              className="input text-sm flex-1 py-1.5"
              placeholder={`Option ${opt.toUpperCase()}`}
              value={(q as any)[`option_${opt}`]}
              onChange={e => onChange({ ...q, [`option_${opt}`]: e.target.value })}
            />
          </div>
        ))}
      </div>

      {/* Correct answer */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-gray-600">Correct Answer:</span>
        {['A', 'B', 'C', 'D'].map(opt => (
          <button
            key={opt}
            onClick={() => onChange({ ...q, correct_option: opt })}
            className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${q.correct_option === opt ? 'bg-green-500 text-white shadow' : 'bg-gray-100 text-gray-500 hover:bg-green-100'}`}
          >
            {opt}
          </button>
        ))}
        <span className="text-xs text-green-600 font-medium ml-1">✓ {q.correct_option}</span>
      </div>
    </div>
  );
}

// ── Questions Tab ──────────────────────────────────────────────────────────
function QuestionsTab({ onStorageChange }: { onStorageChange: () => void }) {
  const [classes, setClasses] = useState<ClassRecord[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [counts, setCounts] = useState<QuestionCount[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewBank, setPreviewBank] = useState<{ classId: string; subjectId: string; className: string; subjectName: string } | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<any[]>([]);
  const [previewCurrent, setPreviewCurrent] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function openPreview(classId: string, subjectId: string, className: string, subjectName: string) {
    setPreviewLoading(true);
    setPreviewBank({ classId, subjectId, className, subjectName });
    setPreviewCurrent(0);
    const { data } = await supabase.from('questions').select('*').eq('class_id', classId).eq('subject_id', subjectId).order('created_at');
    setPreviewQuestions(data ?? []);
    setPreviewLoading(false);
  }

  // Questions in editor
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
    result.sort((a, b) => a.class_name.localeCompare(b.class_name));
    setCounts(result);
  }
  useEffect(() => { load(); }, []);

  // Excel upload
  async function handleExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!filterClass || !filterSubject) { setErr('Select a class and subject before uploading.'); return; }
    setUploading(true); setErr(''); setMsg('');
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
          if (qt && oa && ob && ['A','B','C','D'].includes(co)) {
            parsed.push({ question_text: qt, option_a: oa, option_b: ob, option_c: oc, option_d: od, correct_option: co, image_url: null, image_preview: null, image_file: null });
          }
        }
        if (parsed.length === 0) {
          setErr('No valid rows found. Ensure columns: question_text, option_a, option_b, option_c, option_d, correct_option');
        } else {
          setQuestions(prev => [...prev, ...parsed]);
          setMsg(`Loaded ${parsed.length} questions from Excel. Review below, then click Save All.`);
        }
      } catch (ex: any) {
        setErr('Failed to read Excel: ' + (ex.message || 'Unknown error'));
      }
      setUploading(false);
    };
    reader.readAsBinaryString(file);
    if (excelRef.current) excelRef.current.value = '';
  }

  function addBlankQuestion() {
    if (!filterClass || !filterSubject) { setErr('Select a class and subject first.'); return; }
    setQuestions(prev => [...prev, emptyQuestion()]);
  }

  function updateQuestion(i: number, updated: EditableQuestion) {
    setQuestions(prev => prev.map((q, idx) => idx === i ? updated : q));
  }

  function deleteQuestion(i: number) {
    setQuestions(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleImagePick(i: number, file: File) {
    // Show preview immediately
    const preview = URL.createObjectURL(file);
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, image_file: file, image_preview: preview } : q));
  }

  async function uploadImageForQuestion(file: File, classId: string, subjectId: string): Promise<string | null> {
    try {
      const compressed = await compressImage(file);
      const filename = `${classId}_${subjectId}_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
      const { data: uploadData, error: upErr } = await supabase.storage
        .from('question-images')
        .upload(filename, compressed, { contentType: 'image/webp', upsert: false });
      if (upErr || !uploadData) return null;
      const { data: urlData } = supabase.storage.from('question-images').getPublicUrl(filename);
      return urlData.publicUrl;
    } catch {
      return null;
    }
  }

  async function saveAll() {
    if (!filterClass || !filterSubject) { setErr('Select a class and subject first.'); return; }
    if (questions.length === 0) { setErr('No questions to save.'); return; }

    // Validate
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) { setErr(`Question ${i + 1} has no text.`); return; }
      if (!q.option_a.trim() || !q.option_b.trim()) { setErr(`Question ${i + 1} must have at least options A and B.`); return; }
      if (!['A','B','C','D'].includes(q.correct_option)) { setErr(`Question ${i + 1} has invalid correct option.`); return; }
    }

    setSaving(true); setErr(''); setMsg('');

    // Upload pending images
    const withUrls: EditableQuestion[] = [];
    for (const q of questions) {
      if (q.image_file) {
        const url = await uploadImageForQuestion(q.image_file, filterClass, filterSubject);
        withUrls.push({ ...q, image_url: url, image_preview: null, image_file: null });
      } else {
        withUrls.push({ ...q, image_preview: null, image_file: null });
      }
    }

    const payload = withUrls.map(q => ({
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c || '',
      option_d: q.option_d || '',
      correct_option: q.correct_option,
      image_url: q.image_url || null,
    }));

    const res = await fetch('/api/admin-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: filterClass, subject_id: filterSubject, questions: payload }),
    });
    const json = await res.json();
    if (!res.ok) { setErr('Save failed: ' + json.error); setSaving(false); return; }
    setMsg(`Saved ${json.count} questions successfully.`);
    setQuestions([]);
    onStorageChange();
    load();
    setSaving(false);
  }

  async function deleteBank(classId: string, subjectId: string) {
    if (!confirm('Delete ALL questions for this class/subject? This is permanent!')) return;
    const res = await fetch('/api/admin-questions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: classId, subject_id: subjectId }),
    });
    const json = await res.json();
    if (!res.ok) setErr(json.error);
    else { setMsg('Questions deleted.'); onStorageChange(); load(); }
  }

  const canAct = !!(filterClass && filterSubject);

  return (
    <div className="space-y-6">
      {/* Upload + editor section */}
      <div className="card">
        <SectionTitle>Questions Editor</SectionTitle>
        <Alert type="success" msg={msg} />
        <Alert type="error" msg={err} />

        {/* Class + Subject selectors */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select className="input w-auto" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
            <option value="">Select Class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input w-auto" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
            <option value="">Select Subject</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {!canAct && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 mb-4">
            Select a class and subject above to upload or add questions.
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 mb-4">
          <label className={`btn-secondary cursor-pointer ${!canAct ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? 'Reading Excel...' : '📊 Upload Excel'}
            <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} disabled={!canAct} />
          </label>
          <button
            onClick={addBlankQuestion}
            className={`btn-secondary ${!canAct ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={!canAct}
          >
            ✏️ Add Question Manually
          </button>
          {questions.length > 0 && (
            <button onClick={() => setQuestions([])} className="btn-secondary text-red-600 border-red-200 bg-red-50">
              🗑 Clear All
            </button>
          )}
        </div>

        {/* Excel format hint */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-xs text-blue-700">
          <p className="font-semibold mb-1">Excel columns (row 1 must be header):</p>
          <p className="font-mono">question_text | option_a | option_b | option_c | option_d | correct_option</p>
          <p className="mt-1">correct_option must be A, B, C or D only. Images cannot be in Excel — add them manually after uploading.</p>
        </div>

        {/* Question list */}
        {questions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-quest-navy">{questions.length} question(s) — Review, edit, then Save</p>
              <button
                onClick={saveAll}
                disabled={saving || !canAct}
                className="btn-primary px-5"
              >
                {saving ? 'Saving...' : `💾 Save All ${questions.length} Questions`}
              </button>
            </div>
            <p className="text-xs text-amber-600">⚠️ Saving will replace ALL existing questions for this class/subject.</p>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {questions.map((q, i) => (
                <QuestionEditor
                  key={i}
                  q={q}
                  index={i}
                  onChange={updated => updateQuestion(i, updated)}
                  onDelete={() => deleteQuestion(i)}
                  onImagePick={file => handleImagePick(i, file)}
                />
              ))}
            </div>
            <button
              onClick={saveAll}
              disabled={saving || !canAct}
              className="btn-primary w-full mt-2"
            >
              {saving ? 'Saving...' : `💾 Save All ${questions.length} Questions`}
            </button>
          </div>
        )}
      </div>

      {/* Question Banks table */}
      <div className="card">
        <SectionTitle>Question Banks</SectionTitle>
        <div className="overflow-x-auto">
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
              {counts.map(c => (
                <tr key={`${c.class_id}_${c.subject_id}`} className="border-b border-blue-50 hover:bg-blue-50/30">
                  <td className="px-3 py-2">{c.class_name}</td>
                  <td className="px-3 py-2">{c.subject_name}</td>
                  <td className="px-3 py-2 text-right font-semibold">{c.count}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => openPreview(c.class_id, c.subject_id, c.class_name, c.subject_name)} className="text-quest-blue hover:text-blue-700 text-xs font-medium">👁 Preview</button>
                      <button onClick={() => deleteBank(c.class_id, c.subject_id)} className="text-red-500 hover:text-red-700 text-xs font-bold">Delete Bank</button>
                    </div>
                  </td>
                </tr>
              ))}
              {counts.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-gray-400 text-sm">No questions uploaded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Question Preview Modal */}
      {previewBank && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4 py-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100">
              <div>
                <p className="font-bold text-quest-navy text-sm">{previewBank.className} — {previewBank.subjectName}</p>
                <p className="text-xs text-gray-400 mt-0.5">Question Preview (as students see it)</p>
              </div>
              <button onClick={() => setPreviewBank(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">✕</button>
            </div>

            {previewLoading ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 py-12">Loading questions...</div>
            ) : previewQuestions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 py-12">No questions found.</div>
            ) : (
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {/* Navigator */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {previewQuestions.map((_: any, idx: number) => (
                    <button key={idx} onClick={() => setPreviewCurrent(idx)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${idx === previewCurrent ? 'bg-quest-navy text-white' : 'bg-blue-50 text-gray-500 hover:bg-blue-100'}`}>
                      {idx + 1}
                    </button>
                  ))}
                </div>

                {/* Question */}
                {(() => {
                  const pq = previewQuestions[previewCurrent];
                  return (
                    <div>
                      <p className="text-sm font-semibold text-quest-navy mb-3 leading-relaxed">
                        {previewCurrent + 1}. {pq.question_text}
                      </p>
                      {pq.image_url && (
                        <img src={pq.image_url} alt="question diagram" className="mb-3 max-h-48 rounded-lg border border-blue-100 object-contain" />
                      )}
                      <div className="space-y-2">
                        {(['A','B','C','D'] as const).map(key => {
                          const text = pq[`option_${key.toLowerCase()}`];
                          if (!text) return null;
                          const isCorrect = pq.correct_option === key;
                          return (
                            <div key={key} className={`flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-sm ${isCorrect ? 'border-green-400 bg-green-50' : 'border-blue-100 bg-white'}`}>
                              <span className={`flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${isCorrect ? 'bg-green-500 text-white' : 'bg-quest-light text-quest-navy'}`}>{key}</span>
                              <span className={isCorrect ? 'text-green-800 font-medium' : 'text-gray-700'}>{text}</span>
                              {isCorrect && <span className="ml-auto text-green-500 text-xs font-bold flex-shrink-0">✓ Answer</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Footer nav */}
            {!previewLoading && previewQuestions.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-blue-50">
                <button onClick={() => setPreviewCurrent(p => Math.max(0, p - 1))} disabled={previewCurrent === 0}
                  className="btn-secondary text-xs px-4 py-2 disabled:opacity-40">← Prev</button>
                <span className="text-xs text-gray-400">{previewCurrent + 1} / {previewQuestions.length}</span>
                <button onClick={() => setPreviewCurrent(p => Math.min(previewQuestions.length - 1, p + 1))} disabled={previewCurrent === previewQuestions.length - 1}
                  className="btn-primary text-xs px-4 py-2 disabled:opacity-40">Next →</button>
              </div>
            )}
          </div>
        </div>
      )}
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
    title: '', class_id: '', subject_id: '', test_type: 'CA 1',
    duration_minutes: 30, total_questions: 20, total_marks: 20,
    start_time: '', end_time: '', test_code: '', randomize_options: false,
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

  function getClassName(id: string) { return classes.find(cl => cl.id === id)?.name ?? id; }
  function getSubjectName(id: string) { return subjects.find(su => su.id === id)?.name ?? id; }

  function startEdit(t: Test) {
    setEditingTest(t);
    setForm({
      title: t.title, class_id: t.class_id, subject_id: t.subject_id, test_type: t.test_type,
      duration_minutes: t.duration_minutes, total_questions: t.total_questions,
      total_marks: (t as any).total_marks ?? t.total_questions,
      start_time: t.start_time ? t.start_time.slice(0, 16) : '',
      end_time: t.end_time ? t.end_time.slice(0, 16) : '',
      test_code: (t as any).test_code ?? '',
      randomize_options: (t as any).randomize_options ?? false,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() { setEditingTest(null); setForm(emptyForm); setErr(''); setMsg(''); }

  async function saveTest(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    const payload: any = {
      ...form,
      test_code: form.test_code.toUpperCase().trim(),
      start_time: form.start_time ? new Date(form.start_time).toISOString() : new Date().toISOString(),
      end_time: form.end_time ? new Date(form.end_time).toISOString() : new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    };
    if (editingTest) payload.id = editingTest.id;

    const res = await fetch('/api/admin-tests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) { setErr('Failed: ' + json.error); return; }
    setMsg(editingTest ? 'Test updated.' : 'Test created.');
    setEditingTest(null); setForm(emptyForm); load();
  }

  async function toggleActive(test: Test) {
    const res = await fetch('/api/admin-tests', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: test.id, is_active: !test.is_active, end_time: test.end_time }),
    });
    if (!res.ok) setErr('Toggle failed');
    else load();
  }

  async function deleteTest(id: string, title: string) {
    if (!confirm(`Delete test "${title}"? ALL results for this test will also be deleted!`)) return;
    const res = await fetch('/api/admin-tests', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (!res.ok) setErr('Delete failed: ' + json.error);
    else { setMsg('Test deleted.'); load(); }
  }

  function formatDT(dt: string) {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  const testTypeOptions = ['CA 1', 'CA 2', 'CA 3', 'Exam', 'Mock Exam', 'Quiz'];

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
            <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mathematics CA 1 — JSS 2" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select className="input" value={form.class_id} onChange={e => setForm({ ...form, class_id: e.target.value })} required>
              <option value="">-- Select --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
            <select className="input" value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} required>
              <option value="">-- Select --</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
            <input
              className="input"
              list="test-type-list"
              value={form.test_type}
              onChange={e => setForm({ ...form, test_type: e.target.value })}
              placeholder="e.g. CA 1, CA 2, Exam"
            />
            <datalist id="test-type-list">
              {testTypeOptions.map(t => <option key={t} value={t} />)}
            </datalist>
            <p className="text-xs text-gray-400 mt-0.5">Type freely or pick a suggestion.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Code <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input font-mono uppercase" placeholder="e.g. ENG001" value={form.test_code} onChange={e => setForm({ ...form, test_code: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Duration (mins)</label>
            <input type="number" className="input" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} required min={1} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">No. of Questions</label>
            <input type="number" className="input" value={form.total_questions} onChange={e => setForm({ ...form, total_questions: Number(e.target.value) })} required min={1} max={50} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
            <input type="number" className="input" value={form.total_marks} onChange={e => setForm({ ...form, total_marks: Number(e.target.value) })} required min={1} />
            <p className="text-xs text-gray-400 mt-0.5">Each correct = {form.total_questions > 0 ? (form.total_marks / form.total_questions).toFixed(1) : '—'} mark(s)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
            <input type="datetime-local" className="input" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
            <input type="datetime-local" className="input" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={(form as any).randomize_options ?? false}
                onChange={e => setForm({ ...form, randomize_options: e.target.checked } as any)}
                className="w-4 h-4 accent-quest-blue"
              />
              <span className="text-sm font-medium text-gray-700">
                🔀 Randomize option order (A/B/C/D shuffled differently for each student)
              </span>
            </label>
          </div>
          <div className="sm:col-span-2 flex gap-3">
            <button type="submit" className="btn-primary">{editingTest ? 'Save Changes' : 'Create Test'}</button>
            {editingTest && <button type="button" onClick={cancelEdit} className="btn-secondary">Cancel</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <SectionTitle>All Tests</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-quest-light text-quest-navy text-left">
                <th className="px-3 py-2 font-semibold">Title</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Code</th>
                <th className="px-3 py-2 font-semibold">Class</th>
                <th className="px-3 py-2 font-semibold">Subject</th>
                <th className="px-3 py-2 font-semibold">Marks</th>
                <th className="px-3 py-2 font-semibold">Window</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {tests.map(t => (
                <tr key={t.id} className="border-b border-blue-50 hover:bg-blue-50/30">
                  <td className="px-3 py-2 font-medium max-w-[160px] truncate">{t.title}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeColor(t.test_type)}`}>{t.test_type}</span>
                  </td>
                  <td className="px-3 py-2">
                    {(t as any).test_code
                      ? <span className="bg-yellow-100 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded font-mono font-bold text-xs">{(t as any).test_code}</span>
                      : <span className="text-gray-300 text-xs">none</span>}
                  </td>
                  <td className="px-3 py-2">{getClassName(t.class_id)}</td>
                  <td className="px-3 py-2">{getSubjectName(t.subject_id)}</td>
                  <td className="px-3 py-2 text-xs">{(t as any).total_marks ?? t.total_questions}/{t.total_questions}q</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{t.start_time ? `${formatDT(t.start_time)} → ${formatDT(t.end_time)}` : '—'}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleActive(t)}
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
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
              {tests.length === 0 && <tr><td colSpan={9} className="text-center py-6 text-gray-400 text-sm">No tests yet.</td></tr>}
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
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [sheetMode, setSheetMode] = useState(false);
  const [sheetClass, setSheetClass] = useState('');
  const [sheetSubject, setSheetSubject] = useState('');
  const [sheetChecked, setSheetChecked] = useState<Set<string>>(new Set());

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

  const testTypes: string[] = Array.from(new Set(filtered.map(r => r.test_type))).sort();

  const broadMap: Record<string, BroadRow> = {};
  filtered.forEach(r => {
    const key = `${r.reg_no}__${r.subject_id}`;
    if (!broadMap[key]) broadMap[key] = { reg_no: r.reg_no, student_name: r.student_name, class_id: r.class_id, subject_id: r.subject_id };
    broadMap[key][r.test_type] = r;
  });
  const broadsheet = Object.values(broadMap).sort((a, b) => a.student_name.localeCompare(b.student_name));

  async function deleteResult(id: string) {
    if (!confirm('Delete this result?')) return;
    const res = await fetch('/api/admin-results', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) setErr('Delete failed');
    else { setMsg('Result deleted.'); load(); }
  }

  async function deleteAllFiltered() {
    if (filtered.length === 0) return;
    if (!confirm(`Delete ALL ${filtered.length} filtered results?`)) return;
    const ids = filtered.map(r => r.id);
    const res = await fetch('/api/admin-results', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const json = await res.json();
    if (!res.ok) setErr('Delete failed: ' + json.error);
    else { setMsg(`Deleted ${json.count} results.`); load(); }
  }

  function scoreCell(r: Result | undefined) {
    if (!r) return <span className="text-gray-300">—</span>;
    const cls = r.percentage >= 50 ? 'text-green-700' : 'text-red-600';
    return <span className={`font-medium ${cls}`}>{r.score}/{r.total} <span className="text-xs">({r.percentage}%)</span></span>;
  }

  function exportBroadsheet() {
    const rows = broadsheet.map((row, i) => {
      const out: any = { '#': i + 1, 'Name': row.student_name, 'Reg No': row.reg_no, 'Class': getClassName(row.class_id), 'Subject': getSubjectName(row.subject_id) };
      testTypes.forEach(tt => {
        const r = row[tt] as Result | undefined;
        out[`${tt} Score`] = r ? `${r.score}/${r.total}` : '';
        out[`${tt} %`] = r ? `${r.percentage}%` : '';
      });
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Broadsheet');
    XLSX.writeFile(wb, 'quest_broadsheet.xlsx');
  }

  // Flexible result sheet
  const sheetResults = results.filter(r => r.class_id === sheetClass && r.subject_id === sheetSubject);
  const availableTypes = Array.from(new Set(sheetResults.map(r => r.test_type))).sort();

  function toggleSheetType(tt: string) {
    setSheetChecked(prev => { const next = new Set(prev); if (next.has(tt)) next.delete(tt); else next.add(tt); return next; });
  }

  const checkedTypes = availableTypes.filter(t => sheetChecked.has(t));
  const sheetStudentMap: Record<string, Record<string, Result>> = {};
  sheetResults.forEach(r => {
    if (!sheetStudentMap[r.reg_no]) sheetStudentMap[r.reg_no] = {};
    sheetStudentMap[r.reg_no][r.test_type] = r;
  });
  const sheetRows = Object.entries(sheetStudentMap).map(([reg_no, typeMap]) => {
    const anyResult = Object.values(typeMap)[0];
    return { reg_no, student_name: anyResult?.student_name ?? '', typeMap };
  }).sort((a, b) => a.student_name.localeCompare(b.student_name));

  function sheetTotal(typeMap: Record<string, Result>) {
    return checkedTypes.reduce((sum, tt) => sum + (typeMap[tt]?.score ?? 0), 0);
  }
  function sheetMaxTotal() {
    return checkedTypes.reduce((sum, tt) => {
      const r = sheetResults.find(r => r.test_type === tt);
      return sum + (r?.total ?? 0);
    }, 0);
  }

  function exportFlexSheet() {
    const rows = sheetRows.map((row, i) => {
      const out: any = { '#': i + 1, 'Name': row.student_name, 'Reg No': row.reg_no };
      checkedTypes.forEach(tt => { const r = row.typeMap[tt]; out[tt] = r ? `${r.score}/${r.total}` : '—'; });
      if (checkedTypes.length > 1) out['Total'] = `${sheetTotal(row.typeMap)}/${sheetMaxTotal()}`;
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Result Sheet');
    XLSX.writeFile(wb, `result_sheet_${getClassName(sheetClass)}_${getSubjectName(sheetSubject)}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <SectionTitle>Results</SectionTitle>
        <Alert type="success" msg={msg} />
        <Alert type="error" msg={err} />
        <div className="flex flex-wrap gap-3 mb-2">
          <select className="input w-auto" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input w-auto" value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
            <option value="">All Subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="flex items-center text-sm text-gray-500">{broadsheet.length} student(s)</span>
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
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Reg No</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2">Subject</th>
                {testTypes.map(tt => (
                  <th key={tt} className="px-3 py-2 whitespace-nowrap">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${typeColor(tt)}`}>{tt}</span>
                  </th>
                ))}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {broadsheet.map((row, i) => (
                <tr key={`${row.reg_no}_${row.subject_id}`} className="border-b border-blue-50 hover:bg-blue-50/30">
                  <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-quest-navy">{row.student_name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.reg_no}</td>
                  <td className="px-3 py-2">{getClassName(row.class_id)}</td>
                  <td className="px-3 py-2">{getSubjectName(row.subject_id)}</td>
                  {testTypes.map(tt => (
                    <td key={tt} className="px-3 py-2">{scoreCell(row[tt] as Result | undefined)}</td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <div className="flex gap-1 justify-end flex-wrap">
                      {testTypes.map(tt => {
                        const r = row[tt] as Result | undefined;
                        if (!r) return null;
                        return <button key={tt} onClick={() => deleteResult(r.id)} className="text-red-400 text-xs hover:text-red-600">Del {tt}</button>;
                      })}
                    </div>
                  </td>
                </tr>
              ))}
              {broadsheet.length === 0 && <tr><td colSpan={6 + testTypes.length} className="text-center py-8 text-gray-400 text-sm">No results found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-quest-navy">Flexible Result Sheet</h3>
          <button onClick={() => setSheetMode(!sheetMode)} className="btn-secondary text-xs py-1.5 px-3">
            {sheetMode ? 'Hide' : 'Build Result Sheet'}
          </button>
        </div>
        {sheetMode && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <select className="input w-auto" value={sheetClass} onChange={e => { setSheetClass(e.target.value); setSheetChecked(new Set()); }}>
                <option value="">Select Class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="input w-auto" value={sheetSubject} onChange={e => { setSheetSubject(e.target.value); setSheetChecked(new Set()); }}>
                <option value="">Select Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {sheetClass && sheetSubject && availableTypes.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No results for this class/subject combination.</p>
            )}

            {availableTypes.length > 0 && (
              <>
                <div className="flex flex-wrap gap-3 mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-quest-navy w-full mb-1">Select test types to include:</p>
                  {availableTypes.map(tt => (
                    <label key={tt} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded" checked={sheetChecked.has(tt)} onChange={() => toggleSheetType(tt)} />
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeColor(tt)}`}>{tt}</span>
                    </label>
                  ))}
                </div>

                {checkedTypes.length > 0 && (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-quest-navy text-white text-left">
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Reg No</th>
                            {checkedTypes.map(tt => (
                              <th key={tt} className="px-3 py-2 whitespace-nowrap">
                                <span className={`px-1.5 py-0.5 rounded text-xs ${typeColor(tt)}`}>{tt}</span>
                              </th>
                            ))}
                            {checkedTypes.length > 1 && <th className="px-3 py-2 font-semibold">Total</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {sheetRows.map((row, i) => (
                            <tr key={row.reg_no} className="border-b border-blue-50">
                              <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                              <td className="px-3 py-2 font-medium text-quest-navy">{row.student_name}</td>
                              <td className="px-3 py-2 font-mono text-xs">{row.reg_no}</td>
                              {checkedTypes.map(tt => {
                                const r = row.typeMap[tt];
                                return <td key={tt} className="px-3 py-2">{r ? `${r.score}/${r.total}` : '—'}</td>;
                              })}
                              {checkedTypes.length > 1 && (
                                <td className="px-3 py-2 font-bold text-quest-navy">{sheetTotal(row.typeMap)}/{sheetMaxTotal()}</td>
                              )}
                            </tr>
                          ))}
                          {sheetRows.length === 0 && <tr><td colSpan={3 + checkedTypes.length + (checkedTypes.length > 1 ? 1 : 0)} className="text-center py-6 text-gray-400">No data.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-3 mt-3">
                      <button onClick={exportFlexSheet} className="btn-secondary text-sm py-1.5 px-4">Export Excel</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
