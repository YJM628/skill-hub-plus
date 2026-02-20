#!/bin/bash

set -e

echo "⚡ Starting Performance Test..."

CONCURRENT_REQUESTS=100
TOTAL_REQUESTS=1000
ENDPOINT="http://127.0.0.1:19823/v1/events"

echo "📊 Testing $TOTAL_REQUESTS requests with $CONCURRENT_REQUESTS concurrent connections..."

# 检查是否安装了 Apache Bench
if ! command -v ab &> /dev/null; then
    echo "❌ Apache Bench (ab) not found. Please install it first:"
    echo "   - macOS: brew install httpd"
    echo "   - Ubuntu/Debian: sudo apt-get install apache2-utils"
    echo "   - CentOS/RHEL: sudo yum install httpd-tools"
    exit 1
fi

# 创建测试负载
echo "📦 Creating test payload..."
cat > /tmp/ingest_payload.json << 'EOF'
{
  "events": [
    {
      "event_type": "skill_invoke",
      "skill_id": "perf-test",
      "timestamp": "2026-02-16T00:00:00Z",
      "user_id": "perf-user",
      "session_id": "perf-session",
      "input_hash": "perf-hash",
      "success": true,
      "duration_ms": 100,
      "error": null,
      "feedback_score": null,
      "cost": null,
      "caller": null,
      "metadata": {"test": "performance"}
    }
  ]
}
EOF

# 使用 Apache Bench 进行压力测试
echo "🚀 Running Apache Bench..."
ab -n $TOTAL_REQUESTS -c $CONCURRENT_REQUESTS -p /tmp/ingest_payload.json -T application/json $ENDPOINT

echo ""
echo "📈 Performance test completed!"
echo "Check the output above for:"
echo "  - Requests per second"
echo "  - Time per request"
echo "  - Failed requests (should be 0)"

# 清理
rm -f /tmp/ingest_payload.json

echo ""
echo "✨ Performance test script finished!"
