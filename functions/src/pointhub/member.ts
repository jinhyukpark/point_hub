/**
 * PointHub Member API
 * 회원 확인 및 연동
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { CallableRequest } from 'firebase-functions/v2/https';
import { rtdb } from '../firebase-config';
import { POINTHUB_ENDPOINTS } from './config';
import { callPointHubAPI } from './api-client';
import { sha256Hash } from './auth';

// 회원 확인 응답 타입
interface MemberCheckResponse {
  mbid: string;   // 포인트허브 회원고유번호 1 (예: "EN")
  mbid2: string;  // 포인트허브 회원고유번호 2 (예: "60549422")
}

// 통합 회원 ID (PK)
export interface PointHubMemberId {
  mbid: string;
  mbid2: string;
  combined: string; // "mbid-mbid2" 형식 (예: "EN-60549422")
}

/**
 * 포인트허브 회원 확인 API 호출
 *
 * @param webID 회원 아이디
 * @param webPassword 회원 비밀번호 (평문)
 * @returns 포인트허브 회원 ID
 */
export async function checkPointHubMember(
  webID: string,
  webPassword: string
): Promise<PointHubMemberId> {
  const hashedPassword = sha256Hash(webPassword);

  const response = await callPointHubAPI<MemberCheckResponse[]>(
    POINTHUB_ENDPOINTS.MEMBER_CHECK,
    {
      webID,
      WebPassWord: hashedPassword,
    }
  );

  // data가 배열로 올 수 있음
  const memberData = Array.isArray(response.data) ? response.data[0] : response.data;

  if (!memberData || !memberData.mbid || !memberData.mbid2) {
    throw new Error('Invalid member data from PointHub');
  }

  return {
    mbid: memberData.mbid,
    mbid2: memberData.mbid2,
    combined: `${memberData.mbid}-${memberData.mbid2}`,
  };
}

/**
 * 게임 사용자와 포인트허브 회원 연동
 * Firebase Realtime Database에 포인트허브 회원 정보 저장
 *
 * @param gameUid 게임 사용자 UID
 * @param pointHubMember 포인트허브 회원 정보
 */
export async function linkPointHubMember(
  gameUid: string,
  pointHubMember: PointHubMemberId
): Promise<void> {
  await rtdb.ref(`/users/${gameUid}/pointhub`).set({
    mbid: pointHubMember.mbid,
    mbid2: pointHubMember.mbid2,
    combined: pointHubMember.combined,
    linkedAt: Date.now(),
  });

  // 포인트허브 회원번호로 게임 UID 역참조 저장 (빠른 조회용)
  await rtdb.ref(`/pointhub/members/${pointHubMember.combined}`).set({
    gameUid,
    linkedAt: Date.now(),
  });

  console.log(`[PointHub] Linked game user ${gameUid} to PointHub member ${pointHubMember.combined}`);
}

/**
 * 게임 사용자의 포인트허브 연동 정보 조회
 *
 * @param gameUid 게임 사용자 UID
 * @returns 포인트허브 회원 정보 또는 null
 */
export async function getLinkedPointHubMember(
  gameUid: string
): Promise<PointHubMemberId | null> {
  const snapshot = await rtdb.ref(`/users/${gameUid}/pointhub`).once('value');
  const data = snapshot.val();

  if (!data || !data.mbid || !data.mbid2) {
    return null;
  }

  return {
    mbid: data.mbid,
    mbid2: data.mbid2,
    combined: data.combined || `${data.mbid}-${data.mbid2}`,
  };
}

/**
 * 포인트허브 회원번호로 게임 사용자 UID 조회
 *
 * @param mbid 포인트허브 회원고유번호 1
 * @param mbid2 포인트허브 회원고유번호 2
 * @returns 게임 사용자 UID 또는 null
 */
export async function getGameUidByPointHubMember(
  mbid: string,
  mbid2: string
): Promise<string | null> {
  const combined = `${mbid}-${mbid2}`;
  const snapshot = await rtdb.ref(`/pointhub/members/${combined}`).once('value');
  const data = snapshot.val();

  return data?.gameUid || null;
}

/**
 * 포인트허브 회원 확인 및 연동 Cloud Function
 * 클라이언트에서 로그인 시 호출
 */
export const verifyPointHubMember = onCall(
  async (request: CallableRequest<{ webID: string; webPassword: string }>) => {
    // 인증 확인
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { webID, webPassword } = request.data;

    if (!webID || !webPassword) {
      throw new HttpsError('invalid-argument', 'webID and webPassword are required');
    }

    try {
      const gameUid = request.auth.uid;

      // 이미 연동된 경우 기존 정보 반환
      const existingLink = await getLinkedPointHubMember(gameUid);
      if (existingLink) {
        console.log(`[PointHub] User ${gameUid} already linked to ${existingLink.combined}`);
        return {
          success: true,
          alreadyLinked: true,
          memberId: existingLink,
        };
      }

      // 포인트허브 회원 확인
      const pointHubMember = await checkPointHubMember(webID, webPassword);

      // 연동 저장
      await linkPointHubMember(gameUid, pointHubMember);

      return {
        success: true,
        alreadyLinked: false,
        memberId: pointHubMember,
      };
    } catch (error: any) {
      console.error('[PointHub] Member verification failed:', error);

      if (error.code === '8001') {
        throw new HttpsError('not-found', '포인트허브에 등록된 회원이 아닙니다.');
      }

      throw new HttpsError('internal', error.message || 'Failed to verify PointHub member');
    }
  }
);

/**
 * 현재 사용자의 포인트허브 연동 상태 확인 Cloud Function
 */
export const getPointHubLinkStatus = onCall(
  async (request: CallableRequest) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const gameUid = request.auth.uid;
    const linkedMember = await getLinkedPointHubMember(gameUid);

    return {
      success: true,
      isLinked: !!linkedMember,
      memberId: linkedMember,
    };
  }
);
