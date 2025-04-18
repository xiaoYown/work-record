use chrono::NaiveDate;
use clap::{Parser, Subcommand, ValueEnum};
use std::path::PathBuf;
use std::process;
use work_record::errors::AppError;
use work_record::log_summary_cli::LogSummaryCliHandler;
use work_record::settings::Settings;
use work_record::summary::SummaryType;

#[derive(Debug, Parser)]
#[command(author, version, about = "工作日志摘要生成工具")]
struct Cli {
    /// 子命令
    #[command(subcommand)]
    command: Option<Commands>,

    /// 摘要类型
    #[arg(short, long, value_enum, default_value_t = SummaryTypeArg::Weekly)]
    summary_type: SummaryTypeArg,

    /// 开始日期（格式：YYYY-MM-DD）
    #[arg(short, long)]
    start_date: Option<String>,

    /// 结束日期（格式：YYYY-MM-DD）
    #[arg(short, long)]
    end_date: Option<String>,

    /// 日志存储目录
    #[arg(short, long)]
    log_dir: Option<PathBuf>,

    /// 输出目录
    #[arg(short, long)]
    output_dir: Option<PathBuf>,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// 生成摘要
    Generate {},
    /// 仅显示日志内容而不生成摘要
    ShowLogs {},
}

#[derive(Clone, Debug, ValueEnum)]
enum SummaryTypeArg {
    /// 周摘要
    Weekly,
    /// 月摘要
    Monthly,
    /// 季度摘要
    Quarterly,
    /// 自定义日期范围
    Custom,
}

impl From<SummaryTypeArg> for SummaryType {
    fn from(arg: SummaryTypeArg) -> Self {
        match arg {
            SummaryTypeArg::Weekly => SummaryType::Weekly,
            SummaryTypeArg::Monthly => SummaryType::Monthly,
            SummaryTypeArg::Quarterly => SummaryType::Quarterly,
            SummaryTypeArg::Custom => SummaryType::Custom,
        }
    }
}

/// 解析日期字符串为NaiveDate
fn parse_date(date_str: &str) -> Result<NaiveDate, AppError> {
    NaiveDate::parse_from_str(date_str, "%Y-%m-%d").map_err(|e| {
        AppError::SummaryError(format!("日期格式错误 '{}': {}", date_str, e))
    })
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志
    env_logger::init();

    // 解析命令行参数
    let cli = Cli::parse();

    // 加载设置
    let mut settings = match Settings::load_or_default() {
        Ok(settings) => settings,
        Err(e) => {
            eprintln!("无法加载设置：{}", e);
            // 使用默认设置
            Settings::default()
        }
    };

    // 如果提供了日志目录参数，则覆盖设置中的值
    if let Some(log_dir) = cli.log_dir {
        settings.log_storage_dir = log_dir
            .to_str()
            .unwrap_or_else(|| {
                eprintln!("日志目录路径包含无效字符");
                process::exit(1);
            })
            .to_string();
    }

    // 如果提供了输出目录参数，则覆盖设置中的值
    if let Some(output_dir) = cli.output_dir {
        settings.log_output_dir = output_dir
            .to_str()
            .unwrap_or_else(|| {
                eprintln!("输出目录路径包含无效字符");
                process::exit(1);
            })
            .to_string();
    }

    // 创建处理器
    let mut handler = LogSummaryCliHandler::new(settings);

    // 设置摘要类型
    let summary_type: SummaryType = cli.summary_type.into();
    handler.set_summary_type(summary_type);

    // 如果是自定义日期范围，则需要解析开始和结束日期
    if summary_type == SummaryType::Custom {
        let start_date = match cli.start_date {
            Some(date_str) => parse_date(&date_str)?,
            None => {
                eprintln!("自定义摘要需要提供开始日期");
                process::exit(1);
            }
        };

        let end_date = match cli.end_date {
            Some(date_str) => parse_date(&date_str)?,
            None => {
                eprintln!("自定义摘要需要提供结束日期");
                process::exit(1);
            }
        };

        handler.set_custom_date_range(start_date, end_date)?;
    } else if cli.start_date.is_some() || cli.end_date.is_some() {
        eprintln!("警告：指定了开始或结束日期，但摘要类型不是Custom，日期参数将被忽略");
    }

    // 执行命令
    match cli.command {
        Some(Commands::ShowLogs {}) => {
            handler.print_full_logs()?;
        }
        Some(Commands::Generate {}) | None => {
            // 默认行为是生成摘要
            match handler.generate_summary().await {
                Ok(_) => {
                    println!("摘要生成完成。");
                    // 显示完整日志
                    println!("\n原始日志内容:");
                    handler.print_full_logs()?;
                }
                Err(e) => {
                    eprintln!("生成摘要失败：{}", e);
                    process::exit(1);
                }
            }
        }
    }

    Ok(())
} 