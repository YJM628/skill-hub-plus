#!/bin/bash

# 启动开发环境脚本
# 同时启动主应用（Vite）和 chat-panel-fullstack（Next.js）

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================${NC}"
echo -e "${BLUE}Starting Skills Hub Dev Environment${NC}"
echo -e "${BLUE}====================================${NC}"

# 启动主应用（Vite）
echo -e "${YELLOW}[1/2] Starting Vite main app on port 5173...${NC}"
npm run dev &
VITE_PID=$!

# 等待 Vite 启动
sleep 3

# 启动 chat-panel-fullstack（Next.js）
echo -e "${YELLOW}[2/2] Starting Next.js chat-panel-fullstack on port 3000...${NC}"
cd chat-panel-fullstack && npm run dev &
NEXT_PID=$!

# 保存 PID 到文件
echo "$VITE_PID" > .vite.pid
echo "$NEXT_PID" > .next.pid

echo -e "${GREEN}✓ Both services are starting...${NC}"
echo -e "${GREEN}  - Vite: http://localhost:5173${NC}"
echo -e "${GREEN}  - Next.js: http://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# 等待信号来清理
trap "echo ''; echo -e '${YELLOW}Stopping services...${NC}'; kill $VITE_PID $NEXT_PID 2>/dev/null; rm -f .vite.pid .next.pid; exit 0" SIGINT SIGTERM

# 保持脚本运行
wait
