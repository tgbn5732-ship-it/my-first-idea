// Vercel Serverless Function: api/history.js
// Serverless Redis(REDIS_URL)에 저장된 모든 'diary-*' 일기 데이터를 가져와 최신순으로 정렬하여 반환합니다.

import Redis from 'ioredis';

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

export default async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed. GET 요청만 허용됩니다.' });
    }

    try {
        const redis = getRedisClient();
        if (!redis) {
            console.log('REDIS_URL이 설정되지 않아 빈 히스토리 배열을 반환합니다.');
            return res.status(200).json({ items: [] });
        }

        if (redis.status === 'wait') {
            await redis.connect();
        }

        // 1. 'diary-*' 패턴에 맞는 키 검색 (scanStream 사용으로 비동기 안전 검색)
        const stream = redis.scanStream({
            match: 'diary-*',
            count: 100
        });

        const keys = [];
        await new Promise((resolve, reject) => {
            stream.on('data', (batchKeys) => keys.push(...batchKeys));
            stream.on('end', resolve);
            stream.on('error', reject);
        });

        if (keys.length === 0) {
            return res.status(200).json({ items: [] });
        }

        // 2. 검색된 모든 키의 일기 및 AI 답변 데이터 일괄 가져오기 (MGET)
        const values = await redis.mget(...keys);
        
        const items = values
            .filter(v => Boolean(v))
            .map(v => {
                try {
                    return typeof v === 'string' ? JSON.parse(v) : v;
                } catch (e) {
                    return null;
                }
            })
            .filter(item => item && (item.diary || item.result));

        // 3. 최신순 정렬 (생성 시각 또는 고유 키 ID 기준 내림차순)
        items.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            if (timeA !== timeB) return timeB - timeA;
            return (b.id || '').localeCompare(a.id || '');
        });

        return res.status(200).json({ items });

    } catch (error) {
        console.error('api/history.js Error:', error);
        return res.status(500).json({ 
            error: error.message || '일기 히스토리를 불러오는 중 서버 오류가 발생했습니다.' 
        });
    }
}
