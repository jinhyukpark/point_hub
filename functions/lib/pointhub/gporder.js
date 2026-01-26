"use strict";
/**
 * PointHub GPorder API
 * GPorder 입금 (게임 → 포인트허브)
 * 게임매출1: 모든 게임 수익의 20%
 * 게임매출2: 골든벨 승자 없는 게임의 재원
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.testGporderTransfer = void 0;
exports.transferGporders = transferGporders;
exports.saveGameRevenue = saveGameRevenue;
exports.recordGameSales1 = recordGameSales1;
exports.recordGameSales2 = recordGameSales2;
exports.runGporderBatchTransfer = runGporderBatchTransfer;
exports.onGameProfit = onGameProfit;
exports.onGoldenBellNoWinner = onGoldenBellNoWinner;
const https_1 = require("firebase-functions/v2/https");
const firebase_config_1 = require("../firebase-config");
const config_1 = require("./config");
const api_client_1 = require("./api-client");
/**
 * GPorder 입금 (일괄)
 * 게임에서 포인트허브로 매출 내역 전송
 * UTC+0 기준 00:40, 06:40, 12:40, 18:40에 실행
 *
 * @param items 입금 항목 목록
 * @returns 입금 결과
 */
async function transferGporders(items) {
    if (items.length === 0) {
        return [];
    }
    const response = await (0, api_client_1.callPointHubAPIJson)(config_1.POINTHUB_ENDPOINTS.GPORDER_TRANSFER, {
        transCode: config_1.TRANS_CODES.GPORDER_IN,
        data: items,
    });
    return Array.isArray(response.data) ? response.data : [];
}
/**
 * 게임 수익 기록 저장
 * 6시간 배치 전송 전까지 수익을 누적 저장
 *
 * @param record 수익 기록
 */
async function saveGameRevenue(record) {
    const orderNum = (0, api_client_1.generateOrderNum)('GS');
    await firebase_config_1.rtdb.ref('/pointhub/gporder/pending').push({
        ...record,
        orderNum,
        status: 'pending',
    });
    console.log(`[GPorder] Saved revenue record: ${orderNum}, amount: ${record.amount}, type: ${record.orderType}`);
}
/**
 * 게임매출1 기록 (모든 게임 수익의 20%)
 *
 * @param gameUid 게임 사용자 UID
 * @param mbid 포인트허브 회원번호 1
 * @param mbid2 포인트허브 회원번호 2
 * @param totalProfit 총 수익
 * @param gameType 게임 종류 (matching, cube, goldenbell)
 * @param gameId 게임 ID
 */
async function recordGameSales1(gameUid, mbid, mbid2, totalProfit, gameType, gameId) {
    // 총 수익의 20%를 게임매출1로 기록
    const amount = totalProfit * 0.2;
    if (amount <= 0) {
        return;
    }
    await saveGameRevenue({
        gameUid,
        mbid,
        mbid2,
        amount,
        orderType: config_1.GPORDER_TYPES.GAME_SALES_1,
        gameType,
        gameId,
        createdAt: Date.now(),
    });
}
/**
 * 게임매출2 기록 (골든벨 승자 없는 게임의 재원)
 *
 * @param mbid 포인트허브 회원번호 1
 * @param mbid2 포인트허브 회원번호 2
 * @param amount 금액
 * @param gameId 골든벨 게임 ID
 */
async function recordGameSales2(mbid, mbid2, amount, gameId) {
    if (amount <= 0) {
        return;
    }
    await saveGameRevenue({
        gameUid: 'system', // 시스템에서 발생한 수익
        mbid,
        mbid2,
        amount,
        orderType: config_1.GPORDER_TYPES.GAME_SALES_2,
        gameType: 'goldenbell_no_winner',
        gameId,
        createdAt: Date.now(),
    });
}
/**
 * 대기 중인 GPorder 목록 조회 및 그룹화
 */
async function getPendingGporders() {
    const snapshot = await firebase_config_1.rtdb.ref('/pointhub/gporder/pending')
        .orderByChild('status')
        .equalTo('pending')
        .once('value');
    const items = new Map();
    const pendingKeys = [];
    snapshot.forEach((child) => {
        const record = child.val();
        pendingKeys.push(child.key);
        // 회원별, 타입별로 금액 합산
        const key = `${record.mbid}-${record.mbid2}-${record.orderType}`;
        const existing = items.get(key);
        if (existing) {
            const newAmount = parseFloat(existing.transPoint) + record.amount;
            existing.transPoint = newAmount.toFixed(4);
        }
        else {
            items.set(key, {
                mbid: record.mbid,
                mbid2: record.mbid2,
                ordertype: record.orderType,
                transPoint: record.amount.toFixed(4),
                OrderNum: (0, api_client_1.generateOrderNum)('GS'),
            });
        }
    });
    // pending 레코드들의 키 저장 (나중에 상태 업데이트용)
    items._pendingKeys = pendingKeys;
    return items;
}
/**
 * GPorder 배치 전송 실행
 * 스케줄러에서 호출
 */
async function runGporderBatchTransfer() {
    console.log('[GPorder Batch] Starting batch transfer');
    // 1. 대기 중인 GPorder 조회 및 그룹화
    const pendingItems = await getPendingGporders();
    const transferItems = Array.from(pendingItems.values());
    console.log(`[GPorder Batch] Found ${transferItems.length} items to transfer`);
    if (transferItems.length === 0) {
        return { transferCount: 0, successCount: 0, failedCount: 0 };
    }
    // 2. 포인트허브로 전송
    const results = await transferGporders(transferItems);
    // 3. 결과 처리
    let successCount = 0;
    let failedCount = 0;
    for (const result of results) {
        if (result.resultCode === '0000') {
            successCount++;
        }
        else {
            failedCount++;
            console.error(`[GPorder Batch] Failed to transfer ${result.OrderNum}: ${result.resultMsg}`);
        }
    }
    // 4. 처리된 pending 레코드 상태 업데이트
    const pendingKeys = pendingItems._pendingKeys || [];
    const updates = {};
    for (const key of pendingKeys) {
        updates[`/pointhub/gporder/pending/${key}/status`] = 'processed';
        updates[`/pointhub/gporder/pending/${key}/processedAt`] = Date.now();
    }
    if (Object.keys(updates).length > 0) {
        await firebase_config_1.rtdb.ref().update(updates);
    }
    // 5. 배치 실행 기록
    await firebase_config_1.rtdb.ref('/pointhub/gporder/batches').push({
        transferCount: transferItems.length,
        successCount,
        failedCount,
        executedAt: Date.now(),
    });
    console.log(`[GPorder Batch] Completed: ${successCount} success, ${failedCount} failed`);
    return { transferCount: transferItems.length, successCount, failedCount };
}
/**
 * 게임 수익 발생 시 호출하는 함수
 * 게임 정산 로직에서 호출
 *
 * @param gameUid 게임 사용자 UID
 * @param profit 수익 금액
 * @param gameType 게임 종류
 * @param gameId 게임 ID
 */
async function onGameProfit(gameUid, profit, gameType, gameId) {
    // 포인트허브 연동된 사용자인지 확인
    const snapshot = await firebase_config_1.rtdb.ref(`/users/${gameUid}/pointhub`).once('value');
    const pointhubData = snapshot.val();
    if (!pointhubData || !pointhubData.mbid || !pointhubData.mbid2) {
        // 연동되지 않은 사용자는 건너뛰기
        return;
    }
    // 게임매출1 기록 (수익의 20%)
    await recordGameSales1(gameUid, pointhubData.mbid, pointhubData.mbid2, profit, gameType, gameId);
}
/**
 * 골든벨 승자 없는 게임 발생 시 호출
 *
 * @param gameId 골든벨 게임 ID
 * @param totalPot 총 상금
 */
async function onGoldenBellNoWinner(gameId, totalPot) {
    // 시스템 계정의 포인트허브 정보 사용 (설정 필요)
    const systemSnapshot = await firebase_config_1.rtdb.ref('/pointhub/systemAccount').once('value');
    const systemAccount = systemSnapshot.val();
    if (!systemAccount || !systemAccount.mbid || !systemAccount.mbid2) {
        console.warn('[GPorder] System account not configured for GPorder');
        return;
    }
    // 게임매출2 기록
    await recordGameSales2(systemAccount.mbid, systemAccount.mbid2, totalPot, gameId);
}
/**
 * GPorder 수동 전송 테스트 Cloud Function
 */
exports.testGporderTransfer = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    try {
        const result = await runGporderBatchTransfer();
        return {
            success: true,
            ...result,
        };
    }
    catch (error) {
        console.error('[GPorder] Test transfer failed:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to transfer GPorder');
    }
});
//# sourceMappingURL=gporder.js.map