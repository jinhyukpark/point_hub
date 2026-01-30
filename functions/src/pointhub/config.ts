/**
 * PointHub API Configuration
 * API Version: 0.5
 */

// 환경변수에서 읽거나 기본값 사용 (운영 환경에서는 Firebase Functions config 사용)
export const POINTHUB_CONFIG = {
  // API Keys (운영 시 환경변수로 관리)
  API_KEY: process.env.POINTHUB_API_KEY || 'A9f3K2mX7Qr8LZ0w5N4BsYH1D6pVJcUeTqRkM9nFGx2bWlS8EaCdy0P7Z6tR',
  SECRET_KEY: process.env.POINTHUB_SECRET_KEY || 'G7kP2wZ9Q4rL1xV6M8fC0bS5T3yNJDpHaUeRjWqXlFvB8mY2oKz1cE9tR4X4',
  COM_CODE: process.env.POINTHUB_COM_CODE || 'UNIDECA',

  // API Base URL (포인트허브 도메인으로 변경 필요)
  BASE_URL: process.env.POINTHUB_BASE_URL || 'https://pointhub.example.com/API/PH',

  // Timeout settings
  REQUEST_TIMEOUT_MS: 30000,

  // Timestamp validity (5 minutes)
  TIMESTAMP_VALIDITY_MS: 5 * 60 * 1000,
};

// API Endpoints
export const POINTHUB_ENDPOINTS = {
  // 회원
  MEMBER_CHECK: '/MEMBER/Check',

  // USDP (현금성 포인트)
  USDP_SELECT: '/USDP/select',
  USDP_TRANSFER: '/USDP/TRANSFER',
  USDP_WITHDRAW: '/USDP/TRANSFER_WITHDRAW',

  // USDM (마일리지)
  USDM_SELECT: '/USDM/select',
  USDM_TRANSFER: '/USDM/TRANSFER',
  USDM_WITHDRAW: '/USDM/TRANSFER_WITHDRAW',

  // Gpoint
  GPOINT_SELECT: '/GPOINT/SELECT',
  GPOINT_TRANSFER: '/Gpoint/TRANSFER',
  GPOINT_WITHDRAW: '/Gpoint/TRANSFER_WITHDRAW',

  // GPorder
  GPORDER_SELECT: '/GPORDER/SELECT',
  GPORDER_TRANSFER: '/GPORDER/TRANSFER',
  GPORDER_WITHDRAW: '/GPORDER/TRANSFER_WITHDRAW',
};

// Transaction Codes
export const TRANS_CODES = {
  // USDP
  USDP_IN: 'IN_Rech_USDT_API',
  USDP_OUT: 'OUT_PAY_USDT_API',

  // USDM
  USDM_IN: 'IN_Rech_USDM_API',
  USDM_OUT: 'OUT_PAY_USDM_API',

  // Gpoint
  GPOINT_IN: 'IN_Rech_GPoint_API',
  GPOINT_OUT: 'OUT_PAY_GPoint_API',

  // GPorder
  GPORDER_IN: 'IN_Rech_GPorder_API',
  GPORDER_OUT: 'OUT_PAY_GPorder_API',
};

// GPorder Types
export const GPORDER_TYPES = {
  GAME_SALES_1: '03', // 게임매출1: 모든 게임 수익의 20%
  GAME_SALES_2: '04', // 게임매출2: 골든벨 승자 없는 게임의 재원
};

// Error Codes
export const POINTHUB_ERROR_CODES: Record<string, string> = {
  '0000': '성공',
  '9999': '에러',
  '1000': '등록된 회사아이디가 없습니다.',
  '1001': '요청한 데이터가 존재하지 않습니다.',
  '6774': '요청시간이 올바르지 않습니다.',
  '7001': '허용되지 않은 아이피입니다.',
  '8001': '포인트 허브에 연동된 회원이 존재하지 않습니다.',
  '8004': '포인트 코드가 일치하지 않습니다.',
  '8005': '이미 입금신청된 주문번호입니다.',
  '9001': '출금금액이 부족합니다.',
  '9002': '포인트허브에 등록된 출금 비밀번호와 일치하지 않습니다.',
  '9003': '이미 출금신청된 주문번호입니다.',
};
