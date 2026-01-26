import { onCall, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { CallableRequest } from 'firebase-functions/v2/https';
import { HttpsError } from 'firebase-functions/v2/https';
import { rtdb } from './firebase-config';

// 새로운 게임 관리 함수들 import
export { 
  playGame, 
  getCurrentGameStatus, 
  getUserGameHistory,
  processGoldenBellBet,
  processGoldenBellReward,
  registerGoldenBellParticipant
} from './game-manager';

// 게임 히스토리 관리 함수들
export {
  createGameHistory,
  updateGameHistoryResult,
  getUserGameHistory as getUserGameHistoryNew,
  getPendingGameResults,
  getGameHistoryDetail
} from './gameHistory';

// 골든벨 게임 함수들
export {
  joinGoldenBell,
  submitGoldenBellChoice,
  getGoldenBellStatus,
  submitGoldenBellDecision,
  selectTeam,
  createDailyGoldenBellGames,
  createDailyGoldenBellGamesCallable,
  startNextRound,
  getWaitingRoomStatus,
  getGoldenBellHistory,
  saveGoldenBellResult,
  checkRoundResult,
  fetchGoldenBellParticipants,
  fetchGoldenBellUpcomingGames,
  updateGoldenBellRoundChoices,
  updateGoldenBellParticipantReward,
  getGoldenBellRoundRewards
} from './goldenbell-game-new';

// 매칭 게임 함수들  
export {
  joinMatchingGame,
  getMatchingGameStatus,
  getMatchingGameHistory,
  getCompletedMatchingGames,
  createOrderGame,
  createRandomGame,
  testMatchingGameSettlement,
  testMatchingGameWithWinningNumbers
} from './matching-game-new';

// 큐브 게임 함수들
export {
  joinCubeGame,
  getCubeGameStatus,
  getCubeGamePositions,
  getCurrentCubeGame,
  initializeCubeGame,
  ensureCubeGameReady,
  getCubeGameHistory,
  finalizeCubeGameHistory,
  processCubeGameSettlements,
  testCubeGameSettlement,
  testFillCubeGame,
  testCubeGameWithOracle,
  testCubeGameWithFixedMove,
  testResetCubeGame,
  cubeGameSettlementWorker
} from './cube-game-new';

// Admin tools
export { setAllUsersVip } from './admin-tools';

// PointHub 연동 함수들
export {
  // 회원 확인
  verifyPointHubMember,
  getPointHubLinkStatus,
  // Gpoint
  getGpointBalance,
  // GPorder
  testGporderTransfer,
  // 스케줄러
  gpointWithdrawScheduler,
  gporderTransferScheduler,
  manualGpointWithdraw,
  manualGporderTransfer,
  getBatchStatus,
} from './pointhub';

// Firebase is initialized in firebase-config.ts

// Types
interface LedgerEntry {
  type: 'credit' | 'debit';
  amountUsd: number;
  meta: Record<string, any>;
  createdAt: number;
}

interface CryptoPrice {
  [symbol: string]: string;
}

// User initialization on account creation
export const createUserProfile = onCall(async (request: CallableRequest<{uid: string, email?: string}>) => {
  // Allow testing without authentication
  const uid = request.data.uid || (request.auth ? request.auth.uid : 'test-user');
  const email: string = request.data.email || (request.auth ? request.auth.token.email : 'test@example.com') || 'test@example.com';

  const now = Date.now();

  // 로컬 에뮬레이터 환경인지 확인
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' ||
                     process.env.FIREBASE_DATABASE_EMULATOR_HOST;

  // 기본 100 USDT 지급 (로컬 환경에서는 10000)
  const initialBalance = isEmulator ? 10000 : 100;

  // 사용자 프로필 초기화 (wallet 구조 사용)
  await rtdb.ref(`/users/${uid}`).set({
    uid,
    email,
    emailVerified: (request.auth && request.auth.token.email_verified) || false,
    displayName: email.split('@')[0], // 이메일 앞부분을 displayName으로 사용
    balance: initialBalance, // 하위 호환성을 위해 유지
    wallet: {
      usdt: initialBalance // 게임 함수들이 사용하는 구조
    },
    auth: {
      email: email,
      emailVerified: (request.auth && request.auth.token.email_verified) || false
    },
    isVip: isEmulator, // 로컬 환경에서는 VIP
    createdAt: now,
    updatedAt: now
  });

  // 회원가입 보너스 Ledger 기록
  const ledgerEntry: LedgerEntry = {
    type: 'credit',
    amountUsd: 100,
    meta: {
      operation: 'signup_bonus',
      description: 'Welcome bonus for new user',
      timestamp: Date.now()
    },
    createdAt: Date.now()
  };

  await rtdb.ref(`/ledger/${uid}`).push(ledgerEntry);

  console.log(`User ${uid} (${email}) initialized with $${initialBalance} welcome bonus`);

  // 로컬 에뮬레이터 환경에서만 게임 데이터 자동 초기화
  if (isEmulator) {
    console.log('[DEV MODE] Initializing games for local development...');

    try {
      // 이미 플랫 구조로 10,000 balance가 설정되어 있음
      console.log(`[DEV MODE] User ${uid} created with ${initialBalance} test balance`);

      // 2. Golden Bell 게임 생성
      const { createDailyGoldenBellGames } = require('./goldenbell-game-new');
      const today = new Date().toISOString().split('T')[0];
      await createDailyGoldenBellGames(today);
      console.log('[DEV MODE] Created Golden Bell games');

      // 3. Cube 게임 초기화
      const cubeRef = rtdb.ref('/games/cube');
      const cubeSnapshot = await cubeRef.orderByChild('createdAt').limitToLast(1).once('value');

      if (!cubeSnapshot.exists()) {
        const { createNewCubeGame } = require('./cube-game-new');
        await createNewCubeGame();
        console.log('[DEV MODE] Initialized Cube game');
      }

      // 4. 활성 Golden Bell 게임 생성 (테스트용)
      const currentTime = Date.now();
      const activeGameId = `goldenbell_${currentTime}`;
      await rtdb.ref(`/games/goldenbell/${activeGameId}`).set({
        gameId: activeGameId,
        status: 'active',
        round: 1,
        currentRound: 1,
        maxRounds: 10,
        startAt: currentTime,
        roundStartAt: currentTime,
        roundEndAt: currentTime + 120000, // 2분
        bettingStartAt: currentTime,
        bettingEndAt: currentTime + 100000, // 100초
        createdAt: currentTime,
        currentBetAmount: 100,
        maxParticipants: 2047,
        schedule: 'auto_dev_init',
        totalPot: 0,
        teamA: {
          name: 'Red Team',
          participants: 0,
          totalBet: 0
        },
        teamB: {
          name: 'Blue Team',
          participants: 0,
          totalBet: 0
        }
      });
      console.log('[DEV MODE] Created active Golden Bell game:', activeGameId);

    } catch (error) {
      console.error('[DEV MODE] Game initialization error:', error);
      // 게임 초기화 실패해도 사용자 생성은 성공으로 처리
    }
  }

  return { success: true, uid, email };
});

// Server-side credit function
export const credit = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new Error('Authentication required');
  }

  const { uid } = request.auth;
  const { amount, type, meta = {} } = request.data;

  if (!amount || amount <= 0) {
    throw new Error('Invalid amount');
  }

  try {
    // Update wallet balance atomically
    await rtdb.ref(`/users/${uid}/wallet/usdt`).transaction((currentBalance) => {
      return (currentBalance || 0) + amount;
    });

    // Record transaction in ledger
    const ledgerEntry: LedgerEntry = {
      type: 'credit',
      amountUsd: amount,
      meta: { ...meta, operation: type },
      createdAt: Date.now()
    };

    await rtdb.ref(`/ledger/${uid}`).push(ledgerEntry);

    console.log(`Credited ${amount} USDT to user ${uid}`);
    return { success: true, amount, balance: await getCurrentBalance(uid) };
  } catch (error) {
    console.error('Credit operation failed:', error);
    throw new Error('Credit operation failed');
  }
});

// Server-side debit function
// ⚠️ 중요: 이 함수는 무조건 USDT만 사용합니다. 다른 통화는 지원하지 않습니다.
export const debit = onCall(async (request: CallableRequest) => {
  // USDT 전용 상수 정의 (절대 변경 불가)
  const CURRENCY = 'usdt'; // 소문자로 고정, 대소문자 구분 없음
  
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { uid } = request.auth;
  
  // 요청 데이터 로깅 (디버깅용)
  console.log(`[debit] Request data:`, JSON.stringify(request.data));
  console.log(`[debit] Request data type:`, typeof request.data);
  
  const { amount, type, meta = {} } = request.data || {};
  
  // currency 파라미터가 있어도 완전히 무시 (USDT만 사용)
  if (request.data?.currency) {
    console.warn(`[debit] Currency parameter '${request.data.currency}' ignored. This function only uses USDT.`);
  }
  
  // amount 파라미터 검증 (더 엄격하게)
  if (amount === undefined || amount === null) {
    console.error(`[debit] Amount is missing. Request data:`, request.data);
    throw new HttpsError('invalid-argument', 'Amount parameter is required.');
  }
  
  // 숫자로 변환 시도
  const amountNumber = typeof amount === 'number' ? amount : parseFloat(String(amount));
  
  if (isNaN(amountNumber) || !isFinite(amountNumber)) {
    console.error(`[debit] Invalid amount format: ${amount} (type: ${typeof amount})`);
    throw new HttpsError('invalid-argument', `Invalid amount format. Expected number, got: ${typeof amount}`);
  }
  
  if (amountNumber <= 0) {
    console.error(`[debit] Amount must be greater than 0. Got: ${amountNumber}`);
    throw new HttpsError('invalid-argument', `Amount must be greater than 0. Got: ${amountNumber}`);
  }

  try {
    console.log(`[debit] Processing debit for user ${uid}, amount: ${amountNumber} USDT, type: ${type || 'unknown'}`);
    
    // ⚠️ 중요: 무조건 USDT 기준으로만 처리 (하드코딩, 절대 변경 불가)
    // - request.data에 currency 파라미터가 있어도 완전히 무시
    // - 다른 통화 타입이나 wallet 경로 사용 절대 금지
    // - 모든 debit 작업은 반드시 /users/{uid}/wallet/usdt 경로만 사용
    // 이전 문제점:
    // 1. 트랜잭션 결과(committed 속성)를 확인하지 않아서 실제 실패 여부를 알 수 없었음
    // 2. transactionSuccess 변수가 트랜잭션 콜백 외부에서 설정되어 제대로 동작하지 않았음
    // 3. 일반 Error를 throw해서 클라이언트에 명확한 에러 정보가 전달되지 않았음
    // 4. 트랜잭션 전에 잔액을 확인하는 것이 race condition을 유발함
    
    // USDT wallet 경로 (절대 변경 불가, 함수 시작 부분의 CURRENCY 상수 사용)
    const walletPath = `/users/${uid}/wallet/${CURRENCY}`;
    
    console.log(`[debit] Using wallet path: ${walletPath} (USDT only, hardcoded)`);
    
    // matching-game-new.ts와 동일한 패턴: 트랜잭션 전 잔액 확인
    // 주의: 이 잔액은 fallback용이며, 실제 차감은 트랜잭션 내부에서 수행
    const preTransactionSnapshot = await rtdb.ref(walletPath).once('value');
    const expectedBalance = preTransactionSnapshot.val() || 0;
    console.log(`[debit] Pre-transaction balance: ${expectedBalance} USDT (for fallback only, transaction uses DB value)`);
    
    // ⚠️ 중요: 트랜잭션 내부에서만 잔액 확인 및 차감
    // matching-game-new.ts와 동일한 패턴:
    // 1. 트랜잭션 내부에서 balance를 읽음 (원자적, 최신 값)
    // 2. balance가 null/undefined이면 expectedBalance를 fallback으로 사용
    // 3. 트랜잭션은 충돌 시 자동 재시도되므로 항상 최신 값을 읽음
    
    console.log(`[debit] Starting transaction on path: ${walletPath}`);
    
    const transactionResult = await rtdb.ref(walletPath).transaction((currentBalance) => {
      // matching-game-new.ts 패턴: balance가 null/undefined이면 expectedBalance 사용
      const balance = currentBalance !== null && currentBalance !== undefined ? currentBalance : expectedBalance;
      const current = Number(balance) || 0;
      
      console.log(`[debit] Transaction callback - currentBalance from DB: ${JSON.stringify(currentBalance)}, using balance: ${current}, expected: ${expectedBalance}, required: ${amountNumber}`);
      
      // 잔액 부족 체크 (트랜잭션 내부에서 확인)
      if (current < amountNumber) {
        console.error(`[debit] Transaction aborting - insufficient balance: ${current} < ${amountNumber}`);
        return; // Abort transaction - insufficient balance (undefined 반환)
      }
      
      // 잔액 차감
      const newBalance = current - amountNumber;
      console.log(`[debit] Transaction committing - newBalance: ${newBalance} USDT`);
      return newBalance;
    });

    if (!transactionResult.committed) {
      // 트랜잭션이 abort된 경우, snapshot에서 최종 잔액 확인
      const finalBalance = transactionResult.snapshot?.val() || 0;
      console.error(`[debit] Transaction aborted. Final balance in DB: ${finalBalance}, Required: ${amountNumber}`);
      
      // 더 명확한 에러 메시지
      throw new HttpsError(
        'failed-precondition',
        `Insufficient balance. Current balance: ${finalBalance} USDT, Required: ${amountNumber} USDT`
      );
    }

    const newBalance = transactionResult.snapshot.val() || 0;
    console.log(`[debit] Transaction committed. New balance: ${newBalance}`);

    // Record transaction in ledger
    try {
      const ledgerEntry: LedgerEntry = {
        type: 'debit',
        amountUsd: -amountNumber,
        meta: { ...meta, operation: type || 'debit' },
        createdAt: Date.now()
      };

      await rtdb.ref(`/ledger/${uid}`).push(ledgerEntry);
      console.log(`[debit] Ledger entry recorded for user ${uid}`);
    } catch (ledgerError) {
      console.error(`[debit] Failed to record ledger entry for user ${uid}:`, ledgerError);
      // Ledger 기록 실패는 치명적이지 않으므로 계속 진행
    }

    console.log(`[debit] Successfully debited ${amountNumber} USDT from user ${uid}. New balance: ${newBalance}`);
    
    return {
      success: true,
      amount: amountNumber,
      balance: newBalance
    };
    
  } catch (error) {
    console.error('[debit] Debit operation failed:', error);
    
    if (error instanceof HttpsError) {
      throw error;
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new HttpsError('internal', `Debit operation failed: ${errorMessage}`);
  }
});

// Helper function to get current balance
async function getCurrentBalance(uid: string): Promise<number> {
  const snapshot = await rtdb.ref(`/users/${uid}/wallet/usdt`).once('value');
  return snapshot.val() || 0;
}

// Golden Bell Daily Scheduler - generate entire day at 00:00 UTC
export const goldenBellDailyScheduler = onSchedule(
  { 
    schedule: "0 0 * * *", // 매일 자정
    timeZone: "UTC",
    region: "asia-northeast3"
  },
  async () => {
    try {
      const { createDailyGoldenBellGames } = await import('./goldenbell-game-new');
      await createDailyGoldenBellGames();
      console.log('Daily Golden Bell schedule generated successfully');
    } catch (error) {
      console.error('Daily Golden Bell schedule generation failed:', error);
    }
  }
);

// Golden Bell Recovery Scheduler - runs at 5,10,15... minute marks to ensure today's schedule exists
export const goldenBellRecoveryScheduler = onSchedule(
  { 
    schedule: "5,10,15,20,25,30,35,40,45,50,55 * * * *",
    timeZone: "UTC",
    region: "asia-northeast3"
  },
  async () => {
    try {
      const { ensureTodayGoldenBellSchedule } = await import('./goldenbell-game-new');
      await ensureTodayGoldenBellSchedule();
      console.log('Golden Bell recovery check completed');
    } catch (error) {
      console.error('Golden Bell recovery scheduler failed:', error);
    }
  }
);

// Golden Bell Round Scheduler - every 1 minute (라운드 시작 관리)
export const goldenBellRoundScheduler = onSchedule(
  { 
    schedule: "* * * * *", // 매 1분마다
    timeZone: "UTC",
    region: "asia-northeast3"
  },
  async () => {
    try {
      const { startNextRound } = await import('./goldenbell-game-new');
      await startNextRound();
    } catch (error) {
      console.error('Golden Bell round scheduling failed:', error);
    }
  }
);

// Matching Game ORDER Scheduler - daily at 00:00 UTC
export const matchingOrderScheduler = onSchedule(
  { 
    schedule: "0 0 * * *", // 매일 자정
    timeZone: "UTC",
    region: "asia-northeast3"
  },
  async () => {
    try {
      const { createOrderGame } = await import('./matching-game-new');
      await createOrderGame();
      console.log('ORDER matching game scheduled successfully');
    } catch (error) {
      console.error('ORDER matching game scheduling failed:', error);
    }
  }
);

// Matching Game RANDOM Scheduler - every 6 hours
export const matchingRandomScheduler = onSchedule(
  { 
    schedule: "0 */6 * * *", // 매 6시간마다
    timeZone: "UTC",
    region: "asia-northeast3"
  },
  async () => {
    try {
      const { createRandomGame } = await import('./matching-game-new');
      await createRandomGame();
      console.log('RANDOM matching game scheduled successfully');
    } catch (error) {
      console.error('RANDOM matching game scheduling failed:', error);
    }
  }
);

// Matching Game Settlement Scheduler - every 1 minute (게임 종료 체크 및 결과 계산)
export const matchingGameSettlementScheduler = onSchedule(
  { 
    schedule: "* * * * *", // 매 1분마다
    timeZone: "UTC",
    region: "asia-northeast3"
  },
  async () => {
    try {
      const { processMatchingGameSettlements } = await import('./matching-game-new');
      await processMatchingGameSettlements();
    } catch (error) {
      console.error('Matching game settlement scheduling failed:', error);
    }
  }
);

// Cube Game Settlement Scheduler - every 1 minute (게임 종료 체크, 결과 계산, 새 게임 생성)
export const cubeGameSettlementScheduler = onSchedule(
  { 
    schedule: "* * * * *", // 매 1분마다
    timeZone: "UTC",
    region: "asia-northeast3"
  },
  async () => {
    try {
      const { processCubeGameSettlements } = await import('./cube-game-new');
      await processCubeGameSettlements();
    } catch (error) {
      console.error('Cube game settlement scheduling failed:', error);
    }
  }
);

// Cryptocurrency price oracle - runs every 30 seconds
export const oracleSnapshot = onSchedule(
  { 
    schedule: "every 1 minutes", 
    timeZone: "Asia/Seoul",
    region: "asia-northeast3"
  },
  async () => {
    try {
      // API 호출은 Binance.US의 USD 페어 사용 (실제 USD 가격)
      const cryptoPairsUSD = ["BTCUSD", "ETHUSD", "XRPUSD", "BNBUSD", "SOLUSD", "DOGEUSD", "TRXUSD"];
      // 저장은 USDT 필드명 유지 (기존 구조 호환성)
      const cryptoPairsUSDT = ["BTCUSDT", "ETHUSDT", "XRPUSDT", "BNBUSDT", "SOLUSDT", "DOGEUSDT", "TRXUSDT"];

      const priceData: CryptoPrice = {};
      const gameNumbers: Record<string, number> = {};

      // Fetch prices from Binance.US API (실제 USD 가격)
      for (let i = 0; i < cryptoPairsUSD.length; i++) {
        const symbolUSD = cryptoPairsUSD[i];
        const symbolUSDT = cryptoPairsUSDT[i]; // 저장용 키

        try {
          const response = await fetch(
            `https://api.binance.us/api/v3/ticker/price?symbol=${symbolUSD}`
          );
          const data = await response.json();
          const price = parseFloat(data.price);

          // USDT 키로 저장 (기존 구조 유지)
          priceData[symbolUSDT] = data.price;

          // Extract second decimal digit for matching game
          const priceStr = price.toFixed(2);
          const secondDecimal = parseInt(priceStr.split('.')[1][1]);
          gameNumbers[symbolUSD.replace('USD', '')] = secondDecimal;
        } catch (error) {
          console.error(`Failed to fetch price for ${symbolUSD}:`, error);
          // Continue with other symbols even if one fails
        }
      }

      if (Object.keys(priceData).length > 0) {
        const timestamp = Date.now();
        await rtdb.ref(`/oracle/binance/${timestamp}`).set({
          prices: priceData,
          gameNumbers: gameNumbers,
          timestamp: timestamp
        });
        
        // Update current prices reference for easy access
        await rtdb.ref('/oracle/current').set({
          prices: priceData,
          gameNumbers: gameNumbers,
          timestamp: timestamp
        });
        
        console.log(`Oracle snapshot saved:`, { priceData, gameNumbers });

        // Clean up old snapshots (keep last 24 hours)
        await cleanupOldSnapshots();
      }
    } catch (error) {
      console.error('Oracle snapshot failed:', error);
    }
  }
);

// Helper function to clean up old oracle snapshots
async function cleanupOldSnapshots() {
  try {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const oracleRef = rtdb.ref('/oracle/binance');
    
    // Get all snapshots older than 24 hours
    const oldSnapshotsSnapshot = await oracleRef
      .orderByKey()
      .endAt(oneDayAgo.toString())
      .once('value');
    
    if (oldSnapshotsSnapshot.exists()) {
      const updates: Record<string, null> = {};
      oldSnapshotsSnapshot.forEach((child) => {
        updates[child.key!] = null;
      });
      
      await oracleRef.update(updates);
      console.log(`Cleaned up ${Object.keys(updates).length} old snapshots`);
    }
  } catch (error) {
    console.error('Snapshot cleanup failed:', error);
  }
}

// Get Server Time - for client-side time synchronization
// Rate limiting: Store last call time per user
const lastServerTimeCalls: Map<string, number> = new Map();
const MIN_CALL_INTERVAL_MS = 1000; // 최소 1초 간격

export const getServerTime = onCall(async (request: CallableRequest) => {
  try {
    // Rate limiting: 같은 사용자가 너무 자주 호출하지 않도록 제한
    const uid = request.auth?.uid || request.rawRequest.ip || 'anonymous';
    const now = Date.now();
    const lastCall = lastServerTimeCalls.get(uid);
    
    if (lastCall && (now - lastCall) < MIN_CALL_INTERVAL_MS) {
      // 최근 호출이 너무 빨랐으면 마지막 호출 시간 + 간격 반환 (에러 방지)
      const serverTime = lastCall + MIN_CALL_INTERVAL_MS;
      console.log(`[getServerTime] Rate limited for ${uid}, returning cached time`);
      return {
        success: true,
        serverTime: serverTime,
        timestamp: serverTime,
        cached: true
      };
    }
    
    // 정상 호출
    lastServerTimeCalls.set(uid, now);
    
    // Map 크기 제한 (메모리 누수 방지)
    if (lastServerTimeCalls.size > 10000) {
      const oldestKey = lastServerTimeCalls.keys().next().value;
      if (oldestKey) {
        lastServerTimeCalls.delete(oldestKey);
      }
    }
    
    const serverTime = Date.now();
    
    return {
      success: true,
      serverTime: serverTime,
      timestamp: serverTime
    };
  } catch (error: any) {
    console.error('Error getting server time:', error);
    return {
      success: false,
      error: error?.message || 'Failed to get server time'
    };
  }
});

// Get Oracle Price Data - for client-side matching game
export const getOraclePriceData = onCall(async (request: CallableRequest) => {
  // 인증 확인
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  try {
    // Oracle 데이터 가져오기 (기존 /oracle/current 사용)
    const oracleSnapshot = await rtdb.ref('/oracle/current').once('value');
    const oracleData = oracleSnapshot.val();

    if (!oracleData || !oracleData.prices || !oracleData.gameNumbers) {
      // 에뮬레이터 환경에서는 기본값 반환
      const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
      if (isEmulator) {
        console.log('[getOraclePriceData] Emulator mode - returning mock data');
        return {
          success: true,
          data: {
            timestamp: Date.now(),
            prices: {
              BTCUSDT: '97500.25',
              ETHUSDT: '3250.50',
              XRPUSDT: '2.35',
              BNBUSDT: '695.80',
              SOLUSDT: '185.40',
              DOGEUSDT: '0.32',
              TRXUSDT: '0.25'
            },
            gameNumbers: { BTC: 5, ETH: 0, XRP: 5, BNB: 0, SOL: 0, DOGE: 2, TRX: 5 }
          }
        };
      }
      throw new HttpsError('unavailable', 'Oracle service unavailable');
    }

    // gameNumbers 형식 변환 (문서 요구사항에 맞춤)
    // 기존: { BTC: 2, ETH: 6, ... }
    // 요구: { BTC: 2, ETH: 6, ... } (동일하지만 명시적으로 변환)
    const gameNumbers: Record<string, number> = {
      BTC: oracleData.gameNumbers.BTC || 0,
      ETH: oracleData.gameNumbers.ETH || 0,
      XRP: oracleData.gameNumbers.XRP || 0,
      BNB: oracleData.gameNumbers.BNB || 0,
      SOL: oracleData.gameNumbers.SOL || 0,
      DOGE: oracleData.gameNumbers.DOGE || 0,
      TRX: oracleData.gameNumbers.TRX || 0
    };

    // prices 형식 확인 및 반환
    const prices: CryptoPrice = {
      BTCUSDT: oracleData.prices.BTCUSDT || '0',
      ETHUSDT: oracleData.prices.ETHUSDT || '0',
      XRPUSDT: oracleData.prices.XRPUSDT || '0',
      BNBUSDT: oracleData.prices.BNBUSDT || '0',
      SOLUSDT: oracleData.prices.SOLUSDT || '0',
      DOGEUSDT: oracleData.prices.DOGEUSDT || '0',
      TRXUSDT: oracleData.prices.TRXUSDT || '0'
    };

    return {
      success: true,
      data: {
        timestamp: oracleData.timestamp || Date.now(),
        prices: prices,
        gameNumbers: gameNumbers
      }
    };
  } catch (error) {
    console.error('Error fetching Oracle data:', error);
    
    // 이미 HttpsError인 경우 그대로 throw
    if (error instanceof HttpsError) {
      throw error;
    }
    
    // 기타 에러는 internal 에러로 변환
    throw new HttpsError('internal', 'Failed to fetch Oracle data');
  }
});

// Initialize complete game system
export const initializeSystem = onCall(async (request: CallableRequest) => {
  try {
    // Set system configuration
    await rtdb.ref('/config').set({
      oracle: {
        coins: ["BTCUSDT", "ETHUSDT", "XRPUSDT", "BNBUSDT", "SOLUSDT", "DOGEUSDT", "TRXUSDT"]
      },
      games: {
        goldenBell: {
          intervalMinutes: 10,
          maxParticipants: 2047,
          roundTimeSeconds: 30,
          maxRounds: 10
        },
        matching: {
          orderIntervalHours: 24,
          randomIntervalHours: 6,
          betAmount: 2,
          settlementDelayMinutes: "5-10"
        },
        cube: {
          maxParticipants: 2047,
          entryFee: 20,
          waitTimeMinutes: 5,
          vipOnly: true
        }
      }
    });

    // Skip game initialization for now
    // const { initializeCubeGame } = await import('./cube-game-new');
    // await initializeCubeGame({} as any, {} as any);

    console.log('All game systems initialized successfully');
    return { success: true, message: 'Complete system initialized successfully' };
  } catch (error) {
    console.error('System initialization failed:', error);
    throw new Error('System initialization failed');
  }
});

// User Account Functions with Rewards
export const enhancedInitUserProfile = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new Error('Authentication required');
  }

  const { referrerId, signupAmount } = request.data;
  
  try {
    const uid = request.auth.uid;
    
    // Initialize user profile
    await rtdb.ref(`/users/${uid}`).set({
      profile: { 
        createdAt: Date.now(),
        referrer: referrerId || null
      },
      wallet: { usdt: 0, ivy: 0, pending: 0 },
      vip: { 
        status: 'inactive',
        autoReinvestPool: 0
      }
    });

    // Process signup rewards if amount provided
    if (signupAmount && signupAmount > 0) {
      const { distributeSignupRewards } = await import('./reward-system');
      await distributeSignupRewards(uid, signupAmount);
    }

    console.log(`Enhanced user profile initialized for ${uid}`);
    return { success: true, message: 'User profile initialized with rewards' };
  } catch (error) {
    console.error('Enhanced user initialization failed:', error);
    throw new Error('User initialization failed');
  }
});

// 테스트 함수: 사용자 wallet 구조 마이그레이션
export const testMigrateUserWallets = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new Error('Authentication required');
  }

  try {
    console.log('[testMigrateUserWallets] Starting user wallet migration...');

    const usersSnapshot = await rtdb.ref('/users').once('value');
    if (!usersSnapshot.exists()) {
      return {
        success: true,
        message: 'No users found',
        migrated: 0
      };
    }

    const users = usersSnapshot.val();
    const updates: Record<string, any> = {};
    let migratedCount = 0;

    for (const [uid, userData] of Object.entries(users) as [string, any][]) {
      // wallet/usdt가 없거나 0인 경우에만 마이그레이션
      const currentWalletUsdt = userData.wallet?.usdt || 0;
      const balance = userData.balance || 0;

      if (currentWalletUsdt === 0 && balance > 0) {
        // balance 값을 wallet/usdt로 복사
        updates[`/users/${uid}/wallet/usdt`] = balance;
        console.log(`[testMigrateUserWallets] Migrating user ${uid}: balance ${balance} -> wallet/usdt`);
        migratedCount++;
      } else if (!userData.wallet) {
        // wallet 구조 자체가 없으면 생성 (10000 USDT 기본값)
        updates[`/users/${uid}/wallet/usdt`] = 10000;
        updates[`/users/${uid}/balance`] = 10000;
        console.log(`[testMigrateUserWallets] Creating wallet for user ${uid}: 10000 USDT`);
        migratedCount++;
      }

      // auth 구조도 없으면 추가
      if (!userData.auth && userData.email) {
        updates[`/users/${uid}/auth/email`] = userData.email;
        updates[`/users/${uid}/auth/emailVerified`] = userData.emailVerified || false;
      }
    }

    if (Object.keys(updates).length > 0) {
      await rtdb.ref().update(updates);
    }

    console.log(`[testMigrateUserWallets] Migration complete: ${migratedCount} users migrated`);

    return {
      success: true,
      message: `User wallet migration completed`,
      migrated: migratedCount,
      totalUsers: Object.keys(users).length
    };

  } catch (error) {
    console.error('[testMigrateUserWallets] Migration failed:', error);
    throw new Error(`Failed to migrate user wallets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// 테스트 함수: 모든 데이터 리셋 (gameHistory, Matching 게임, Cube 게임, 유저 데이터)
export const testResetAllData = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new Error('Authentication required');
  }

  try {
    console.log('[testResetAllData] Starting full data reset...');
    
    const resetResults = {
      gameHistory: { deleted: 0, error: null as string | null },
      matchingGames: { deleted: 0, error: null as string | null },
      cubeGames: { deleted: 0, error: null as string | null },
      users: { deleted: 0, error: null as string | null },
      ledger: { deleted: 0, error: null as string | null }
    };

    // 1. gameHistory 리셋
    try {
      console.log('[testResetAllData] Resetting gameHistory...');
      const gameHistorySnapshot = await rtdb.ref('/gameHistory').once('value');
      if (gameHistorySnapshot.exists()) {
        const gameHistoryData = gameHistorySnapshot.val();
        const updates: Record<string, null> = {};
        
        // 모든 유저의 gameHistory 삭제
        Object.keys(gameHistoryData).forEach((uid) => {
          updates[`/gameHistory/${uid}`] = null;
        });
        
        if (Object.keys(updates).length > 0) {
          await rtdb.ref().update(updates);
          resetResults.gameHistory.deleted = Object.keys(updates).length;
        }
      }
      console.log(`[testResetAllData] gameHistory reset complete: ${resetResults.gameHistory.deleted} users`);
    } catch (error) {
      console.error('[testResetAllData] Error resetting gameHistory:', error);
      resetResults.gameHistory.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // 2. Matching 게임 리셋
    try {
      console.log('[testResetAllData] Resetting matching games...');
      const matchingGamesSnapshot = await rtdb.ref('/games/matching').once('value');
      if (matchingGamesSnapshot.exists()) {
        const matchingGamesData = matchingGamesSnapshot.val();
        const updates: Record<string, null> = {};
        
        // 모든 Matching 게임 삭제
        Object.keys(matchingGamesData).forEach((gameId) => {
          updates[`/games/matching/${gameId}`] = null;
        });
        
        if (Object.keys(updates).length > 0) {
          await rtdb.ref().update(updates);
          resetResults.matchingGames.deleted = Object.keys(updates).length;
        }
      }
      console.log(`[testResetAllData] Matching games reset complete: ${resetResults.matchingGames.deleted} games`);
    } catch (error) {
      console.error('[testResetAllData] Error resetting matching games:', error);
      resetResults.matchingGames.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // 3. Cube 게임 리셋
    try {
      console.log('[testResetAllData] Resetting cube games...');
      const cubeGamesSnapshot = await rtdb.ref('/games/cube').once('value');
      if (cubeGamesSnapshot.exists()) {
        const cubeGamesData = cubeGamesSnapshot.val();
        const updates: Record<string, null> = {};
        
        // 모든 Cube 게임 삭제
        Object.keys(cubeGamesData).forEach((gameId) => {
          updates[`/games/cube/${gameId}`] = null;
        });
        
        if (Object.keys(updates).length > 0) {
          await rtdb.ref().update(updates);
          resetResults.cubeGames.deleted = Object.keys(updates).length;
        }
      }
      console.log(`[testResetAllData] Cube games reset complete: ${resetResults.cubeGames.deleted} games`);
    } catch (error) {
      console.error('[testResetAllData] Error resetting cube games:', error);
      resetResults.cubeGames.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // 4. 유저 데이터 리셋
    try {
      console.log('[testResetAllData] Resetting user data...');
      const usersSnapshot = await rtdb.ref('/users').once('value');
      if (usersSnapshot.exists()) {
        const usersData = usersSnapshot.val();
        const updates: Record<string, null> = {};
        
        // 모든 유저 데이터 삭제
        Object.keys(usersData).forEach((uid) => {
          updates[`/users/${uid}`] = null;
        });
        
        if (Object.keys(updates).length > 0) {
          await rtdb.ref().update(updates);
          resetResults.users.deleted = Object.keys(updates).length;
        }
      }
      console.log(`[testResetAllData] User data reset complete: ${resetResults.users.deleted} users`);
    } catch (error) {
      console.error('[testResetAllData] Error resetting user data:', error);
      resetResults.users.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // 5. Ledger 리셋
    try {
      console.log('[testResetAllData] Resetting ledger...');
      const ledgerSnapshot = await rtdb.ref('/ledger').once('value');
      if (ledgerSnapshot.exists()) {
        const ledgerData = ledgerSnapshot.val();
        const updates: Record<string, null> = {};
        
        // 모든 유저의 ledger 삭제
        Object.keys(ledgerData).forEach((uid) => {
          updates[`/ledger/${uid}`] = null;
        });
        
        if (Object.keys(updates).length > 0) {
          await rtdb.ref().update(updates);
          resetResults.ledger.deleted = Object.keys(updates).length;
        }
      }
      console.log(`[testResetAllData] Ledger reset complete: ${resetResults.ledger.deleted} users`);
    } catch (error) {
      console.error('[testResetAllData] Error resetting ledger:', error);
      resetResults.ledger.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // 실시간 게임 상태도 리셋
    try {
      console.log('[testResetAllData] Resetting realtime game status...');
      const cubeRealtimeSnapshot = await rtdb.ref('/games/cube_realtime').once('value');
      if (cubeRealtimeSnapshot.exists()) {
        const updates: Record<string, null> = {};
        Object.keys(cubeRealtimeSnapshot.val()).forEach((gameId) => {
          updates[`/games/cube_realtime/${gameId}`] = null;
        });
        if (Object.keys(updates).length > 0) {
          await rtdb.ref().update(updates);
        }
      }
      
      const matchingSummarySnapshot = await rtdb.ref('/games/matching_summary').once('value');
      if (matchingSummarySnapshot.exists()) {
        const updates: Record<string, null> = {};
        Object.keys(matchingSummarySnapshot.val()).forEach((gameId) => {
          updates[`/games/matching_summary/${gameId}`] = null;
        });
        if (Object.keys(updates).length > 0) {
          await rtdb.ref().update(updates);
        }
      }
      console.log('[testResetAllData] Realtime game status reset complete');
    } catch (error) {
      console.error('[testResetAllData] Error resetting realtime status:', error);
    }

    const totalDeleted = 
      resetResults.gameHistory.deleted +
      resetResults.matchingGames.deleted +
      resetResults.cubeGames.deleted +
      resetResults.users.deleted +
      resetResults.ledger.deleted;

    const hasErrors = Object.values(resetResults).some(result => result.error !== null);

    console.log(`[testResetAllData] Full data reset complete. Total deleted: ${totalDeleted}`);

    // 게임 생성 결과
    const gameCreationResults = {
      orderGames: { created: 0, error: null as string | null },
      randomGames: { created: 0, error: null as string | null },
      cubeGame: { created: false, error: null as string | null }
    };

    // 데이터 삭제 후 게임 생성
    try {
      console.log('[testResetAllData] Creating games after reset...');
      
      // Matching 게임 생성 함수 import
      const { createOrderGame, createRandomGame } = await import('./matching-game-new');
      const { createNewCubeGame } = await import('./cube-game-new');

      // 1. Order 게임 생성 (스케줄러처럼 다음 게임 1개만 생성)
      try {
        console.log('[testResetAllData] Creating next Order game...');
        await createOrderGame();
        gameCreationResults.orderGames.created++;
        console.log('[testResetAllData] Order game created successfully');
      } catch (error) {
        console.error('[testResetAllData] Error creating Order game:', error);
        gameCreationResults.orderGames.error = error instanceof Error ? error.message : 'Unknown error';
      }

      // 2. Random 게임 생성 (스케줄러처럼 다음 게임 1개만 생성)
      try {
        console.log('[testResetAllData] Creating next Random game...');
        await createRandomGame();
        gameCreationResults.randomGames.created++;
        console.log('[testResetAllData] Random game created successfully');
      } catch (error) {
        console.error('[testResetAllData] Error creating Random game:', error);
        gameCreationResults.randomGames.error = error instanceof Error ? error.message : 'Unknown error';
      }

      // 3. Cube 게임 생성
      try {
        console.log('[testResetAllData] Creating Cube game...');
        await createNewCubeGame();
        gameCreationResults.cubeGame.created = true;
        console.log('[testResetAllData] Cube game created successfully');
      } catch (error) {
        console.error('[testResetAllData] Error creating Cube game:', error);
        gameCreationResults.cubeGame.error = error instanceof Error ? error.message : 'Unknown error';
      }

    } catch (error) {
      console.error('[testResetAllData] Error during game creation:', error);
    }

    const gameCreationHasErrors = 
      gameCreationResults.orderGames.error !== null ||
      gameCreationResults.randomGames.error !== null ||
      gameCreationResults.cubeGame.error !== null;

    const totalGamesCreated = 
      gameCreationResults.orderGames.created +
      gameCreationResults.randomGames.created +
      (gameCreationResults.cubeGame.created ? 1 : 0);

    return {
      success: !hasErrors && !gameCreationHasErrors,
      message: hasErrors || gameCreationHasErrors
        ? 'Data reset completed with some errors. Check details below.'
        : `All data reset successfully. Total ${totalDeleted} items deleted. ${totalGamesCreated} games created.`,
      results: resetResults,
      totalDeleted,
      gamesCreated: gameCreationResults,
      totalGamesCreated
    };

  } catch (error) {
    console.error('[testResetAllData] Full data reset failed:', error);
    throw new Error(`Failed to reset all data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// 테스트 함수: 매칭 게임 정산 수동 트리거
export const testSettleMatchingGames = onCall(async (request: CallableRequest) => {
  if (!request.auth) {
    throw new Error('Authentication required');
  }

  try {
    console.log('[testSettleMatchingGames] Manually triggering settlement...');
    const { processMatchingGameSettlements } = await import('./matching-game-new');
    await processMatchingGameSettlements();

    return {
      success: true,
      message: 'Matching game settlement completed successfully'
    };
  } catch (error) {
    console.error('[testSettleMatchingGames] Settlement failed:', error);
    throw new Error(`Failed to settle matching games: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// HTTP endpoint: 매칭 게임 정산 (스크립트에서 호출용, 인증 불필요 - 로컬 전용)
export const settleMatchingGamesHttp = onRequest(async (req, res) => {
  // CORS 헤더 추가
  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  try {
    console.log('[settleMatchingGamesHttp] HTTP endpoint triggered');
    const { processMatchingGameSettlements } = await import('./matching-game-new');
    await processMatchingGameSettlements();

    res.status(200).json({
      success: true,
      message: 'Matching game settlement completed successfully'
    });
  } catch (error) {
    console.error('[settleMatchingGamesHttp] Settlement failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
