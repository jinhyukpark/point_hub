"use strict";
/**
 * PointHub Gpoint API
 * Gpoint 조회 및 출금 (포인트허브 → 게임)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGpointBalance = void 0;
exports.selectGpoints = selectGpoints;
exports.withdrawGpoints = withdrawGpoints;
exports.processGpointWithdrawals = processGpointWithdrawals;
exports.runGpointBatchWithdraw = runGpointBatchWithdraw;
const https_1 = require("firebase-functions/v2/https");
const firebase_config_1 = require("../firebase-config");
const config_1 = require("./config");
const api_client_1 = require("./api-client");
const member_1 = require("./member");
/**
 * Gpoint 조회 (특정 기간)
 * 포인트허브에서 생성된 Gpoint 목록 조회
 *
 * @param SDate 시작일자 (YYYY-MM-DD HH:mm:ss)
 * @param EDate 종료일자 (YYYY-MM-DD HH:mm:ss)
 * @returns Gpoint 목록
 */
async function selectGpoints(SDate, EDate) {
    const response = await (0, api_client_1.callPointHubAPI)(config_1.POINTHUB_ENDPOINTS.GPOINT_SELECT, { SDate, Edate: EDate });
    return Array.isArray(response.data) ? response.data : [];
}
/**
 * Gpoint 출금 (일괄)
 * 포인트허브에서 게임으로 Gpoint 일괄 출금
 * UTC+0 기준 00:20, 06:20, 12:20, 18:20에 실행
 *
 * @param SDate 시작일자
 * @param EDate 종료일자
 * @returns 출금 결과 목록
 */
async function withdrawGpoints(SDate, EDate) {
    const response = await (0, api_client_1.callPointHubAPI)(config_1.POINTHUB_ENDPOINTS.GPOINT_WITHDRAW, {
        SDate,
        Edate: EDate,
        transCode: config_1.TRANS_CODES.GPOINT_OUT,
    });
    return Array.isArray(response.data) ? response.data : [];
}
/**
 * Gpoint 출금 후 게임 내 포인트 지급
 * Firebase Realtime Database의 사용자 지갑에 반영
 *
 * @param withdrawItems 출금 결과 목록
 * @returns 처리 결과
 */
async function processGpointWithdrawals(withdrawItems) {
    const result = {
        success: 0,
        failed: 0,
        errors: [],
    };
    for (const item of withdrawItems) {
        try {
            // 포인트허브 회원번호로 게임 UID 조회
            const gameUid = await (0, member_1.getGameUidByPointHubMember)(item.mbid, item.mbid2);
            if (!gameUid) {
                result.failed++;
                result.errors.push(`No game user linked for ${item.mbid}-${item.mbid2}`);
                continue;
            }
            const amount = parseFloat(item.transPoint);
            if (isNaN(amount) || amount <= 0) {
                result.failed++;
                result.errors.push(`Invalid amount for order ${item.OrderNum}: ${item.transPoint}`);
                continue;
            }
            // 중복 처리 방지: 이미 처리된 주문번호인지 확인
            const orderRef = firebase_config_1.rtdb.ref(`/pointhub/gpoint/processed/${item.OrderNum}`);
            const orderSnapshot = await orderRef.once('value');
            if (orderSnapshot.exists()) {
                console.log(`[Gpoint] Order ${item.OrderNum} already processed, skipping`);
                continue;
            }
            // 트랜잭션으로 지갑 잔액 증가
            const walletRef = firebase_config_1.rtdb.ref(`/users/${gameUid}/wallet/usdt`);
            await walletRef.transaction((currentBalance) => {
                return (currentBalance || 0) + amount;
            });
            // 처리 완료 기록
            await orderRef.set({
                gameUid,
                mbid: item.mbid,
                mbid2: item.mbid2,
                amount,
                processedAt: Date.now(),
            });
            // Ledger 기록
            await firebase_config_1.rtdb.ref(`/ledger/${gameUid}`).push({
                type: 'credit',
                amountUsd: amount,
                meta: {
                    operation: 'gpoint_withdraw',
                    orderNum: item.OrderNum,
                    source: 'pointhub',
                },
                createdAt: Date.now(),
            });
            console.log(`[Gpoint] Credited ${amount} to ${gameUid} (order: ${item.OrderNum})`);
            result.success++;
        }
        catch (error) {
            result.failed++;
            result.errors.push(`Error processing ${item.OrderNum}: ${error.message}`);
            console.error(`[Gpoint] Error processing order ${item.OrderNum}:`, error);
        }
    }
    return result;
}
/**
 * Gpoint 배치 출금 실행
 * 스케줄러에서 호출
 *
 * @param SDate 시작일자
 * @param EDate 종료일자
 */
async function runGpointBatchWithdraw(SDate, EDate) {
    console.log(`[Gpoint Batch] Starting withdrawal for period ${SDate} to ${EDate}`);
    // 1. Gpoint 출금 요청
    const withdrawItems = await withdrawGpoints(SDate, EDate);
    console.log(`[Gpoint Batch] Received ${withdrawItems.length} withdrawal items`);
    if (withdrawItems.length === 0) {
        return { withdrawCount: 0, processResult: { success: 0, failed: 0 } };
    }
    // 2. 게임 내 포인트 지급
    const processResult = await processGpointWithdrawals(withdrawItems);
    console.log(`[Gpoint Batch] Process result:`, processResult);
    // 3. 배치 실행 기록
    await firebase_config_1.rtdb.ref('/pointhub/gpoint/batches').push({
        SDate,
        EDate,
        withdrawCount: withdrawItems.length,
        success: processResult.success,
        failed: processResult.failed,
        executedAt: Date.now(),
    });
    return {
        withdrawCount: withdrawItems.length,
        processResult,
    };
}
/**
 * Gpoint 잔액 조회 Cloud Function
 * 현재 사용자의 포인트허브 Gpoint 잔액 조회
 */
exports.getGpointBalance = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const gameUid = request.auth.uid;
    const linkedMember = await (0, member_1.getLinkedPointHubMember)(gameUid);
    if (!linkedMember) {
        throw new https_1.HttpsError('failed-precondition', '포인트허브 연동이 필요합니다.');
    }
    try {
        // 기본값: 지난 24시간
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const SDate = request.data.SDate || formatDateTime(yesterday);
        const EDate = request.data.EDate || formatDateTime(now);
        const gpoints = await selectGpoints(SDate, EDate);
        // 현재 사용자의 Gpoint만 필터링
        const userGpoints = gpoints.filter((g) => g.mbid === linkedMember.mbid && g.mbid2 === linkedMember.mbid2);
        const totalAmount = userGpoints.reduce((sum, g) => sum + parseFloat(g.transPoint || '0'), 0);
        return {
            success: true,
            gpoints: userGpoints,
            totalAmount,
            period: { SDate, EDate },
        };
    }
    catch (error) {
        console.error('[Gpoint] Balance query failed:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to query Gpoint balance');
    }
});
/**
 * 날짜 포맷 헬퍼
 */
function formatDateTime(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
//# sourceMappingURL=gpoint.js.map