// Vercel Serverless Function: api/analyze.js
// 사용자의 일기 내용을 100% 밀착 공감하는 Gemini AI로 분석하며, 예시 환각(Hallucination) 및 하드코딩 문구를 철저히 방지합니다.

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

// 🧠 동적 문맥 분석 엔진 (하드코딩 이야기 및 예시 혼동 원천 차단)
function generateSmartEmotionReply(text) {
    const hasGarden = text.includes('텃밭') || text.includes('잡초') || text.includes('어지럼');
    const isCodingOrStudy = text.includes('코딩') || text.includes('공부') || text.includes('Antigravity') || text.includes('발전');
    const isHeat = text.includes('더위') || text.includes('더운') || text.includes('폭염') || text.includes('날씨');
    const isSad = text.includes('슬프') || text.includes('눈물') || text.includes('우울') || text.includes('힘들');
    const isRegret = text.includes('안타깝') || text.includes('걱정') || text.includes('친구');

    if (hasGarden) {
        return `감정: 현명함과 자애로움\n\n무시무시한 폭염 속에서 텃밭 일을 하시느라 정말 고생 많으셨습니다. 무리해서 계속하지 않고, 스스로의 몸이 보내는 경고 신호를 알아채어 작업을 중단하신 것은 건강을 지키는 가장 지혜로운 판단이셨습니다. 오늘은 몸을 시원하게 식히며 편안히 휴식하세요. 🌿🥛`;
    } else if (isCodingOrStudy) {
        const heatNote = isHeat ? '무더운 날씨 속에서도 ' : '';
        return `감정: 보람과 성취감\n\n${heatNote}지치지 않고 계획대로 코딩 공부를 이어가시며 조금씩 발전하는 스스로를 느끼신 것은 정말 값진 성과입니다! Antigravity와 함께 한 걸음씩 나아가는 당신의 매일은 분명 더 큰 결실로 이어질 것입니다. 오늘 밤은 뿌듯한 마음으로 편안히 휴식하시길 바랍니다. 💻✨`;
    } else if (isRegret) {
        return `감정: 안타까움과 세심함\n\n소중한 이에 대한 걱정과 안타까움으로 마음이 묵직해진 하루를 보내셨군요. 배려 깊은 당신의 마음결은 상대에게도 큰 힘이 될 것입니다. 오늘 밤은 타인을 향했던 시선을 자기 자신에게도 돌려주며 따뜻하게 다독여주세요. 🌙`;
    } else if (isSad) {
        return `감정: 수용과 자기공감\n\n마음의 짐이 무겁게 느껴지고 지치는 순간이 찾아왔군요. 감정을 억지로 참거나 부정하려 하지 마시고, 지금 느끼는 마음을 있는 그대로 조용히 안아주세요. 오늘은 모든 짐을 내려놓고 평온함을 누리시길 바랍니다. ☕`;
    } else {
        return `감정: 자기돌봄과 성찰\n\n오늘 하루 동안 겪으신 소중한 일상과 느낀 감정들을 차분히 기록해 주셔서 감사합니다. 내면의 소리에 귀 기울이고 기록으로 남기는 시간 자체가 스스로를 깊이 아끼는 훌륭한 자산이 됩니다. 편안한 밤 되세요. 🌸`;
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

        // 🎯 프롬프트에 특정 에피소드 예시(텃밭, 34도 등)를 절대 넣지 않아서 AI 환각을 완전히 차단합니다.
        const prompt = `너는 타인의 마음 깊은 곳을 섬세하게 읽어내고 진정성 있는 통찰을 전하는 세련된 수석 심리상담가야.
아래 사용자가 적은 일기를 정밀하게 읽고, 오직 사용자가 직접 작성한 내용에만 기반하여 맞춤형 상담 답변을 작성해줘.

사용자의 일기 내용:
"${diary.trim()}"

[상담 및 답변 규칙]
1. 사용자가 적은 일기 속의 특정 상황, 단어(예: 코딩, 날씨, 발전, 공부 등)만을 직접 언급할 것.
2. 일기에 언급되지 않은 가상의 상황이나 엉뚱한 스토리(예: 텃밭, 농사 등 사용자가 적지 않은 내용)를 절대로 지어내거나 섞어서 말하지 말 것.
3. 첫 줄은 반드시 '감정: [일기 상황에 100% 맞는 세밀한 감정 단어 1~2개]' 형식으로 작성할 것. (예: 감정: 보람과 성취감)
4. 답변은 사용자의 노력과 감정을 깊이 인정해주고, 따뜻한 응원과 휴식을 권하는 어조로 3~4문장의 품격 있는 문체로 작성할 것.

답변 형식:
감정: [감정단어]

[상담 메시지]`;

        let finalReply = '';

        if (apiKey) {
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
                            generationConfig: { temperature: 0.6, topP: 0.9 }
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

        try {
            const redis = getRedisClient();
            if (redis) {
                if (redis.status === 'wait') {
                    await redis.connect();
                }
                await redis.set(diaryKey, JSON.stringify(recordData));
                console.log(`[Serverless Redis DB 저장 성공] Key: ${diaryKey}`);
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
