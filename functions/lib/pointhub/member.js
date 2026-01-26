"use strict";
/**
 * PointHub Member API
 * 회원 확인 및 연동
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPointHubLinkStatus = exports.verifyPointHubMember = void 0;
exports.checkPointHubMember = checkPointHubMember;
exports.linkPointHubMember = linkPointHubMember;
exports.getLinkedPointHubMember = getLinkedPointHubMember;
exports.getGameUidByPointHubMember = getGameUidByPointHubMember;
const https_1 = require("firebase-functions/v2/https");
const firebase_config_1 = require("../firebase-config");
const config_1 = require("./config");
const api_client_1 = require("./api-client");
const auth_1 = require("./auth");
/**
 * 포인트허브 회원 확인 API 호출
 *
 * @param webID 회원 아이디
 * @param webPassword 회원 비밀번호 (평문)
 * @returns 포인트허브 회원 ID
 */
async function checkPointHubMember(webID, webPassword) {
    const hashedPassword = (0, auth_1.sha256Hash)(webPassword);
    const response = await (0, api_client_1.callPointHubAPI)(config_1.POINTHUB_ENDPOINTS.MEMBER_CHECK, {
        webID,
        WebPassWord: hashedPassword,
    });
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
async function linkPointHubMember(gameUid, pointHubMember) {
    await firebase_config_1.rtdb.ref(`/users/${gameUid}/pointhub`).set({
        mbid: pointHubMember.mbid,
        mbid2: pointHubMember.mbid2,
        combined: pointHubMember.combined,
        linkedAt: Date.now(),
    });
    // 포인트허브 회원번호로 게임 UID 역참조 저장 (빠른 조회용)
    await firebase_config_1.rtdb.ref(`/pointhub/members/${pointHubMember.combined}`).set({
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
async function getLinkedPointHubMember(gameUid) {
    const snapshot = await firebase_config_1.rtdb.ref(`/users/${gameUid}/pointhub`).once('value');
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
async function getGameUidByPointHubMember(mbid, mbid2) {
    const combined = `${mbid}-${mbid2}`;
    const snapshot = await firebase_config_1.rtdb.ref(`/pointhub/members/${combined}`).once('value');
    const data = snapshot.val();
    return (data === null || data === void 0 ? void 0 : data.gameUid) || null;
}
/**
 * 포인트허브 회원 확인 및 연동 Cloud Function
 * 클라이언트에서 로그인 시 호출
 */
exports.verifyPointHubMember = (0, https_1.onCall)(async (request) => {
    // 인증 확인
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const { webID, webPassword } = request.data;
    if (!webID || !webPassword) {
        throw new https_1.HttpsError('invalid-argument', 'webID and webPassword are required');
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
    }
    catch (error) {
        console.error('[PointHub] Member verification failed:', error);
        if (error.code === '8001') {
            throw new https_1.HttpsError('not-found', '포인트허브에 등록된 회원이 아닙니다.');
        }
        throw new https_1.HttpsError('internal', error.message || 'Failed to verify PointHub member');
    }
});
/**
 * 현재 사용자의 포인트허브 연동 상태 확인 Cloud Function
 */
exports.getPointHubLinkStatus = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const gameUid = request.auth.uid;
    const linkedMember = await getLinkedPointHubMember(gameUid);
    return {
        success: true,
        isLinked: !!linkedMember,
        memberId: linkedMember,
    };
});
//# sourceMappingURL=member.js.map