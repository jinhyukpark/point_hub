/**
 * PointHub API Authentication
 * SIGNATURE 생성 및 헤더 구성
 */

import * as crypto from 'crypto';
import { POINTHUB_CONFIG } from './config';

/**
 * Unix Timestamp 생성 (초 단위)
 */
export function getUnixTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString();
}

/**
 * SIGNATURE 생성
 * API-KEY:UnixTimeStamp:Secret-Key 조합을 SECRET-KEY로 HMAC-SHA256 암호화
 *
 * @param timestamp Unix timestamp (초 단위)
 * @returns HMAC-SHA256 암호화된 signature
 */
export function generateSignature(timestamp: string): string {
  const message = `${POINTHUB_CONFIG.API_KEY}:${timestamp}:${POINTHUB_CONFIG.SECRET_KEY}`;
  const hmac = crypto.createHmac('sha256', POINTHUB_CONFIG.SECRET_KEY);
  hmac.update(message);
  return hmac.digest('hex');
}

/**
 * SHA256 해시 생성 (비밀번호 등)
 *
 * @param value 해시할 값
 * @returns SHA256 해시값
 */
export function sha256Hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * API 요청 헤더 생성
 *
 * @param isJsonContent JSON 형식 요청 여부 (Gpoint, GPorder 입금 시 true)
 * @returns HTTP 헤더 객체
 */
export function generateHeaders(isJsonContent: boolean = false): Record<string, string> {
  const timestamp = getUnixTimestamp();
  const signature = generateSignature(timestamp);

  const headers: Record<string, string> = {
    'Authorization': signature,
    'APIKEY': POINTHUB_CONFIG.API_KEY,
  };

  if (isJsonContent) {
    headers['Content-Type'] = 'application/json';
    headers['Accept'] = 'application/json';
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
  }

  return headers;
}

/**
 * 요청 body에 공통 필드 추가
 *
 * @param body 기존 요청 body
 * @returns timestamp와 ComCode가 추가된 body
 */
export function addCommonFields<T extends Record<string, any>>(body: T): T & { timestamp: string; ComCode: string } {
  const timestamp = getUnixTimestamp();
  return {
    ...body,
    timestamp,
    ComCode: POINTHUB_CONFIG.COM_CODE,
  };
}

/**
 * Timestamp 유효성 검증 (5분 이내)
 *
 * @param timestamp 검증할 timestamp
 * @returns 유효 여부
 */
export function isTimestampValid(timestamp: string): boolean {
  const requestTime = parseInt(timestamp, 10) * 1000;
  const now = Date.now();
  return Math.abs(now - requestTime) <= POINTHUB_CONFIG.TIMESTAMP_VALIDITY_MS;
}
