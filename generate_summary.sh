#!/bin/bash

# 设置日志级别
export RUST_LOG=info

# 获取当前脚本所在目录
SCRIPT_DIR=$(dirname "$(realpath "$0")")

# 构建项目（如果需要）
if [ "$1" == "--build" ]; then
    echo "构建日志摘要工具..."
    cargo build --release --bin wr-summary --manifest-path="$SCRIPT_DIR/src-tauri/Cargo.toml"
    shift
fi

# 检查是否存在编译好的二进制文件
BINARY_PATH="$SCRIPT_DIR/src-tauri/target/release/wr-summary"
if [ ! -f "$BINARY_PATH" ]; then
    echo "未找到编译好的二进制文件，正在构建..."
    cargo build --release --bin wr-summary --manifest-path="$SCRIPT_DIR/src-tauri/Cargo.toml"
fi

# 运行日志摘要工具
echo "正在生成日志摘要，请稍候..."
"$BINARY_PATH" "$@" 