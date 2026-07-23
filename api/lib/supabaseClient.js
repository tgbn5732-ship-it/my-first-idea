// Supabase Client 초기화 모듈: api/lib/supabaseClient.js
// Vercel 환경변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)를 읽어 Supabase 인스턴스를 생성합니다.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase Alert] SUPABASE 환경변수가 설정되지 않았거나 로딩 중입니다.');
}

// 1. 일반 사용자/클라이언트용 Supabase 인스턴스 (ANON KEY)
export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseAnonKey || 'placeholder'
);

// 2. 서버 전용 강력한 관리자 권한 Supabase 인스턴스 (SERVICE ROLE KEY)
export const supabaseAdmin = createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseServiceRoleKey || supabaseAnonKey || 'placeholder',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export default supabase;
