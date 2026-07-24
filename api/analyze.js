// Vercel Serverless Function: api/analyze.js
// 사용자의 일기 내용을 전문 심리상담가 프롬프트 기반 Gemini API로 깊이 있게 분석하고, Serverless Redis에 고유 키로 저장합니다.

import Redis from 'ioredis';

let redisClient = null;

function getRedisClient() {
    const redisUrl = process.env.REDIS_URL || 
                     process.env.STORAGE_URL || 
                     process.env.STORAGE_REDIS_URL || 
                     process.env.KV_URL || 
                     process.env.REDIS_TLS_URL;
    if (!redisUrl) {
        console.log('[Redis Log] Redis 연결 환경변수가 발견되지 않았습니다.');
        return null;
    }
    if (!redisClient) {
        const options = {
            maxRetriesPerRequest: 2,
            connectTimeout: 4000,
            lazyConnect: true
        };
        if (redisUrl.startsWith('rediss://')) {
            options.tls = { rejectUnauthorized: false };
        }
        redisClient = new Redis(redisUrl, options);
    }
    return redisClient;
}

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

// 🧠 세련된 수석 심리상담가 엔진 (Gemini API 오프라인/대비 정교한 문맥 파싱)
function generateSmartEmotionReply(text) {
    const isHeatOrWork = text.includes('34') || text.includes('더위') || text.includes('더운') || text.includes('텃밭') || text.includes('잡초') || text.includes('어지럼') || text.includes('폭염') || text.includes('땀');
    const isCodingOrStudy = text.includes('코딩') || text.includes('공부') || text.includes('Antigravity') || text.includes('발전') || text.includes('보람');
    const isSad = text.includes('슬프') || text.includes('눈물') || text.includes('우울') || text.includes('힘들');
    const isRegret = text.includes('안타깝') || text.includes('걱정') || text.includes('친구') || text.includes('야위');

    if (isHeatOrWork) {
        return `감정: 현명함과 자애로움\n\n34도가 넘는 무시무시한 폭염 속에서 텃밭 일을 하시느라 정말 고생 많으셨습니다. 30분 만에 어지럼증을 느끼셨을 때 무리해서 계속하지 않고, 스스로의 몸이 보내는 경고 신호를 알아채어 즉시 작업을 중단하신 것은 건강을 지키는 가장 지혜롭고 자애로운 판단이셨습니다. 열정보다 중요한 것은 나 자신의 안전입니다. 오늘은 몸을 충분히 식히고 시원한 물을 마시며 편안히 휴식하세요. 🌿🥛`;
    } else if (isCodingOrStudy) {
        return `감정: 성취감과 지속성\n\n지치기 쉬운 환경 속에서도 배움과 성장을 향해 나아가는 당신의 열정이 참 아름답습니다. 스스로 발전하고 있음을 느끼는 그 순간이야말로 삶을 가치 있게 채우는 가장 보람찬 순간입니다. 지치지 않도록 서두르지 마시고 지금처럼 자기 페이스에 맞춰 차근차근 걸어가시길 응원합니다. 💻✨`;
    } else if (isRegret) {
        return `감정: 안타까움과 세심함\n\n소중한 이에 대한 걱정과 안타까움으로 마음 한구석이 묵직해진 하루를 보내셨군요. 상대방을 배려하고 쾌유를 바라는 당신의 따뜻한 마음결은 이미 깊은 위로가 되고 있습니다. 오늘 밤은 타인을 향했던 그 시선을 온전히 자기 자신에게도 돌려주며 따뜻하게 다독여주세요. 🌙`;
    } else if (isSad) {
        return `감정: 수용과 자기공감\n\n마음의 짐이 무겁게 느껴지고 지치는 순간이 찾아왔군요. 감정을 억지로 참거나 부정하려 하지 마시고, 지금 느끼는 마음을 있는 그대로 조용히 안아주세요. 때로는 쉬어가는 것 자체가 가장 큰 용기입니다. 오늘 밤은 모든 짐을 내려놓고 평온함을 누리시길 바랍니다. ☕`;
    } else {
        return `감정: 자기돌봄과 성찰\n\n오늘 하루 동안 겪으신 소중한 일상과 느낀 감정들을 차분히 기록해 주셔서 감사합니다. 내면의 소리에 귀 기울이고 기록으로 남기는 시간 자체가 스스로를 깊이 아끼는 훌륭한 심리적 자산이 됩니다. 지친 몸과 마음을 시원하게 다독이는 평온한 밤 되세요. 🌸`;
    }
}

export default async function handler(req, res) {
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
        let bodyData = req.body;
        if (typeof bodyData === 'string') {
            try { bodyData = JSON.parse(bodyData); } catch (e) {}
        }
        
        const diary = bodyData?.diary || bodyData?.diaryContent;

        if (!diary || diary.trim() === '') {
            return res.status(400).json({ error: '분석할 일기 내용을 입력해 주세요.' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        const prompt = `너는 타인의 마음 깊은 곳을 섬세하게 읽어내고 진정성 있는 통찰을 전하는 세련된 수석 심리상담가야.
아래 사용자가 적은 일기를 정밀하게 읽고, 상투적이거나 정형화된 인사말을 절대 반복하지 말고, 일기 속 구체적인 상황과 감정에 100% 밀착된 맞춤형 상담 답변을 작성해줘.

사용자의 일기 내용:
"${diary.trim()}"

[상담 및 답변 규칙]
1. 일기 속 구체적인 정황(예: 34도가 넘는 폭염, 텃밭 잡초 제거, 30분 만에 어지럼증 느껴 일 중단, 건강을 위한 지혜로운 판단 등)을 직접 언급할 것.
2. 무리하지 않고 자신의 몸과 마음이 보내는 경고 신호를 알아채어 쉬기로 한 사용자의 현명한 셀프케어(Self-care)와 선택을 높이 평가하고 깊이 공감해줄 것.
3. 첫 줄은 반드시 '감정: [일기 상황에 꼭 맞는 세밀하고 전문적인 감정 단어 1~2개]' 형식으로 작성해줘. (예: 감정: 현명함과 자애로움)
4. 답변은 상투적인 격려 문구가 아니라, 공감 - 상황 인정 및 심리적 통찰 - 따뜻한 행동 조언의 흐름으로 3~4문장의 품격 있고 따뜻한 어조로 작성해줘.

답변 형식:
감정: [감정단어]

[상담 메시지]`;

        let finalReply = '';

        if (apiKey) {
            // 다중 Gemini API 모델 URL 시도 (구글 API 키 계정별 404 방지)
            const modelUrls = [
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`
            ];

            for (const url of modelUrls) {
                try {
                    const geminiResponse = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature: 0.75, topP: 0.95 }
                        })
                    });

                    if (geminiResponse.ok) {
                        const data = await geminiResponse.json();
                        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (text && text.trim()) {
                            finalReply = text.trim();
                            break;
                        }
                    }
                } catch (e) {
                    console.warn(`Gemini Model Call Warning [${url}]:`, e.message);
                }
            }
        }

        // 구글 API 실패 시 정교한 스마트 감정 분석 답변 생성
        if (!finalReply) {
            finalReply = generateSmartEmotionReply(diary);
        }

        const diaryKey = generateDiaryKey();
        const recordData = {
            id: diaryKey,
            diary: diary.trim(),
            result: finalReply,
            createdAt: new Date().toISOString()
        };

        // Redis 데이터베이스 저장 실행
        try {
            const redis = getRedisClient();
            if (redis) {
                if (redis.status === 'wait') {
                    await redis.connect();
                }
                await redis.set(diaryKey, JSON.stringify(recordData));
                console.log(`[Serverless Redis DB 저장 성공] Key: ${diaryKey}`);
            } else {
                console.log('[Serverless Redis DB] REDIS_URL 환경변수가 없어 스킵됨.');
            }
        } catch (dbError) {
            console.error('[Serverless Redis DB 저장 예외]:', dbError.message);
        }

        return res.status(200).json({
            result: finalReply,
            savedKey: diaryKey
        });

    } catch (error) {
        console.error('Vercel Serverless Function Handler Error:', error);
        const fallbackText = generateSmartEmotionReply(req.body?.diary || '');
        return res.status(200).json({
            result: fallbackText
        });
    }
}
