"use strict";
/**
 * PointHub API Authentication
 * SIGNATURE 생성 및 헤더 구성
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnixTimestamp = getUnixTimestamp;
exports.generateSignature = generateSignature;
exports.sha256Hash = sha256Hash;
exports.generateHeaders = generateHeaders;
exports.addCommonFields = addCommonFields;
exports.isTimestampValid = isTimestampValid;
const crypto = __importStar(require("crypto"));
const config_1 = require("./config");
/**
 * Unix Timestamp 생성 (초 단위)
 */
function getUnixTimestamp() {
    return Math.floor(Date.now() / 1000).toString();
}
/**
 * SIGNATURE 생성
 * API-KEY:UnixTimeStamp:Secret-Key 조합을 SECRET-KEY로 HMAC-SHA256 암호화
 *
 * @param timestamp Unix timestamp (초 단위)
 * @returns HMAC-SHA256 암호화된 signature
 */
function generateSignature(timestamp) {
    const message = `${config_1.POINTHUB_CONFIG.API_KEY}:${timestamp}:${config_1.POINTHUB_CONFIG.SECRET_KEY}`;
    const hmac = crypto.createHmac('sha256', config_1.POINTHUB_CONFIG.SECRET_KEY);
    hmac.update(message);
    return hmac.digest('hex');
}
/**
 * SHA256 해시 생성 (비밀번호 등)
 *
 * @param value 해시할 값
 * @returns SHA256 해시값
 */
function sha256Hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}
/**
 * API 요청 헤더 생성
 *
 * @param isJsonContent JSON 형식 요청 여부 (Gpoint, GPorder 입금 시 true)
 * @returns HTTP 헤더 객체
 */
function generateHeaders(isJsonContent = false) {
    const timestamp = getUnixTimestamp();
    const signature = generateSignature(timestamp);
    const headers = {
        'Authorization': signature,
        'APIKEY': config_1.POINTHUB_CONFIG.API_KEY,
    };
    if (isJsonContent) {
        headers['Content-Type'] = 'application/json';
        headers['Accept'] = 'application/json';
    }
    else {
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
function addCommonFields(body) {
    const timestamp = getUnixTimestamp();
    return {
        ...body,
        timestamp,
        ComCode: config_1.POINTHUB_CONFIG.COM_CODE,
    };
}
/**
 * Timestamp 유효성 검증 (5분 이내)
 *
 * @param timestamp 검증할 timestamp
 * @returns 유효 여부
 */
function isTimestampValid(timestamp) {
    const requestTime = parseInt(timestamp, 10) * 1000;
    const now = Date.now();
    return Math.abs(now - requestTime) <= config_1.POINTHUB_CONFIG.TIMESTAMP_VALIDITY_MS;
}
//# sourceMappingURL=auth.js.map