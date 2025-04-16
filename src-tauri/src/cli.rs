use crate::log_manager::{LogEntry, LogManager};
use crate::settings::Settings;
use crate::summary::{SummaryConfig, SummaryGenerator, SummaryType};
use chrono::{Days, Local, NaiveDate, Utc};
use clap::{CommandFactory, Parser, Subcommand};
use log::{error, info};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

const VERSION: &str = env!("CARGO_PKG_VERSION");
const AUTHOR: &str = env!("CARGO_PKG_AUTHORS");

/// 工作日志记录 - 一个简单高效的工作日志管理工具
#[derive(Parser)]
#[command(name = "work-record")]
#[command(author = AUTHOR)]
#[command(version = VERSION)]
#[command(about = "工作日志记录 - 跟踪和管理你的日常工作记录", long_about = None)]
#[command(bin_name = "work-record")]
pub struct Cli {
    /// 启用详细日志输出
    #[arg(short, long)]
    verbose: bool,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// 添加一条新的日志记录
    Add {
        /// 日志内容
        #[arg(required = true)]
        content: String,

        /// 日志来源 (例如: git, note, meeting)
        #[arg(short, long, default_value = "manual")]
        source: String,

        /// 标签，可以多次指定
        #[arg(short, long)]
        tags: Vec<String>,

        /// 指定日期 (格式: YYYY-MM-DD)，默认为今天
        #[arg(short, long)]
        date: Option<String>,
    },

    /// 列出特定日期的日志记录
    List {
        /// 日期 (格式: YYYY-MM-DD)，默认为今天
        #[arg(short, long)]
        date: Option<String>,

        /// 输出格式 (text, json)
        #[arg(short, long, default_value = "text")]
        format: String,
    },

    /// 生成日志摘要
    Summary {
        /// 摘要类型 (daily, weekly, monthly, quarterly, custom)
        #[arg(short = 'y', long = "type", default_value = "weekly")]
        type_name: String,

        /// 起始日期 (格式: YYYY-MM-DD)
        #[arg(long)]
        start_date: Option<String>,

        /// 结束日期 (格式: YYYY-MM-DD)
        #[arg(long)]
        end_date: Option<String>,

        /// 摘要标题
        #[arg(short, long, default_value = "工作摘要")]
        title: String,

        /// 输出文件，默认打印到控制台
        #[arg(short, long)]
        output: Option<PathBuf>,
    },

    /// 打印应用配置信息
    Config,
}

/// 解析命令行参数并运行对应命令
pub async fn run_cli() -> Result<(), String> {
    let cli = Cli::parse();

    // 设置日志级别
    if cli.verbose {
        std::env::set_var("RUST_LOG", "debug");
    } else {
        std::env::set_var("RUST_LOG", "info");
    }

    // 根据命令执行相应操作
    match &cli.command {
        Some(Commands::Add {
            content,
            source,
            tags,
            date,
        }) => {
            add_log_entry(content, source, tags, date.as_deref())?;
        }
        Some(Commands::List { date, format }) => {
            list_log_entries(date.as_deref(), format)?;
        }
        Some(Commands::Summary {
            type_name,
            start_date,
            end_date,
            title,
            output,
        }) => {
            generate_summary(
                type_name,
                start_date.as_deref(),
                end_date.as_deref(),
                title,
                output.as_ref().map(|p| p.as_path()),
            ).await?;
        }
        Some(Commands::Config) => {
            show_config()?;
        }
        None => {
            // 没有子命令，显示帮助信息
            let help = Cli::command().render_help();
            println!("{}", help);
        }
    }

    Ok(())
}

/// 添加日志条目
fn add_log_entry(
    content: &str,
    source: &str,
    tags: &[String],
    date_str: Option<&str>,
) -> Result<(), String> {
    let settings = load_settings()?;
    let log_manager = LogManager::new(settings);

    let date = parse_date(date_str)?;

    let entry =
        LogEntry::new_with_date(content.to_string(), source.to_string(), tags.to_vec(), date);
    log_manager.add_entry(entry).map_err(|e| e.to_string())?;

    println!("✅ 已添加日志记录");
    Ok(())
}

/// 列出日志条目
fn list_log_entries(date_str: Option<&str>, format: &str) -> Result<(), String> {
    let settings = load_settings()?;
    let log_manager = LogManager::new(settings);

    let date = parse_date(date_str)?;

    let entries = log_manager
        .get_entries_for_date(&date)
        .map_err(|e| e.to_string())?;

    if entries.is_empty() {
        println!("📅 {} 没有任何日志记录", date.format("%Y-%m-%d"));
        return Ok(());
    }

    match format.to_lowercase().as_str() {
        "json" => {
            let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
            println!("{}", json);
        }
        _ => {
            println!("📅 日期: {}", date.format("%Y-%m-%d"));
            println!("📝 共有 {} 条日志记录:", entries.len());
            println!();

            for (i, entry) in entries.iter().enumerate() {
                println!("🔹 记录 #{}:", i + 1);
                println!("   内容: {}", entry.content);
                println!("   来源: {}", entry.source);

                if !entry.tags.is_empty() {
                    println!("   标签: {}", entry.tags.join(", "));
                }

                if let Some(time) = &entry.timestamp {
                    println!("   时间: {}", time.format("%H:%M:%S"));
                }

                println!();
            }
        }
    }

    Ok(())
}

/// 生成摘要
async fn generate_summary(
    type_name: &str,
    start_date_str: Option<&str>,
    end_date_str: Option<&str>,
    title: &str,
    output_path: Option<&Path>,
) -> Result<(), String> {
    let settings = load_settings()?;
    let log_manager = LogManager::new(settings.clone());

    // 确定摘要类型
    let summary_type = match type_name.to_lowercase().as_str() {
        "daily" => SummaryType::Custom, // 自定义一天
        "weekly" => SummaryType::Weekly,
        "monthly" => SummaryType::Monthly,
        "quarterly" => SummaryType::Quarterly,
        "custom" => SummaryType::Custom,
        _ => return Err(format!("不支持的摘要类型: {}", type_name)),
    };

    // 处理自定义日期范围
    let (start_date, end_date) = if matches!(summary_type, SummaryType::Custom) {
        let end = match end_date_str {
            Some(date_str) => parse_date(Some(date_str))?,
            None => Local::now().naive_local().date(),
        };

        let start = match start_date_str {
            Some(date_str) => parse_date(Some(date_str))?,
            None => {
                if type_name.to_lowercase() == "daily" {
                    end // 如果是daily且未指定开始日期，与结束日期相同
                } else {
                    return Err("自定义日期范围需要提供开始日期".to_string());
                }
            }
        };

        (Some(start), Some(end))
    } else {
        (None, None)
    };

    // 创建摘要配置
    let config = SummaryConfig {
        summary_type,
        start_date,
        end_date,
        title: title.to_string(),
    };

    // 获取日志数据
    let logs = match summary_type {
        SummaryType::Custom => {
            if let (Some(start), Some(end)) = (start_date, end_date) {
                log_manager
                    .get_entries_in_date_range(&start, &end)
                    .map_err(|e| e.to_string())?
            } else {
                return Err("自定义日期范围需要提供开始和结束日期".to_string());
            }
        }
        _ => {
            // 根据摘要类型自动计算日期范围
            let (start, end) = calculate_date_range(summary_type);
            log_manager
                .get_entries_in_date_range(&start, &end)
                .map_err(|e| e.to_string())?
        }
    };

    if logs.is_empty() {
        return Err("指定日期范围内没有日志记录".to_string());
    }

    // 生成摘要
    let summary_generator = SummaryGenerator::new(settings);
    let summary = summary_generator
        .generate_summary(logs, config)
        .await
        .map_err(|e| e.to_string())?;

    // 输出摘要
    match output_path {
        Some(path) => {
            std::fs::write(path, summary).map_err(|e| format!("写入文件失败: {}", e))?;
            println!("✅ 摘要已保存到: {}", path.display());
        }
        None => {
            println!("{}", summary);
        }
    }

    Ok(())
}

/// 根据摘要类型计算日期范围
fn calculate_date_range(summary_type: SummaryType) -> (NaiveDate, NaiveDate) {
    let now = Utc::now().naive_local().date();
    
    match summary_type {
        SummaryType::Weekly => {
            // 从当前日期倒推7天
            let start = now
                .checked_sub_days(Days::new(7))
                .unwrap_or(now);
            (start, now)
        }
        SummaryType::Monthly => {
            // 从当前日期倒推30天
            let start = now
                .checked_sub_days(Days::new(30))
                .unwrap_or(now);
            (start, now)
        }
        SummaryType::Quarterly => {
            // 从当前日期倒推90天
            let start = now
                .checked_sub_days(Days::new(90))
                .unwrap_or(now);
            (start, now)
        }
        SummaryType::Custom => {
            // 自定义类型会在函数外部处理
            (now, now)
        }
    }
}

/// 显示配置信息
fn show_config() -> Result<(), String> {
    let settings = load_settings()?;

    println!("📋 工作日志记录 配置信息:");
    println!("   日志存储目录: {}", settings.log_storage_dir);
    println!("   日志输出目录: {}", settings.log_output_dir);

    if !settings.git_author.is_empty() {
        println!("   Git 作者: {}", settings.git_author);
    }

    if !settings.shortcut.is_empty() {
        println!("   快捷键: {}", settings.shortcut);
    }

    println!(
        "   自动打开窗口: {}",
        if settings.auto_open_window {
            "是"
        } else {
            "否"
        }
    );

    if settings.use_local_ollama {
        println!("   使用本地 Ollama: 是");
        println!("   Ollama 地址: {}", settings.ollama_address);
        println!("   Ollama 模型: {}", settings.ollama_model);
    } else if !settings.llm_api_url.is_empty() {
        println!("   使用远程 LLM API");
        println!("   API 地址: {}", settings.llm_api_url);
        if !settings.llm_api_key.is_empty() {
            println!("   API 密钥: ********");
        }
    }

    Ok(())
}

/// 加载应用设置
fn load_settings() -> Result<Settings, String> {
    Ok(Settings::load_or_default())
}

/// 解析日期字符串，如果为 None 则返回今天的日期
fn parse_date(date_str: Option<&str>) -> Result<NaiveDate, String> {
    match date_str {
        Some(date_str) => NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
            .map_err(|e| format!("日期格式错误 (应为 YYYY-MM-DD): {}", e)),
        None => Ok(Local::now().naive_local().date()),
    }
}
