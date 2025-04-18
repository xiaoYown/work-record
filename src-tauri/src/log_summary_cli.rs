use crate::errors::AppError;
use crate::log_manager::LogManager;
use crate::settings::Settings;
use crate::summary::{SummaryConfig, SummaryGenerator, SummaryType};
use chrono::{Datelike, Local, NaiveDate};
use colored::Colorize;
use std::io::{self, Write};

/// 日志摘要处理器
pub struct LogSummaryCliHandler {
    /// 日志管理器
    log_manager: LogManager,
    /// 摘要生成器
    summary_generator: SummaryGenerator,
    /// 摘要配置
    config: SummaryConfig,
}

impl LogSummaryCliHandler {
    /// 创建新的日志摘要处理器
    pub fn new(settings: Settings) -> Self {
        let log_manager = LogManager::new(settings.clone());
        let summary_generator = SummaryGenerator::new(settings);
        
        // 创建默认的摘要配置（周摘要）
        let now = Local::now().date_naive();
        let title = format!("周工作总结（{} 至 {}）", 
            now.checked_sub_days(chrono::Days::new(6)).unwrap().format("%Y-%m-%d"),
            now.format("%Y-%m-%d")
        );
        
        let config = SummaryConfig {
            summary_type: SummaryType::Weekly,
            start_date: Some(now.checked_sub_days(chrono::Days::new(6)).unwrap()),
            end_date: Some(now),
            title,
        };
        
        Self {
            log_manager,
            summary_generator,
            config,
        }
    }
    
    /// 设置摘要类型
    pub fn set_summary_type(&mut self, summary_type: SummaryType) {
        self.config.summary_type = summary_type;
        
        // 更新日期范围和标题
        let now = Local::now().date_naive();
        match summary_type {
            SummaryType::Weekly => {
                let start_date = now.checked_sub_days(chrono::Days::new(6)).unwrap();
                self.config.start_date = Some(start_date);
                self.config.end_date = Some(now);
                self.config.title = format!("周工作总结（{} 至 {}）", 
                    start_date.format("%Y-%m-%d"),
                    now.format("%Y-%m-%d")
                );
            },
            SummaryType::Monthly => {
                let start_date = NaiveDate::from_ymd_opt(now.year(), now.month(), 1).unwrap();
                self.config.start_date = Some(start_date);
                self.config.end_date = Some(now);
                self.config.title = format!("月度工作总结（{} 至 {}）", 
                    start_date.format("%Y-%m-%d"),
                    now.format("%Y-%m-%d")
                );
            },
            SummaryType::Quarterly => {
                let quarter_month = (now.month() - 1) / 3 * 3 + 1;
                let start_date = NaiveDate::from_ymd_opt(now.year(), quarter_month, 1).unwrap();
                self.config.start_date = Some(start_date);
                self.config.end_date = Some(now);
                self.config.title = format!("季度工作总结（{} 至 {}）", 
                    start_date.format("%Y-%m-%d"),
                    now.format("%Y-%m-%d")
                );
            },
            SummaryType::Custom => {
                // 自定义类型保持不变，外部需要设置日期范围和标题
            },
        }
    }
    
    /// 设置自定义日期范围
    pub fn set_custom_date_range(&mut self, start_date: NaiveDate, end_date: NaiveDate) -> Result<(), AppError> {
        if start_date > end_date {
            return Err(AppError::SummaryError(
                "开始日期不能晚于结束日期".to_string()
            ));
        }
        
        self.config.summary_type = SummaryType::Custom;
        self.config.start_date = Some(start_date);
        self.config.end_date = Some(end_date);
        self.config.title = format!("工作总结（{} 至 {}）", 
            start_date.format("%Y-%m-%d"),
            end_date.format("%Y-%m-%d")
        );
        
        Ok(())
    }
    
    /// 生成日志摘要
    pub async fn generate_summary(&self) -> Result<String, AppError> {
        // 验证日期范围
        let start_date = self.config.start_date.ok_or_else(|| 
            AppError::SummaryError("未设置开始日期".to_string())
        )?;
        
        let end_date = self.config.end_date.ok_or_else(|| 
            AppError::SummaryError("未设置结束日期".to_string())
        )?;
        
        // 获取日期范围内的日志
        let logs = self.log_manager.get_entries_in_date_range(&start_date, &end_date)?;
        
        // 如果没有日志，返回错误
        if logs.is_empty() {
            return Err(AppError::SummaryError(
                format!("在 {} 至 {} 期间没有找到日志记录", 
                    start_date.format("%Y-%m-%d"),
                    end_date.format("%Y-%m-%d")
                )
            ));
        }
        
        println!("正在生成摘要，请稍候...");
        
        // 生成摘要
        let summary = self.summary_generator
            .generate_summary(logs, self.config.clone())
            .await?;
        
        println!("摘要生成完成\n");
        
        // 输出摘要内容
        println!("{}", summary);
        
        Ok(summary)
    }
    
    /// 打印完整日志
    pub fn print_full_logs(&self) -> Result<(), AppError> {
        // 验证日期范围
        let start_date = self.config.start_date.ok_or_else(|| 
            AppError::SummaryError("未设置开始日期".to_string())
        )?;
        
        let end_date = self.config.end_date.ok_or_else(|| 
            AppError::SummaryError("未设置结束日期".to_string())
        )?;
        
        // 获取日期范围内的日志
        let logs = self.log_manager.get_entries_in_date_range(&start_date, &end_date)?;
        
        // 如果没有日志，返回错误
        if logs.is_empty() {
            return Err(AppError::SummaryError(
                format!("在 {} 至 {} 期间没有找到日志记录", 
                    start_date.format("%Y-%m-%d"),
                    end_date.format("%Y-%m-%d")
                )
            ));
        }
        
        // 打印标题
        println!("\n{}\n", self.config.title.bold());
        
        // 按日期排序
        let mut dates: Vec<String> = logs.keys().cloned().collect();
        dates.sort_by(|a, b| b.cmp(a)); // 日期降序排列
        
        // 打印每一天的日志
        for date in dates {
            if let Some(entries) = logs.get(&date) {
                println!("{}", date.blue().bold());
                
                for entry in entries {
                    let tag_str = if !entry.tags.is_empty() {
                        format!(" [{}]", entry.tags.join(", "))
                    } else {
                        String::new()
                    };
                    
                    println!("- {}{}", entry.content, tag_str.yellow());
                }
                
                println!();
            }
        }
        
        Ok(())
    }
} 