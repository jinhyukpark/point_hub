#!/bin/bash

# PointHub Game Auto Scheduler for Local Development
# This script automatically checks and creates expired games
# Run this in background: ./scripts/game-scheduler.sh &

EMULATOR_URL="http://127.0.0.1:9000"
DB_NS="point-hub-a9db1"
CHECK_INTERVAL=300  # 5분마다 체크

echo "🎮 PointHub Game Scheduler Started"
echo "📊 Checking games every ${CHECK_INTERVAL} seconds"
echo "⏱️  Press Ctrl+C to stop"
echo ""

check_and_create_games() {
    NOW=$(date +%s)000

    # Matching 게임 체크
    MATCHING_COUNT=$(curl -s "${EMULATOR_URL}/games/matching.json?ns=${DB_NS}" | jq -r --arg now "$NOW" '
        if . == null then 0 else
            to_entries |
            map(select(.value.status == "active" and (.value.endAt | tonumber) > ($now | tonumber))) |
            length
        end
    ')

    if [ "$MATCHING_COUNT" -lt 2 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Matching games expired. Settling and creating new games..."

        # 정산 먼저 실행 (오래된 게임 삭제 전)
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 💰 Settling expired games..."
        SETTLE_RESULT=$(curl -s -X POST "http://127.0.0.1:5001/point-hub-a9db1/us-central1/settleMatchingGamesHttp" 2>&1)
        if echo "$SETTLE_RESULT" | grep -q "success.*true"; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Settlement completed successfully"
        else
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  Settlement may have failed: $SETTLE_RESULT"
        fi

        # 정산 완료된 게임만 삭제 (settled 상태만)
        # closed 상태는 정산 대기 중이므로 삭제하지 않음
        curl -s "${EMULATOR_URL}/games/matching.json?ns=${DB_NS}" | jq -r '
            if . == null then [] else
                to_entries |
                map(select(.value.status == "settled")) |
                .[].key
            end
        ' | while read -r game_id; do
            if [ -n "$game_id" ]; then
                curl -X DELETE -s "${EMULATOR_URL}/games/matching/${game_id}.json?ns=${DB_NS}" > /dev/null 2>&1
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🗑️  Deleted settled game: $game_id"
            fi
        done

        # 새 게임 생성
        ORDER_ID="matching_order_${NOW}"
        RANDOM_ID="matching_random_${NOW}"
        END_TIME=$((NOW + 3600000))  # 1시간

        curl -X PUT -s "${EMULATOR_URL}/games/matching/${ORDER_ID}.json?ns=${DB_NS}" \
            -H "Content-Type: application/json" \
            -d "{
                \"gameId\": \"${ORDER_ID}\",
                \"gameType\": \"order\",
                \"status\": \"active\",
                \"startedAt\": ${NOW},
                \"endAt\": ${END_TIME},
                \"totalPot\": 0,
                \"betAmount\": 2,
                \"participants\": {},
                \"winningNumbers\": [],
                \"results\": [],
                \"createdAt\": ${NOW}
            }" > /dev/null 2>&1

        curl -X PUT -s "${EMULATOR_URL}/games/matching/${RANDOM_ID}.json?ns=${DB_NS}" \
            -H "Content-Type: application/json" \
            -d "{
                \"gameId\": \"${RANDOM_ID}\",
                \"gameType\": \"random\",
                \"status\": \"active\",
                \"startedAt\": ${NOW},
                \"endAt\": ${END_TIME},
                \"totalPot\": 0,
                \"betAmount\": 2,
                \"participants\": {},
                \"winningNumbers\": [],
                \"results\": [],
                \"createdAt\": ${NOW}
            }" > /dev/null 2>&1

        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ New matching games created (valid for 1 hour)"
    fi

    # Golden Bell 게임 체크
    ACTIVE_GOLDENBELL=$(curl -s "${EMULATOR_URL}/games/goldenbell.json?ns=${DB_NS}" | jq -r '
        if . == null then 0 else
            to_entries |
            map(select(.value.status == "active")) |
            length
        end
    ')

    WAITING_GOLDENBELL=$(curl -s "${EMULATOR_URL}/games/goldenbell.json?ns=${DB_NS}" | jq -r --arg now "$NOW" '
        if . == null then 0 else
            to_entries |
            map(select(.value.status == "waiting" and (.value.startAt | tonumber) > ($now | tonumber))) |
            length
        end
    ')

    if [ "$ACTIVE_GOLDENBELL" -eq 0 ] && [ "$WAITING_GOLDENBELL" -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  No active Golden Bell game. Creating new game..."

        GB_ID="goldenbell_${NOW}"
        START_TIME=$((NOW + 600000))  # 10분 후
        BETTING_START=$NOW
        BETTING_END=$((NOW + 540000))  # 9분간 베팅

        curl -X PUT -s "${EMULATOR_URL}/games/goldenbell/${GB_ID}.json?ns=${DB_NS}" \
            -H "Content-Type: application/json" \
            -d "{
                \"gameId\": \"${GB_ID}\",
                \"status\": \"waiting\",
                \"round\": 0,
                \"currentRound\": 0,
                \"totalRounds\": 5,
                \"maxParticipants\": 100,
                \"participants\": {},
                \"waitingRoom\": {},
                \"totalPot\": 0,
                \"currentBetAmount\": 10,
                \"startAt\": ${START_TIME},
                \"bettingStartAt\": ${BETTING_START},
                \"bettingEndAt\": ${BETTING_END},
                \"createdAt\": ${NOW}
            }" > /dev/null 2>&1

        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ New Golden Bell game created (starts in 10 minutes)"
    fi

    # Cube 게임 체크
    CUBE_COUNT=$(curl -s "${EMULATOR_URL}/games/cube.json?ns=${DB_NS}" | jq -r '
        if . == null then 0 else
            to_entries |
            map(select(.value.status == "waiting")) |
            length
        end
    ')

    if [ "$CUBE_COUNT" -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  No waiting Cube game. Creating new game..."

        CUBE_ID="cube_${NOW}"

        curl -X PUT -s "${EMULATOR_URL}/games/cube/${CUBE_ID}.json?ns=${DB_NS}" \
            -H "Content-Type: application/json" \
            -d "{
                \"gameId\": \"${CUBE_ID}\",
                \"status\": \"waiting\",
                \"participantCount\": 0,
                \"maxParticipants\": 2047,
                \"totalPot\": 0,
                \"betAmount\": 20,
                \"participants\": {},
                \"createdAt\": ${NOW}
            }" > /dev/null 2>&1

        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ New Cube game created (waiting for 2047 participants)"
    fi
}

# 메인 루프
while true; do
    check_and_create_games
    sleep $CHECK_INTERVAL
done
