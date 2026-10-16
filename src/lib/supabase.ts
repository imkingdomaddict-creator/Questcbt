import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wcsrbvyvtcdskbpngves.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indjc3Jidnl2dGNkc2ticG5ndmVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMDY2NjEsImV4cCI6MjEwNzY4MjY2MX0._vkqal0yh82Z0PtsQRtK76Iz2sSmgSYV08b2mx1JSuA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Question {
  id: string;
  class_id: string;
  subject_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  created_at: string;
}

export interface ClassRecord {
  id: string;
  name: string;
  created_at: string;
}

export interface Subject {
  id: string;
  name: string;
  created_at: string;
}

export interface Student {
  id: string;
  reg_no: string;
  full_name: string;
  class_id: string;
  created_at: string;
}

export interface Test {
  id: string;
  title: string;
  class_id: string;
  subject_id: string;
  test_type: string;
  duration_minutes: number;
  total_questions: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
}

export interface Result {
  id: string;
  test_id: string;
  reg_no: string;
  student_name: string;
  class_id: string;
  subject_id: string;
  test_type: string;
  score: number;
  total: number;
  percentage: number;
  created_at: string;
}
