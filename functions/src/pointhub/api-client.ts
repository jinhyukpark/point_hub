/**
 * PointHub API Client
 * HTTP 요청 처리
 */

import { POINTHUB_CONFIG, POINTHUB_ERROR_CODES } from './config';
import { generateHeaders, addCommonFields } from './auth';

// Response 타입 정의
export interface PointHubResponse<T = any> {
  result: string;
  resultMsg: string;
  data: T;
}

export interface PointHubError extends Error {
  code: string;
  originalMessage: string;
}

/**
 * PointHub API 에러 생성
 */
function createPointHubError(code: string, message: string): PointHubError {
  const error = new Error(POINTHUB_ERROR_CODES[code] || message) as PointHubError;
  error.code = code;
  error.originalMessage = message;
  return error;
}

/**
 * URL 인코딩된 form data 생성
 */
function encodeFormData(data: Record<string, any>): string {
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
export async function callPointHubAPI<T = any>(
  endpoint: string,
  body: Record<string, any>
): Promise<PointHubResponse<T>> {
  const url = `${POINTHUB_CONFIG.BASE_URL}${endpoint}`;
  const requestBody = addCommonFields(body);
  const headers = generateHeaders(false);

  console.log(`[PointHub API] POST ${endpoint}`);
  console.log(`[PointHub API] Request:`, JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: encodeFormData(requestBody),
      signal: AbortSignal.timeout(POINTHUB_CONFIG.REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw createPointHubError('9999', `HTTP ${response.status}: ${response.statusText}`);
    }

    const result: PointHubResponse<T> = await response.json();

    console.log(`[PointHub API] Response:`, JSON.stringify(result, null, 2));

    if (result.result !== '0000') {
      throw createPointHubError(result.result, result.resultMsg);
    }

    return result;
  } catch (error) {
    if ((error as PointHubError).code) {
      throw error;
    }
    console.error(`[PointHub API] Error:`, error);
    throw createPointHubError('9999', (error as Error).message);
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
export async function callPointHubAPIJson<T = any>(
  endpoint: string,
  body: Record<string, any>
): Promise<PointHubResponse<T>> {
  const url = `${POINTHUB_CONFIG.BASE_URL}${endpoint}`;
  const requestBody = addCommonFields(body);
  const headers = generateHeaders(true);

  console.log(`[PointHub API JSON] POST ${endpoint}`);
  console.log(`[PointHub API JSON] Request:`, JSON.stringify(requestBody, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(POINTHUB_CONFIG.REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw createPointHubError('9999', `HTTP ${response.status}: ${response.statusText}`);
    }

    const result: PointHubResponse<T> = await response.json();

    console.log(`[PointHub API JSON] Response:`, JSON.stringify(result, null, 2));

    if (result.result !== '0000') {
      throw createPointHubError(result.result, result.resultMsg);
    }

    return result;
  } catch (error) {
    if ((error as PointHubError).code) {
      throw error;
    }
    console.error(`[PointHub API JSON] Error:`, error);
    throw createPointHubError('9999', (error as Error).message);
  }
}

/**
 * 고유 주문번호 생성
 * 형식: YYYYMMDDHHMMSS + 6자리 랜덤
 *
 * @param prefix 접두사 (예: 'GS' for GPorder)
 * @returns 고유 주문번호
 */
export function generateOrderNum(prefix: string = ''): string {
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
export function getDateRangeForBatch(): { SDate: string; EDate: string } {
  const now = new Date();
  const endDate = new Date(now);

  // 현재 시간에서 가장 가까운 6시간 단위 (00, 06, 12, 18)
  const currentHour = now.getUTCHours();
  const batchHour = Math.floor(currentHour / 6) * 6;

  endDate.setUTCHours(batchHour, 0, 0, 0);

  const startDate = new Date(endDate);
  startDate.setUTCHours(startDate.getUTCHours() - 6);

  const formatDate = (d: Date): string => {
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
