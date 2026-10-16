'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [regNo, setRegNo] = useState('')
  const [classId, setClassId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [classes, setClasses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: cls } = await supabase.from('classes').select('*').order('name')
      const { data: sub } = await supabase.from('subjects').select('*').order('name')
      setClasses(cls || [])
      setSubjects(sub || [])
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: student } = await supabase
      .from('students')
      .select('*')
      .eq('reg_no', regNo.trim().toUpperCase())
      .eq('class_id', classId)
      .single()

    if (!student) {
      setError('Student not found. Check your Reg Number and Class.')
      setLoading(false)
      return
    }

    if (student.full_name.toLowerCase() !== fullName.trim().toLowerCase()) {
      setError('Name does not match our records.')
      setLoading(false)
      return
    }

    const { data: test } = await supabase
      .from('tests')
      .select('*')
      .eq('is_active', true)
      .eq('class_id', classId)
      .eq('subject_id', subjectId)
      .single()

    if (!test) {
      setError('No active test found for your class and subject.')
      setLoading(false)
      return
    }

    sessionStorage.setItem('quest_student', JSON.stringify({
      full_name: student.full_name,
      reg_no: student.reg_no,
      class_id: student.class_id,
      subject_id: subjectId,
    }))
    sessionStorage.setItem('quest_test', JSON.stringify(test))

    router.push(`/test/${test.id}`)
  }

  return (
    <div className="min-h-screen bg-quest-light flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-quest-blue rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-black">Q</span>
          </div>
          <h1 className="text-2xl font-black text-quest-navy">Quest CBT</h1>
          <p className="text-gray-500 text-sm mt-1">Computer Based Test Platform</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-bold text-quest-navy mb-6">Student Login</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                className="input"
                placeholder="Enter your full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Reg Number</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. QC/2024/001"
                value={regNo}
                onChange={e => setRegNo(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Class</label>
              <select
                className="input"
                value={classId}
                onChange={e => setClassId(e.target.value)}
                required
              >
                <option value="">Select your class</option>
                {classes.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Subject</label>
              <select
                className="input"
                value={subjectId}
                onChange={e => setSubjectId(e.target.value)}
                required
              >
                <option value="">Select subject</option>
                {subjects.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Start Test'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
