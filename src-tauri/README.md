# 工作日志摘要工具

这是一个用于生成工作日志摘要的命令行工具，可以根据已存储的日志记录，按周、月、季度或自定义日期范围生成摘要报告。

## 功能特点

- 支持多种时间范围：周、月、季度、自定义
- 流式输出摘要内容，实时查看生成进度
- 支持控制台彩色输出，提升阅读体验
- 可同时查看原始日志内容和生成的摘要

## 使用方法

### 基本命令

```bash
# 生成默认的周摘要（过去一周）
wr-summary

# 生成月度摘要
wr-summary -t monthly

# 生成季度摘要
wr-summary -t quarterly

# 生成自定义日期范围的摘要
wr-summary -t custom -s 2023-01-01 -e 2023-01-31

# 仅显示日志内容，不生成摘要
wr-summary show-logs

# 指定日志存储目录
wr-summary -l /path/to/logs

# 指定输出目录
wr-summary -o /path/to/output
```

### 命令行选项

- `-t, --summary-type`：摘要类型 [可选值: weekly, monthly, quarterly, custom] [默认值: weekly]
- `-s, --start-date`：开始日期（格式：YYYY-MM-DD）
- `-e, --end-date`：结束日期（格式：YYYY-MM-DD）
- `-l, --log-dir`：日志存储目录
- `-o, --output-dir`：输出目录
- `-h, --help`：显示帮助信息
- `-V, --version`：显示版本信息

## 示例输出

```
周工作总结（2023-01-01 至 2023-01-07）

#### 工作内容
本周主要完成了项目A的需求分析与初步设计，同时进行了项目B的代码审查。

#### 成果
1. 完成了项目A的需求文档
2. 提交了项目A的概要设计方案
3. 审查并修复了项目B中的5个关键bug

#### 存在的问题
项目进度略有延迟，主要原因是需求变更较频繁。

#### 改进建议
1. 加强与产品团队的沟通，减少需求变更
2. 优化代码审查流程，提高效率

原始日志内容:
2023-01-07
- 完成项目A概要设计方案 [项目A, 设计]
- 与产品团队讨论需求变更 [会议, 需求]

2023-01-06
- 修复项目B中的3个关键bug [项目B, 缺陷修复]
- 进行代码审查 [代码审查]

...
```

## 构建方法

```bash
# 在项目根目录下执行
cargo build --release --bin wr-summary
```

构建完成后，二进制文件将位于 `target/release/wr-summary`。

## 依赖项

- chrono：日期时间处理
- clap：命令行参数解析
- colored：控制台彩色输出
- tokio：异步运行时
- serde/serde_json：序列化与反序列化
- reqwest：HTTP客户端（用于与LLM API通信）

## 许可证

MIT 