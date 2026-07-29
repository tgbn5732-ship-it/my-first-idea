// Vercel Serverless Function: api/history.js
// Serverless Redis(REDIS_URL)에 저장된 일기 데이터 중 요청한 사용자(userId)의 일기만 최신순으로 정렬하여 반환합니다.

import Redis from 'ioredis';

let redisClient = null;

function getRedisClient() {
    const redisUrl = process.env.REDIS_URL || process.env.STORAGE_URL || process.env.STORAGE_REDIS_URL || process.env.KV_URL;
    if (!redisUrl) {
        return null;
    }
    if (!redisClient) {
        const options = {
            maxRetriesPerRequest: 2,
            connectTimeout: 5000,
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
        const reqUserId = req.query.userId || req.query.user_id || null;

        const redis = getRedisClient();
        if (!redis) {
            console.log('REDIS_URL이 설정되지 않아 빈 히스토리 배열을 반환합니다.');
            return res.status(200).json({ items: [] });
        }

        if (redis.status === 'wait') {
            await redis.connect();
        }

        // 'diary-*' 패턴 검색
        const stream = redis.scanStream({
            match: 'diary-*',
            count: 200
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

        const values = await redis.mget(...keys);
        
        let items = values
            .filter(v => Boolean(v))
            .map(v => {
                try {
                    return typeof v === 'string' ? JSON.parse(v) : v;
                } catch (e) {
                    return null;
                }
            })
            .filter(item => item && (item.diary || item.result));

        // 🔒 사용자 ID 필터링: userId가 요청에 포함되어 있다면 해당 사용자의 일기만 추출
        if (reqUserId) {
            items = items.filter(item => {
                // 일기 레코드에 userId가 있으면 일치하는지 검사
                if (item.userId) {
                    return item.userId === reqUserId;
                }
                // 기존 레코드에 userId가 없는 초기 데이터는 기존 제작자 계정에만 보여주고 다른 사람에게는 비노출
                return false;
            });
        }

        // 최신순 정렬 (내림차순)
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
