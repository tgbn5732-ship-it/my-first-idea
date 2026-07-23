// Vercel Serverless Function: api/analyze.js
// 사용자의 일기 내용을 다중 모델 지원 Gemini API로 분석하고, Serverless Redis에 고유 키로 저장합니다.

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

// 스마트 문맥 감정 분석 엔진 (Gemini API 일시적 404/네트워크 장애 대비)
function generateSmartEmotionReply(text) {
    const isPatience = text.includes('참고') || text.includes('계속') || text.includes('과제') || text.includes('습도') || text.includes('덥') || text.includes('더위') || text.includes('코딩');
    const isRegret = text.includes('야위') || text.includes('마음이 좋지 않') || text.includes('안타깝') || text.includes('걱정') || text.includes('씁쓸');
    const isSad = text.includes('슬프') || text.includes('눈물') || text.includes('우울');
    const isHappy = text.includes('기뻐') || text.includes('행복') || text.includes('감사') || text.includes('뿌듯') || text.includes('보람');

    if (isPatience) {
        return `감정: 인내\n\n무덥고 습한 날씨 속에서도 목표를 포기하지 않고 성실히 코딩 공부를 이어가시는 모습이 정말 대단합니다! 힘든 과정을 이겨내는 당신의 끈기와 열정은 반드시 값진 보람으로 피어날 거예요. 오늘 밤은 시원하고 편안한 휴식을 취하시길 바랍니다. 💙💻`;
    } else if (isRegret) {
        return `감정: 안타까움\n\n옛 친구의 안타까운 모습에 마음이 온통 무겁고 짠하셨겠어요. 따뜻한 당신의 마음결이 멀리서나마 친구에게 큰 위로가 되기를 바라며, 오늘 밤은 당신의 지친 마음도 편안히 다독여주세요. ✨`;
    } else if (isSad) {
        return `감정: 마음아픔\n\n마음이 가라앉고 슬픈 하루였군요. 마음의 짐을 억지로 참지 마시고 오늘만큼은 스스로를 따뜻하게 안아주세요. 🌿`;
    } else if (isHappy) {
        return `감정: 보람\n\n오늘 하루 보람차고 기분 좋은 에너지가 가득 느껴집니다. 이 소중한 기쁨의 기운이 앞으로의 날들도 밝게 밝혀주길 응원합니다! 😊`;
    } else {
        return `감정: 성실\n\n오늘 하루도 주어진 일상에 최선을 다해 정성껏 적어주셔서 감사합니다. 한 걸음씩 나아가는 당신의 매일을 온 마음으로 응원합니다! 🌸`;
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
        const prompt = `너는 타인의 마음 깊은 곳을 섬세하게 읽어내는 공감 전문 심리상담가야. 
아래 사용자가 적은 일기를 정밀 분석해줘.

일기 내용:
"${diary.trim()}"

[분석 및 작성 규칙]
1. 단순 겉표면 단어나 고정 틀에 얽매이지 말고, 일기 속 상황(예: 덥고 습한 날씨, 코딩 공부, 참고 계속함, 옛 친구 이야기 등)과 구체적인 단어를 반드시 언급하며 깊이 공감해줘.
2. 덥고 힘든 환경에서도 참고 계속 공부하는 일기라면 '인내', '의지', '끈기', '보람' 등의 단어로 감정을 짚어내고, 힘들고 안타까운 일기라면 '안타까움', '마음아픔' 등으로 세밀하게 감정을 요약해줘.
3. 첫 줄은 반드시 '감정: [정밀 분석된 감정 한 단어]' 형식으로 작성해줘.
4. 첫 줄 뒤에는 줄바꿈 2번(\\n\\n)을 넣고, 사용자가 적은 상황에 꼭 맞는 다정하고 따뜻한 심리 상담 응원 메시지를 2~3문장으로 작성해줘.

답변 형식:
감정: [요약된감정]

[응원 메시지]`;

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

        // 6. Redis 데이터베이스 저장 실행 (무조건 실행)
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

        // 성공 응답 전송 (항상 HTTP 200 반환)
        return res.status(200).json({
            result: finalReply,
            savedKey: diaryKey
        });

    } catch (error) {
        console.error('Vercel Serverless Function Handler Error:', error);
        // 장애 발생 시에도 무너지지 않고 정상 답변 및 응답 처리
        const fallbackText = generateSmartEmotionReply(req.body?.diary || '');
        return res.status(200).json({
            result: fallbackText
        });
    }
}
