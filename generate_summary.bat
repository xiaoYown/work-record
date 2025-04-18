@echo off
setlocal enabledelayedexpansion

rem 设置日志级别
set RUST_LOG=info

rem 获取当前脚本所在目录
set SCRIPT_DIR=%~dp0

rem 构建项目（如果需要）
if "%1"=="--build" (
    echo 构建日志摘要工具...
    cargo build --release --bin wr-summary --manifest-path="%SCRIPT_DIR%src-tauri\Cargo.toml"
    shift
)

rem 检查是否存在编译好的二进制文件
set BINARY_PATH=%SCRIPT_DIR%src-tauri\target\release\wr-summary.exe
if not exist "%BINARY_PATH%" (
    echo 未找到编译好的二进制文件，正在构建...
    cargo build --release --bin wr-summary --manifest-path="%SCRIPT_DIR%src-tauri\Cargo.toml"
)

rem 运行日志摘要工具
echo 正在生成日志摘要，请稍候...
"%BINARY_PATH%" %* 