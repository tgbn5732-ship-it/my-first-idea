// Vercel Serverless Function: api/supabase-config.js
// root config.js 파일 충돌 없이 Supabase 퍼블릭 URL 및 ANON KEY를 100% 보장 응답합니다.

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const envKeys = Object.keys(process.env);

        let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
        if (!supabaseUrl) {
            const urlKey = envKeys.find(k => k.toUpperCase().includes('SUPABASE') && k.toUpperCase().includes('URL'));
            if (urlKey) supabaseUrl = process.env[urlKey];
        }

        let supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
        if (!supabaseAnonKey) {
            const anonKey = envKeys.find(k => k.toUpperCase().includes('SUPABASE') && (k.toUpperCase().includes('ANON') || k.toUpperCase().includes('PUBLISHABLE') || k.toUpperCase().includes('KEY')) && !k.toUpperCase().includes('SERVICE'));
            if (anonKey) supabaseAnonKey = process.env[anonKey];
        }

        return res.status(200).json({
            supabaseUrl: (supabaseUrl || '').trim(),
            supabaseAnonKey: (supabaseAnonKey || '').trim()
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
