#!/bin/bash

# CAM Web Docker 构建脚本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
IMAGE_NAME="cam-web"
IMAGE_TAG="${1:-latest}"
REGISTRY="${REGISTRY:-}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}CAM Web Docker 构建脚本${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    exit 1
fi

# 显示构建信息
echo -e "${YELLOW}镜像名称:${NC} ${IMAGE_NAME}"
echo -e "${YELLOW}镜像标签:${NC} ${IMAGE_TAG}"
if [ -n "$REGISTRY" ]; then
    echo -e "${YELLOW}镜像仓库:${NC} ${REGISTRY}"
fi

# 构建镜像
echo -e "\n${GREEN}开始构建 Docker 镜像...${NC}"
if [ -n "$REGISTRY" ]; then
    FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
else
    FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
fi

docker build -t "${FULL_IMAGE_NAME}" .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Docker 镜像构建成功${NC}"
    echo -e "${GREEN}镜像: ${FULL_IMAGE_NAME}${NC}"
else
    echo -e "${RED}✗ Docker 镜像构建失败${NC}"
    exit 1
fi

# 显示镜像信息
echo -e "\n${GREEN}镜像信息:${NC}"
docker images "${FULL_IMAGE_NAME}"

# 询问是否推送到仓库
if [ -n "$REGISTRY" ]; then
    echo -e "\n${YELLOW}是否推送镜像到仓库? (y/n)${NC}"
    read -r PUSH_CONFIRM
    if [ "$PUSH_CONFIRM" = "y" ] || [ "$PUSH_CONFIRM" = "Y" ]; then
        echo -e "${GREEN}推送镜像到仓库...${NC}"
        docker push "${FULL_IMAGE_NAME}"
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ 镜像推送成功${NC}"
        else
            echo -e "${RED}✗ 镜像推送失败${NC}"
            exit 1
        fi
    fi
fi

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}构建完成!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n${YELLOW}运行容器:${NC}"
echo -e "  docker run -d -p 8080:80 --name cam-web ${FULL_IMAGE_NAME}"
echo -e "\n${YELLOW}使用 docker-compose:${NC}"
echo -e "  docker-compose up -d"
