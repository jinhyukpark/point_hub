# Game Scheduler Scripts

로컬 개발 환경에서 게임을 자동으로 관리하는 스크립트입니다.

## 사용법

### 1. 자동 스케줄러 시작

터미널에서 실행:

```bash
# 프로젝트 루트에서
./scripts/game-scheduler.sh
```

또는 백그라운드로 실행:

```bash
./scripts/game-scheduler.sh &
```

### 2. 백그라운드 프로세스 확인

```bash
# 실행 중인 스케줄러 확인
ps aux | grep game-scheduler

# 로그 확인 (백그라운드로 실행한 경우)
tail -f nohup.out
```

### 3. 스케줄러 중지

```bash
# 프로세스 ID 확인
ps aux | grep game-scheduler

# 프로세스 종료
kill <PID>

# 또는 모든 스케줄러 종료
pkill -f game-scheduler
```

## 동작 방식

스크립트는 **5분마다** 다음을 체크합니다:

### Matching 게임
- 활성 게임이 2개 미만이면:
  1. **정산 먼저**: 만료된 게임의 당첨번호 생성 및 보상 지급
  2. **삭제**: 만료된 게임 제거
  3. **생성**: 새 게임 자동 생성 (ORDER 1개 + RANDOM 1개)
- 유효 시간: 1시간

### Golden Bell 게임
- Active 또는 Waiting 게임이 없으면 자동 생성
- 베팅 시간: 9분
- 게임 시작: 10분 후
- 총 5라운드

### Cube 게임
- Waiting 상태 게임이 없으면 자동 생성
- 베팅 금액: $20
- 최대 참가자: 2047명

## 프로덕션 환경

프로덕션에서는 **Firebase Cloud Scheduler**가 자동으로 실행됩니다:

### Matching 게임
- `matchingGameSettlementScheduler`: 매 1분마다 실행
  - 종료된 게임 정산
  - 새 게임 자동 생성
- `matchingOrderScheduler`: 매일 자정 ORDER 게임 생성
- `matchingRandomScheduler`: 매 6시간마다 RANDOM 게임 생성

### Golden Bell 게임
- `goldenBellDailyScheduler`: 매일 자정 하루치 게임 생성
- `goldenBellRecoveryScheduler`: 5분 간격으로 스케줄 확인
- `goldenBellRoundScheduler`: 매 1분마다 라운드 시작 체크

### Cube 게임
- `cubeGameSettlementScheduler`: 매 1분마다 실행
  - 종료된 게임 정산
  - 새 게임 자동 생성

### Oracle
- `oracleSnapshot`: 매 1분마다 암호화폐 가격 업데이트

## 문제 해결

### 스크립트가 실행되지 않는 경우

```bash
# 실행 권한 부여
chmod +x ./scripts/game-scheduler.sh

# jq 설치 확인 (JSON 처리용)
brew install jq  # macOS
```

### 에뮬레이터가 실행 중인지 확인

```bash
# Database 에뮬레이터 확인
curl http://127.0.0.1:9000/.json?ns=pointhub-ab054

# Functions 에뮬레이터 확인
curl http://127.0.0.1:5001
```

## 주의사항

- **로컬 개발 전용**: 프로덕션에서는 사용하지 마세요
- **에뮬레이터 필수**: Firebase 에뮬레이터가 실행 중이어야 합니다
- **자동 정산**: 만료된 매칭 게임은 삭제 전에 자동으로 정산됩니다
- **자동 정리**: 정산 완료된 게임은 자동으로 삭제됩니다
