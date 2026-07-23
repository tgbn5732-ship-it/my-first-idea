// Vercel Serverless Function: api/analyze.js
// Gemini API로 감정을 분석하고, 결과를 Serverless Redis(REDIS_URL)에 고유 시간 키로 자동 저장합니다.

import Redis from 'ioredis';

// 싱글톤 Redis 클라이언트 생성 함수
let redisClient = null;

function getRedisClient() {
    const redisUrl = process.env.REDIS_URL || process.env.STORAGE_URL || process.env.STORAGE_REDIS_URL || process.env.KV_URL;
    if (!redisUrl) {
        return null;
    }
    if (!redisClient) {
        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 1,
            connectTimeout: 5000,
            lazyConnect: true
        });
    }
    return redisClient;
}

// 현재 시간 기준 고유 키 생성 함수 (예: diary-20260723152000123)
function generateDiaryKey() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `diary-${yyyy}${mm}${dd}${hh}${mi}${ss}${ms}`;
}

export default async function handler(req, res) {
    // 1. CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. POST 요청만 허용됩니다.' });
    }

    try {
        // 2. 일기 내용 가져오기
        let bodyData = req.body;
        if (typeof bodyData === 'string') {
            try { bodyData = JSON.parse(bodyData); } catch (e) {}
        }
        
        const diary = bodyData?.diary || bodyData?.diaryContent;

        if (!diary || diary.trim() === '') {
            return res.status(400).json({ error: '분석할 일기 내용을 입력해 주세요.' });
        }

        // 3. 환경변수 GEMINI_API_KEY 확인
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error('SERVER ERROR: Vercel process.env.GEMINI_API_KEY가 없습니다.');
            return res.status(500).json({ 
                error: 'Vercel 서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다.' 
            });
        }

        // 4. 심리상담가 프롬프트 정의
        const prompt = `너는 타인의 마음 깊은 곳을 섬세하게 읽어내는 공감 전문 심리상담가야. 
아래 사용자가 적은 일기를 정밀 분석해줘.

일기 내용:
"${diary.trim()}"

[분석 및 작성 규칙]
1. 단순 겉표면 단어나 고정 틀에 얽매이지 말고, 일기 속 상황(예: 덥고 습한 날씨, 코딩 공부, 참고 계속함, 옛 친구 이야기 등)과 구체적인 단어를 반드시 언급하며 깊이 공감해줘.
2. 덥고 힘든 환경에서도 참고 계속 공부하는 일기라면 '인내', '의지', '끈기', '열정' 등의 단어로 감정을 짚어내고, 힘들고 안타까운 일기라면 '안타까움', '마음아픔' 등으로 세밀하게 감정을 요약해줘.
3. 첫 줄은 반드시 '감정: [정밀 분석된 감정 한 단어]' 형식으로 작성해줘.
4. 첫 줄 뒤에는 줄바꿈 2번(\\n\\n)을 넣고, 사용자가 적은 상황에 꼭 맞는 다정하고 따뜻한 심리 상담 응원 메시지를 2~3문장으로 작성해줘.

답변 형식:
감정: [요약된감정]

[응원 메시지]`;

        // 5. Gemini API 호출
        const flashUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const geminiResponse = await fetch(flashUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.75,
                    topP: 0.95
                }
            })
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json().catch(() => ({}));
            return res.status(geminiResponse.status).json({ 
                error: errorData.error?.message || 'Gemini API 호출 실패' 
            });
        }

        const data = await geminiResponse.json();
        const aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiReply) {
            return res.status(500).json({ error: 'AI 응답 결과를 읽을 수 없습니다.' });
        }

        const trimmedReply = aiReply.trim();
        const diaryKey = generateDiaryKey();

        // 6. Serverless Redis (REDIS_URL)에 일기 내용과 AI 답변 묶음 저장
        try {
            const redis = getRedisClient();
            if (redis) {
                if (redis.status === 'wait') {
                    await redis.connect();
                }
                
                const recordData = {
                    id: diaryKey,
                    diary: diary.trim(),
                    result: trimmedReply,
                    createdAt: new Date().toISOString()
                };

                await redis.set(diaryKey, JSON.stringify(recordData));
                console.log(`[Redis 저장 완료] Key: ${diaryKey}`);
            } else {
                console.log('REDIS_URL 환경변수를 찾을 수 없어 DB 저장을 스킵합니다.');
            }
        } catch (dbError) {
            console.error('[Redis 저장 예외 발생]:', dbError.message);
        }

        // 7. 성공 결과 반환 (생성된 저장 키 포함)
        return res.status(200).json({
            result: trimmedReply,
            savedKey: diaryKey
        });

    } catch (error) {
        console.error('Vercel Serverless Function Error:', error);
        return res.status(500).json({ 
            error: error.message || '서버 내부 처리 중 오류가 발생했습니다.' 
        });
    }
}
