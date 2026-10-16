'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { shuffleArray } from '@/lib/utils'
import type { Question } from '@/lib/supabase'

export default function TestPage() {
  const router = useRouter()
  const params = useParams()
  const testId = params.id as string

  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [current, setCurrent] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [test, setTest] = useState<any>(null)
  const [student, setStudent] = useState<any>(null)
  const submitted = useRef(false)

  const submitTest = useCallback(async (ans: Record<string, string>) => {
    if (submitted.current) return
    submitted.current = true
    setSubmitting(true)

    const s = sessionStorage.getItem('quest_student')
    const t = sessionStorage.getItem('quest_test')
    if (!s || !t) { router.push('/'); return }
    const studentData = JSON.parse(s)
    const testData = JSON.parse(t)

    let score = 0
    questions.forEach((q: Question) => {
      if (ans[q.id] === q.correct_option) score++
    })
    const total = questions.length
    const pct = total > 0 ? Math.round((score / total) * 100) : 0

    const { data: result } = await supabase.from('results').insert({
      test_id: testId,
      reg_no: studentData.reg_no,
      student_name: studentData.full_name,
      class_id: studentData.class_id,
      subject_id: studentData.subject_id,
      test_type: testData.test_type,
      score, total, percentage: pct
    }).select().single()

    sessionStorage.removeItem('quest_test')
    if (result) router.push(`/result/${result.id}`)
    else router.push('/')
  }, [questions, testId, router])

  useEffect(() => {
    const s = sessionStorage.getItem('quest_student')
    const t = sessionStorage.getItem('quest_test')
    if (!s || !t) { router.push('/'); return }
    const studentData = JSON.parse(s)
    const testData = JSON.parse(t)
    setStudent(studentData)
    setTest(testData)

    const endTime = new Date(testData.end_time).getTime()
    const now = Date.now()
    const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
    setTimeLeft(Math.min(remaining, testData.duration_minutes * 60))

    async function loadQuestions() {
      const { data } = await supabase.from('questions')
        .select('*')
        .eq('class_id', testData.class_id)
        .eq('subject_id', testData.subject_id)
      const pool = shuffleArray(data || []).slice(0, testData.total_questions)
      setQuestions(pool)
      setLoading(false)
    }
    loadQuestions()
  }, [router, testId])

  useEffect(() => {
    if (loading || timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          submitTest(answers)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [loading, answers, submitTest, timeLeft])

  useEffect(() => {
    const block = (e: Event) => e.preventDefault()
    document.addEventListener('contextmenu', block)
    document.addEventListener('copy', block)
    document.addEventListener('cut', block)
    document.addEventListener('paste', block)
    return () => {
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('copy', block)
      document.removeEventListener('cut', block)
      document.removeEventListener('paste', block)
    }
  }, [])

  function formatTime(s: number) {
    const m = Math.floor(s / 60), sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  function selectAnswer(qId: string, opt: string) {
    setAnswers(prev => ({ ...prev, [qId]: opt }))
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-quest-light">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-quest-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-quest-navy font-semibold">Loading questions...</p>
      </div>
    </div>
  )

  if (submitting) return (
    <div className="min-h-screen flex items-center justify-center bg-quest-light">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-green-700 font-semibold">Submitting your answers...</p>
      </div>
    </div>
  )

  const q = questions[current]
  const answered = Object.keys(answers).length
  const isLow = timeLeft < 60

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ userSelect: 'none' }}>
      <div className="bg-quest-navy text-white sticky top-0 z-10 shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">{test?.title}</p>
            <p className="text-blue-300 text-xs">{student?.full_name} · {student?.reg_no}</p>
          </div>
          <div className={`text-xl font-black px-3 py-1 rounded-lg ${isLow ? 'bg-red-500 animate-pulse' : 'bg-quest-blue'}`}>
            {formatTime(timeLeft)}
          </div>
        </div>
        <div className="h-1 bg-quest-blue">
          <div className="h-1 bg-yellow-400 transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-600">Question {current + 1} of {questions.length}</span>
          <span className="text-xs text-gray-500">{answered} answered</span>
        </div>

        <div className="card mb-4">
          <p className="text-gray-800 font-medium leading-relaxed">{q.question_text}</p>
        </div>

        <div className="space-y-3 mb-6">
          {(['A', 'B', 'C', 'D'] as const).map(opt => {
            const optText = q[`option_${opt.toLowerCase()}` as keyof Question] as string
            const isSelected = answers[q.id] === opt
            return (
              <button key={opt} onClick={() => selectAnswer(q.id, opt)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-start gap-3
                  ${isSelected ? 'border-quest-blue bg-quest-light text-quest-navy font-semibold' : 'border-gray-200 bg-white hover:border-quest-blue hover:bg-quest-light'}`}>
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                  ${isSelected ? 'bg-quest-blue text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {opt}
                </span>
                <span className="text-sm leading-relaxed pt-0.5">{optText}</span>
              </button>
            )
          })}
        </div>

        <div className="flex gap-3 mb-6">
          <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
            className="btn-secondary flex-1 disabled:opacity-40">← Prev</button>
          {current < questions.length - 1
            ? <button onClick={() => setCurrent(c => c + 1)} className="btn-primary flex-1">Next →</button>
            : <button onClick={() => submitTest(answers)} className="btn-primary flex-1 bg-green-600 hover:bg-green-700" disabled={submitting}>
                Submit Test ✓
              </button>
          }
        </div>

        <div className="card">
          <p className="text-xs font-semibold text-gray-500 mb-3">Question Navigator</p>
          <div className="flex flex-wrap gap-2">
            {questions.map((q2: Question, i: number) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-9 h-9 rounded-lg text-xs font-bold border-2 transition-all
                  ${i === current ? 'border-quest-blue bg-quest-blue text-white'
                  : answers[q2.id] ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-white text-gray-600'}`}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
