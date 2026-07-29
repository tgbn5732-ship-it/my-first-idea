// Vercel Serverless Function: api/delete.js
// 사용자가 본인의 감정일기 항목을 삭제할 때 호출되는 API 핸들러

import Redis from 'ioredis';

let redisClient = null;

function getRedisClient() {
    const redisUrl = process.env.REDIS_URL || 
                     process.env.STORAGE_URL || 
                     process.env.STORAGE_REDIS_URL || 
                     process.env.KV_URL || 
                     process.env.REDIS_TLS_URL;
    if (!redisUrl) {
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

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'DELETE' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed. DELETE 또는 POST 요청만 허용됩니다.' });
    }

    try {
        let bodyData = req.body;
        if (typeof bodyData === 'string') {
            try { bodyData = JSON.parse(bodyData); } catch (e) {}
        }

        const key = req.query.key || bodyData?.key;
        const reqUserId = req.query.userId || req.query.user_id || bodyData?.userId || bodyData?.user_id;

        if (!key) {
            return res.status(400).json({ error: '삭제할 일기의 Key 정보가 필요합니다.' });
        }

        const redis = getRedisClient();
        if (!redis) {
            return res.status(500).json({ error: 'Redis DB 연결을 구성할 수 없습니다.' });
        }

        if (redis.status === 'wait') {
            await redis.connect();
        }

        // 🔒 작성자 확인 보안 검사
        const existingRecordStr = await redis.get(key);
        if (existingRecordStr) {
            try {
                const record = JSON.parse(existingRecordStr);
                if (record.userId && reqUserId && record.userId !== reqUserId) {
                    return res.status(403).json({ error: '본인이 작성한 일기만 삭제할 수 있습니다.' });
                }
            } catch (e) {
                console.warn('레코드 파싱 실패, 삭제 계속 진행:', e.message);
            }
        }

        // Redis Key 삭제
        await redis.del(key);
        console.log(`[Serverless Redis DB 일기 삭제 완료] Key: ${key}`);

        return res.status(200).json({
            success: true,
            deletedKey: key,
            message: '일기가 성공적으로 삭제되었습니다.'
        });

    } catch (error) {
        console.error('api/delete.js Error:', error);
        return res.status(500).json({
            error: error.message || '일기 삭제 중 서버 오류가 발생했습니다.'
        });
    }
}
