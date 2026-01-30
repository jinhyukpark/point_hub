/**
 * PointHub Batch Schedulers
 * 6시간 주기 배치 처리 (UTC 기준)
 *
 * 스케줄:
 * - Gpoint 출금: 00:20, 06:20, 12:20, 18:20 UTC
 * - GPorder 입금: 00:40, 06:40, 12:40, 18:40 UTC
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { CallableRequest } from 'firebase-functions/v2/https';
import { runGpointBatchWithdraw } from './gpoint';
import { runGporderBatchTransfer } from './gporder';
import { getDateRangeForBatch } from './api-client';

/**
 * Gpoint 출금 스케줄러
 * UTC 기준 00:20, 06:20, 12:20, 18:20 실행
 * 포인트허브에서 생성된 Gpoint를 게임으로 일괄 출금
 */
export const gpointWithdrawScheduler = onSchedule(
  {
    schedule: '20 0,6,12,18 * * *', // 매 6시간마다 20분에 실행
    timeZone: 'UTC',
    region: 'asia-northeast3',
  },
  async () => {
    console.log('[Scheduler] Starting Gpoint withdrawal batch');

    try {
      const { SDate, EDate } = getDateRangeForBatch();
      console.log(`[Scheduler] Gpoint batch period: ${SDate} to ${EDate}`);

      const result = await runGpointBatchWithdraw(SDate, EDate);

      console.log('[Scheduler] Gpoint batch completed:', result);
    } catch (error) {
      console.error('[Scheduler] Gpoint batch failed:', error);
    }
  }
);

/**
 * GPorder 입금 스케줄러
 * UTC 기준 00:40, 06:40, 12:40, 18:40 실행
 * 게임에서 발생한 매출을 포인트허브로 일괄 전송
 */
export const gporderTransferScheduler = onSchedule(
  {
    schedule: '40 0,6,12,18 * * *', // 매 6시간마다 40분에 실행
    timeZone: 'UTC',
    region: 'asia-northeast3',
  },
  async () => {
    console.log('[Scheduler] Starting GPorder transfer batch');

    try {
      const result = await runGporderBatchTransfer();

      console.log('[Scheduler] GPorder batch completed:', result);
    } catch (error) {
      console.error('[Scheduler] GPorder batch failed:', error);
    }
  }
);

/**
 * 수동 Gpoint 출금 배치 실행 (테스트용)
 */
export const manualGpointWithdraw = onCall(
  async (request: CallableRequest<{ SDate?: string; EDate?: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    try {
      let SDate: string;
      let EDate: string;

      if (request.data.SDate && request.data.EDate) {
        SDate = request.data.SDate;
        EDate = request.data.EDate;
      } else {
        const range = getDateRangeForBatch();
        SDate = range.SDate;
        EDate = range.EDate;
      }

      console.log(`[Manual] Running Gpoint batch for ${SDate} to ${EDate}`);

      const result = await runGpointBatchWithdraw(SDate, EDate);

      return {
        success: true,
        period: { SDate, EDate },
        ...result,
      };
    } catch (error: any) {
      console.error('[Manual] Gpoint batch failed:', error);
      throw new HttpsError('internal', error.message || 'Failed to run Gpoint batch');
    }
  }
);

/**
 * 수동 GPorder 전송 배치 실행 (테스트용)
 */
export const manualGporderTransfer = onCall(
  async (request: CallableRequest) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    try {
      console.log('[Manual] Running GPorder batch');

      const result = await runGporderBatchTransfer();

      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      console.error('[Manual] GPorder batch failed:', error);
      throw new HttpsError('internal', error.message || 'Failed to run GPorder batch');
    }
  }
);

/**
 * 배치 상태 조회
 */
export const getBatchStatus = onCall(
  async (request: CallableRequest) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { rtdb } = await import('../firebase-config');

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

    const gpointHistory: any[] = [];
    gpointBatches.forEach((child) => {
      gpointHistory.push({ id: child.key, ...child.val() });
    });

    const gporderHistory: any[] = [];
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
  }
);
