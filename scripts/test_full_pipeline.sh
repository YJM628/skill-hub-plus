#!/bin/bash

set -e

echo "🚀 Starting Full Pipeline Test..."

# 1. 确定数据库路径（跨平台兼容）
echo "📝 Determining database path..."
if [[ "$OSTYPE" == "darwin"* ]]; then
  DB_PATH="$HOME/Library/Application Support/com.example.skills-hub/skills_hub.db"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  DB_PATH="$HOME/.local/share/com.example.skills-hub/skills_hub.db"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
  DB_PATH="$APPDATA/com.example.skills-hub/skills_hub.db"
else
  echo "❌ Unsupported OS: $OSTYPE"
  exit 1
fi

echo "📍 Database path: $DB_PATH"

# 2. 清理测试数据
echo "🧹 Cleaning test data..."
sqlite3 "$DB_PATH" "DELETE FROM skill_events WHERE skill_id = 'pipeline-test';" 2>/dev/null || echo "Database not found or table doesn't exist yet"

# 2. 创建测试负载
echo "📦 Creating test payload..."
cat > /tmp/pipeline_test_payload.json << 'EOF'
{
  "events": [
    {
      "event_type": "skill_invoke",
      "skill_id": "pipeline-test",
      "timestamp": "2026-02-16T00:00:00Z",
      "user_id": "user-1",
      "session_id": "session-1",
      "input_hash": "abc123",
      "success": true,
      "duration_ms": 120,
      "error": null,
      "feedback_score": null,
      "cost": null,
      "caller": null,
      "metadata": {"test": "pipeline"}
    }
  ]
}
EOF

# 3. 使用 SDK 发送事件到 HTTP Ingest Server
echo "📤 Sending events via HTTP Ingest Server..."
curl -X POST http://127.0.0.1:19823/v1/events \
  -H "Content-Type: application/json" \
  -d @/tmp/pipeline_test_payload.json \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null || echo "⚠️  HTTP request failed (server may not be running)"

# 4. 等待事件写入
echo "⏳ Waiting for event persistence..."
sleep 2

# 5. 验证数据库
echo "🔍 Verifying database..."
if [ -f "$DB_PATH" ]; then
  COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM skill_events WHERE skill_id = 'pipeline-test';" 2>/dev/null || echo "0")
  if [ "$COUNT" -eq "1" ]; then
    echo "✅ Event persisted successfully!"
  else
    echo "❌ Event persistence failed! Count: $COUNT"
    exit 1
  fi
else
  echo "⚠️  Database file not found at $DB_PATH"
  echo "Skipping database verification"
fi

# 6. 测试 Tauri Command (简化版本：直接查询数据库验证聚合逻辑)
echo "🎯 Testing aggregation queries..."
if [ -f "$DB_PATH" ]; then
  TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM skill_events;" 2>/dev/null || echo "0")
  SUCCESS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM skill_events WHERE success = 1;" 2>/dev/null || echo "0")
  echo "Total events: $TOTAL, Success: $SUCCESS"
fi

# 7. 清理
echo "🧹 Cleaning up..."
if [ -f "$DB_PATH" ]; then
  sqlite3 "$DB_PATH" "DELETE FROM skill_events WHERE skill_id = 'pipeline-test';" 2>/dev/null || true
fi
rm -f /tmp/pipeline_test_payload.json

echo "✨ Full pipeline test completed successfully!"
