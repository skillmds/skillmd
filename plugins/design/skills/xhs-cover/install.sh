#!/bin/bash
# 小红书封面生成器 - Codex Skill 安装脚本

set -e

REPO_URL="https://github.com/Vivixiao980/xhs-cover-skill"

# 自动检测安装平台。Codex 优先，因为可直接调用内置图片生成/编辑能力。
PLATFORM=""
if [ -d "$HOME/.codex" ] || command -v codex &> /dev/null; then
  SKILL_DIR="$HOME/.codex/skills/xhs-cover-skill"
  PLATFORM="Codex"
  echo "📍 检测到 Codex，安装到 $SKILL_DIR"
elif [ -d "$HOME/.claude/skills" ]; then
  SKILL_DIR="$HOME/.claude/skills/xhs-cover"
  PLATFORM="Claude Code"
  echo "📍 检测到 Claude Code，安装到 $SKILL_DIR"
elif [ -d "$HOME/.openclaw/skills" ]; then
  SKILL_DIR="$HOME/.openclaw/skills/xhs-cover"
  PLATFORM="OpenClaw"
  echo "📍 检测到 OpenClaw，安装到 $SKILL_DIR"
else
  echo "未检测到 Codex、Claude Code 或 OpenClaw 的 skills 目录。请选择安装位置："
  echo "  1) Codex（推荐） ($HOME/.codex/skills/xhs-cover-skill)"
  echo "  2) Claude Code  ($HOME/.claude/skills/xhs-cover)"
  echo "  3) OpenClaw     ($HOME/.openclaw/skills/xhs-cover)"
  echo "  4) 自定义路径"
  read -r -p "请输入选项 [1/2/3/4]: " choice
  case "$choice" in
    1) SKILL_DIR="$HOME/.codex/skills/xhs-cover-skill"; PLATFORM="Codex" ;;
    2) SKILL_DIR="$HOME/.claude/skills/xhs-cover"; PLATFORM="Claude Code" ;;
    3) SKILL_DIR="$HOME/.openclaw/skills/xhs-cover"; PLATFORM="OpenClaw" ;;
    4) read -r -p "请输入完整安装路径: " SKILL_DIR; PLATFORM="Custom" ;;
    *) echo "无效选项"; exit 1 ;;
  esac
fi

echo "🎨 安装小红书封面生成器 Skill..."

# 检查 git
if ! command -v git &> /dev/null; then
  echo "❌ 未检测到 git，请先安装 git。"
  exit 1
fi

# 检查 Node.js 版本。Codex 主流程不依赖 Node；Gemini CLI 备用方案需要 Node >= 18。
INSTALL_NODE_DEPS=0
if ! command -v node &> /dev/null; then
  if [ "$PLATFORM" = "Codex" ]; then
    echo "⚠️  未检测到 Node.js，将跳过 Gemini CLI 备用方案依赖安装。Codex 生图主流程仍可使用。"
  else
    echo "❌ 未检测到 Node.js。Gemini CLI 备用方案需要 Node.js 18 或更高版本："
    echo "   https://nodejs.org/"
    exit 1
  fi
else
  NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
  if [ "$NODE_MAJOR" -lt 18 ]; then
    if [ "$PLATFORM" = "Codex" ]; then
      echo "⚠️  Node.js 版本过低（当前 $(node -v)，需要 >= v18），将跳过 Gemini CLI 备用方案依赖安装。"
    else
      echo "❌ Node.js 版本过低（当前 $(node -v)，需要 >= v18）"
      echo "   请升级 Node.js：https://nodejs.org/"
      exit 1
    fi
  else
    INSTALL_NODE_DEPS=1
    echo "✓ Node.js $(node -v)"
  fi
fi

# 检查是否已存在
if [ -d "$SKILL_DIR" ]; then
  echo "⚠️  Skill 已存在于 $SKILL_DIR"
  read -r -p "   是否更新？现有文件将被覆盖 [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "已取消。"
    exit 0
  fi
  echo "🔄 更新中..."
  git -C "$SKILL_DIR" pull 2>/dev/null || {
    echo "   Git pull 失败，重新克隆..."
    read -r -p "   需要删除 $SKILL_DIR 并重新安装，确认继续？[y/N] " confirm2
    if [[ ! "$confirm2" =~ ^[Yy]$ ]]; then
      echo "已取消。"
      exit 0
    fi
    rm -rf "$SKILL_DIR"
    git clone "$REPO_URL" "$SKILL_DIR"
  }
else
  mkdir -p "$(dirname "$SKILL_DIR")"
  git clone "$REPO_URL" "$SKILL_DIR"
fi

if [ "$INSTALL_NODE_DEPS" -eq 1 ]; then
  # 安装依赖（兼容 npm 6 的 --production 和 npm 7+ 的 --omit=dev）
  echo "📦 安装依赖（sharp，用于 Gemini CLI 备用方案）..."
  cd "$SKILL_DIR"
  if npm install --omit=dev --silent 2>/dev/null || npm install --production --silent; then
    :
  else
    echo "❌ 依赖安装失败。如果是 sharp 编译错误，尝试："
    echo "   cd $SKILL_DIR && npm install --omit=dev --ignore-scripts && npm rebuild sharp"
    exit 1
  fi
  echo "✓ 依赖安装完成"
else
  echo "已跳过 Node 依赖安装。"
fi

echo ""
echo "✅ 安装完成！"
echo ""
if [ "$PLATFORM" = "Codex" ]; then
  echo "重启 Codex 后，输入「生成封面」或「小红书封面」即可开始使用。"
  echo "默认优先调用 Codex 的图片生成/编辑能力；Gemini API 仅作为备用方案。"
elif [ "$PLATFORM" = "Custom" ]; then
  echo "安装路径：$SKILL_DIR"
  echo "请重启对应的客户端，然后输入「生成封面」或「小红书封面」开始使用。"
else
  echo "重启 $PLATFORM 后，输入「生成封面」或「小红书封面」即可开始使用。"
  echo "如果当前环境没有 Codex 图片生成能力，会引导配置 Gemini API 备用方案。"
fi
echo ""
echo "📖 详细文档：$REPO_URL"
echo "🌐 风格预览：https://xhscover.vivi.wiki"
