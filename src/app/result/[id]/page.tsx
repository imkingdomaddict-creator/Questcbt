'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResultPage() {
  const params = useParams()
  const router = useRouter()
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('results').select('*').eq('id', params.id).single()
      setResult(data)
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-quest-light">
      <div className="w-12 h-12 border-4 border-quest-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!result) return (
    <div className="min-h-screen flex items-center justify-center bg-quest-light">
      <p className="text-gray-500">Result not found.</p>
    </div>
  )

  const passed = result.percentage >= 50

  return (
    <div className="min-h-screen bg-quest-light flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="card text-center">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 ${passed ? 'bg-green-100' : 'bg-red-100'}`}>
            <span className={`text-3xl font-black ${passed ? 'text-green-600' : 'text-red-600'}`}>
              {result.percentage}%
            </span>
          </div>

          <div className={`inline-block px-4 py-1 rounded-full text-sm font-bold mb-4 ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {passed ? '✓ PASSED' : '✗ FAILED'}
          </div>

          <h2 className="text-xl font-black text-quest-navy mb-1">{result.student_name}</h2>
          <p className="text-gray-500 text-sm mb-6">{result.reg_no}</p>

          <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-left mb-6">
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">Score</span>
              <span className="font-bold text-quest-navy">{result.score} / {result.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">Test Type</span>
              <span className="font-bold text-quest-navy">{result.test_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">Date</span>
              <span className="font-bold text-quest-navy">{new Date(result.created_at).toLocaleDateString()}</span>
            </div>
          </div>

          <button onClick={() => router.push('/')} className="btn-primary w-full">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
