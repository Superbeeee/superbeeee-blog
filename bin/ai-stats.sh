#!/usr/bin/env bash
# AI 流量查詢工具
# Usage: ./scripts/ai-stats.sh <subcommand>
#
# Subcommands:
#   today        最近 24 小時的 AI 訪問
#   7d           過去 7 天 AI 來源排行
#   30d          過去 30 天 AI 來源排行
#   top-posts    過去 30 天被 AI 抓最多的文章
#   referrals    從 AI 對話點連結進來的紀錄（最有價值）
#   total        全部紀錄筆數
#   live         即時 stream（wrangler tail）
#   raw "<SQL>"  直接執行任意 SQL

set -euo pipefail

DB="ai_traffic"
WORKER="superbeeee-blog"

run_sql() {
  npx wrangler d1 execute "$DB" --remote --command="$1"
}

case "${1:-help}" in
  today)
    run_sql "SELECT ts, ai_source, kind, path FROM hits
             WHERE ts > datetime('now','-1 day')
             ORDER BY ts DESC;"
    ;;
  7d|week)
    run_sql "SELECT ai_source, kind, count(*) AS hits FROM hits
             WHERE ts > datetime('now','-7 days')
             GROUP BY ai_source, kind ORDER BY hits DESC;"
    ;;
  30d|month)
    run_sql "SELECT ai_source, kind, count(*) AS hits FROM hits
             WHERE ts > datetime('now','-30 days')
             GROUP BY ai_source, kind ORDER BY hits DESC;"
    ;;
  top-posts)
    run_sql "SELECT path, count(*) AS hits FROM hits
             WHERE ts > datetime('now','-30 days')
             GROUP BY path ORDER BY hits DESC LIMIT 20;"
    ;;
  referrals)
    run_sql "SELECT ts, ai_source, path, referer FROM hits
             WHERE kind IN ('referral','realtime')
             ORDER BY ts DESC LIMIT 50;"
    ;;
  total)
    run_sql "SELECT count(*) AS total_hits,
                    min(ts) AS first_seen,
                    max(ts) AS last_seen FROM hits;"
    ;;
  live)
    npx wrangler tail "$WORKER" --format pretty
    ;;
  raw)
    if [[ $# -lt 2 ]]; then echo "usage: $0 raw \"<SQL>\""; exit 1; fi
    run_sql "$2"
    ;;
  help|*)
    sed -n '2,15p' "$0"
    ;;
esac
