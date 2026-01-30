"use strict";
/**
 * PointHub Batch Schedulers
 * 6시간 주기 배치 처리 (UTC 기준)
 *
 * 스케줄:
 * - Gpoint 출금: 00:20, 06:20, 12:20, 18:20 UTC
 * - GPorder 입금: 00:40, 06:40, 12:40, 18:40 UTC
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
exports.getBatchStatus = exports.manualGporderTransfer = exports.manualGpointWithdraw = exports.gporderTransferScheduler = exports.gpointWithdrawScheduler = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const gpoint_1 = require("./gpoint");
const gporder_1 = require("./gporder");
const api_client_1 = require("./api-client");
/**
 * Gpoint 출금 스케줄러
 * UTC 기준 00:20, 06:20, 12:20, 18:20 실행
 * 포인트허브에서 생성된 Gpoint를 게임으로 일괄 출금
 */
exports.gpointWithdrawScheduler = (0, scheduler_1.onSchedule)({
    schedule: '20 0,6,12,18 * * *', // 매 6시간마다 20분에 실행
    timeZone: 'UTC',
    region: 'asia-northeast3',
}, async () => {
    console.log('[Scheduler] Starting Gpoint withdrawal batch');
    try {
        const { SDate, EDate } = (0, api_client_1.getDateRangeForBatch)();
        console.log(`[Scheduler] Gpoint batch period: ${SDate} to ${EDate}`);
        const result = await (0, gpoint_1.runGpointBatchWithdraw)(SDate, EDate);
        console.log('[Scheduler] Gpoint batch completed:', result);
    }
    catch (error) {
        console.error('[Scheduler] Gpoint batch failed:', error);
    }
});
/**
 * GPorder 입금 스케줄러
 * UTC 기준 00:40, 06:40, 12:40, 18:40 실행
 * 게임에서 발생한 매출을 포인트허브로 일괄 전송
 */
exports.gporderTransferScheduler = (0, scheduler_1.onSchedule)({
    schedule: '40 0,6,12,18 * * *', // 매 6시간마다 40분에 실행
    timeZone: 'UTC',
    region: 'asia-northeast3',
}, async () => {
    console.log('[Scheduler] Starting GPorder transfer batch');
    try {
        const result = await (0, gporder_1.runGporderBatchTransfer)();
        console.log('[Scheduler] GPorder batch completed:', result);
    }
    catch (error) {
        console.error('[Scheduler] GPorder batch failed:', error);
    }
});
/**
 * 수동 Gpoint 출금 배치 실행 (테스트용)
 */
exports.manualGpointWithdraw = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    try {
        let SDate;
        let EDate;
        if (request.data.SDate && request.data.EDate) {
            SDate = request.data.SDate;
            EDate = request.data.EDate;
        }
        else {
            const range = (0, api_client_1.getDateRangeForBatch)();
            SDate = range.SDate;
            EDate = range.EDate;
        }
        console.log(`[Manual] Running Gpoint batch for ${SDate} to ${EDate}`);
        const result = await (0, gpoint_1.runGpointBatchWithdraw)(SDate, EDate);
        return {
            success: true,
            period: { SDate, EDate },
            ...result,
        };
    }
    catch (error) {
        console.error('[Manual] Gpoint batch failed:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to run Gpoint batch');
    }
});
/**
 * 수동 GPorder 전송 배치 실행 (테스트용)
 */
exports.manualGporderTransfer = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    try {
        console.log('[Manual] Running GPorder batch');
        const result = await (0, gporder_1.runGporderBatchTransfer)();
        return {
            success: true,
            ...result,
        };
    }
    catch (error) {
        console.error('[Manual] GPorder batch failed:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to run GPorder batch');
    }
});
/**
 * 배치 상태 조회
 */
exports.getBatchStatus = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const { rtdb } = await Promise.resolve().then(() => __importStar(require('../firebase-config')));
    // 최근 배치 기록 조회
    const [gpointBatches, gporderBatches] = await Promise.all([
        rtdb.ref('/pointhub/gpoint/batches')
            .orderByChild('executedAt')
            .limitToLast(5)
            .once('value'),
        rtdb.ref('/pointhub/gporder/batches')
            .orderByChild('executedAt')
            .limitToLast(5)
            .once('value'),
    ]);
    const gpointHistory = [];
    gpointBatches.forEach((child) => {
        gpointHistory.push({ id: child.key, ...child.val() });
    });
    const gporderHistory = [];
    gporderBatches.forEach((child) => {
        gporderHistory.push({ id: child.key, ...child.val() });
    });
    // 다음 배치 시간 계산
    const now = new Date();
    const currentHour = now.getUTCHours();
    const nextBatchHour = (Math.floor(currentHour / 6) + 1) * 6;
    const nextGpointBatch = new Date(now);
    nextGpointBatch.setUTCHours(nextBatchHour % 24, 20, 0, 0);
    if (nextBatchHour >= 24) {
        nextGpointBatch.setUTCDate(nextGpointBatch.getUTCDate() + 1);
    }
    const nextGporderBatch = new Date(now);
    nextGporderBatch.setUTCHours(nextBatchHour % 24, 40, 0, 0);
    if (nextBatchHour >= 24) {
        nextGporderBatch.setUTCDate(nextGporderBatch.getUTCDate() + 1);
    }
    return {
        success: true,
        nextBatch: {
            gpoint: nextGpointBatch.toISOString(),
            gporder: nextGporderBatch.toISOString(),
        },
        recentBatches: {
            gpoint: gpointHistory.reverse(),
            gporder: gporderHistory.reverse(),
        },
    };
});
//# sourceMappingURL=scheduler.js.map