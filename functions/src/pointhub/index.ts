/**
 * PointHub Integration Module
 * 포인트허브 API 연동 모듈
 *
 * 주요 기능:
 * 1. 회원 확인: 포인트허브 회원 여부 조회 및 게임 계정 연동
 * 2. Gpoint 출금: 포인트허브 → 게임 (6시간 배치)
 * 3. GPorder 입금: 게임 → 포인트허브 (6시간 배치)
 */

// Configuration
export { POINTHUB_CONFIG, POINTHUB_ENDPOINTS, TRANS_CODES, GPORDER_TYPES } from './config';

// Authentication
export { generateSignature, sha256Hash, generateHeaders, getUnixTimestamp } from './auth';

// API Client
export { callPointHubAPI, callPointHubAPIJson, generateOrderNum, getDateRangeForBatch } from './api-client';

// Member API
export {
  checkPointHubMember,
  linkPointHubMember,
  getLinkedPointHubMember,
  getGameUidByPointHubMember,
  verifyPointHubMember,
  getPointHubLinkStatus,
} from './member';

// Gpoint API
export {
  selectGpoints,
  withdrawGpoints,
  processGpointWithdrawals,
  runGpointBatchWithdraw,
  getGpointBalance,
} from './gpoint';

// GPorder API
export {
  transferGporders,
  saveGameRevenue,
  recordGameSales1,
  recordGameSales2,
  runGporderBatchTransfer,
  onGameProfit,
  onGoldenBellNoWinner,
  testGporderTransfer,
} from './gporder';

// Schedulers
export {
  gpointWithdrawScheduler,
  gporderTransferScheduler,
  manualGpointWithdraw,
  manualGporderTransfer,
  getBatchStatus,
} from './scheduler';
