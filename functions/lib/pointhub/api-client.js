"use strict";
/**
 * PointHub API Client
 * HTTP 요청 처리
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.callPointHubAPI = callPointHubAPI;
exports.callPointHubAPIJson = callPointHubAPIJson;
exports.generateOrderNum = generateOrderNum;
exports.getDateRangeForBatch = getDateRangeForBatch;
const config_1 = require("./config");
const auth_1 = require("./auth");
/**
 * PointHub API 에러 생성
 */
function createPointHubError(code, message) {
    const error = new Error(config_1.POINTHUB_ERROR_CODES[code] || message);
    error.code = code;
    error.originalMessage = message;
    return error;
}
/**
 * URL 인코딩된 form data 생성
 */
function encodeFormData(data) {
    return Object.entries(data)
        .map(([key, value]) => {
        const encodedValue = typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
        return `${encodeURIComponent(key)}=${encodeURIComponent(encodedValue)}`;
    })
        .join('&');
}
/**
 * PointHub API 호출 (form-urlencoded)
 *
 * @param endpoint API 엔드포인트
 * @param body 요청 body
 * @returns API 응답
 */
async function callPointHubAPI(endpoint, body) {
    const url = `${config_1.POINTHUB_CONFIG.BASE_URL}${endpoint}`;
    const requestBody = (0, auth_1.addCommonFields)(body);
    const headers = (0, auth_1.generateHeaders)(false);
    console.log(`[PointHub API] POST ${endpoint}`);
    console.log(`[PointHub API] Request:`, JSON.stringify(requestBody, null, 2));
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: encodeFormData(requestBody),
            signal: AbortSignal.timeout(config_1.POINTHUB_CONFIG.REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
            throw createPointHubError('9999', `HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        console.log(`[PointHub API] Response:`, JSON.stringify(result, null, 2));
        if (result.result !== '0000') {
            throw createPointHubError(result.result, result.resultMsg);
        }
        return result;
    }
    catch (error) {
        if (error.code) {
            throw error;
        }
        console.error(`[PointHub API] Error:`, error);
        throw createPointHubError('9999', error.message);
    }
}
/**
 * PointHub API 호출 (JSON)
 * Gpoint, GPorder 입금 시 사용
 *
 * @param endpoint API 엔드포인트
 * @param body 요청 body
 * @returns API 응답
 */
async function callPointHubAPIJson(endpoint, body) {
    const url = `${config_1.POINTHUB_CONFIG.BASE_URL}${endpoint}`;
    const requestBody = (0, auth_1.addCommonFields)(body);
    const headers = (0, auth_1.generateHeaders)(true);
    console.log(`[PointHub API JSON] POST ${endpoint}`);
    console.log(`[PointHub API JSON] Request:`, JSON.stringify(requestBody, null, 2));
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(config_1.POINTHUB_CONFIG.REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
            throw createPointHubError('9999', `HTTP ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        console.log(`[PointHub API JSON] Response:`, JSON.stringify(result, null, 2));
        if (result.result !== '0000') {
            throw createPointHubError(result.result, result.resultMsg);
        }
        return result;
    }
    catch (error) {
        if (error.code) {
            throw error;
        }
        console.error(`[PointHub API JSON] Error:`, error);
        throw createPointHubError('9999', error.message);
    }
}
/**
 * 고유 주문번호 생성
 * 형식: YYYYMMDDHHMMSS + 6자리 랜덤
 *
 * @param prefix 접두사 (예: 'GS' for GPorder)
 * @returns 고유 주문번호
 */
function generateOrderNum(prefix = '') {
    const now = new Date();
    const dateStr = now.toISOString()
        .replace(/[-:T.Z]/g, '')
        .slice(0, 14);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${prefix}${dateStr}${random}`;
}
/**
 * 날짜 범위 문자열 생성 (6시간 배치용)
 *
 * @returns { SDate, EDate } 형식
 */
function getDateRangeForBatch() {
    const now = new Date();
    const endDate = new Date(now);
    // 현재 시간에서 가장 가까운 6시간 단위 (00, 06, 12, 18)
    const currentHour = now.getUTCHours();
    const batchHour = Math.floor(currentHour / 6) * 6;
    endDate.setUTCHours(batchHour, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setUTCHours(startDate.getUTCHours() - 6);
    const formatDate = (d) => {
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        const hours = String(d.getUTCHours()).padStart(2, '0');
        const minutes = String(d.getUTCMinutes()).padStart(2, '0');
        const seconds = String(d.getUTCSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };
    return {
        SDate: formatDate(startDate),
        EDate: formatDate(endDate),
    };
}
//# sourceMappingURL=api-client.js.map