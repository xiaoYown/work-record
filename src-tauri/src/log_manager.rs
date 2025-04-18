use crate::errors::AppError;
use crate::settings::Settings;
use chrono::{DateTime, Local, NaiveDate, Utc};
use log;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// 单条日志记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    /// 唯一标识符
    pub id: String,
    /// 日志内容
    pub content: String,
    /// 创建时间 (ISO 8601 格式)
    pub created_at: String,
    /// 来源 (manual, git-commit, etc.)
    pub source: String,
    /// 标签
    pub tags: Vec<String>,
    /// 时间戳，可选
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<DateTime<Local>>,
}

impl LogEntry {
    /// 创建新的日志记录
    pub fn new(content: String, source: String, tags: Vec<String>) -> Self {
        let now = Utc::now();
        Self {
            id: format!("{}", now.timestamp_millis()),
            content,
            created_at: now.to_rfc3339(),
            source,
            tags,
            timestamp: Some(now.with_timezone(&Local)),
        }
    }

    /// 创建指定日期的日志记录
    pub fn new_with_date(
        content: String,
        source: String,
        tags: Vec<String>,
        date: NaiveDate,
    ) -> Self {
        // 使用指定日期和当前时间
        let now = Local::now();
        let date_time = date.and_time(now.time()).and_local_timezone(Local).unwrap();

        Self {
            id: format!("{}", date_time.timestamp_millis()),
            content,
            created_at: date_time.to_rfc3339(),
            source,
            tags,
            timestamp: Some(date_time),
        }
    }
}

/// 日志文件管理器
pub struct LogManager {
    settings: Settings,
}

impl LogManager {
    /// 创建新的日志管理器
    pub fn new(settings: Settings) -> Self {
        Self { settings }
    }

    /// 获取指定日期的日志文件路径
    pub fn get_log_file_path(&self, date: &NaiveDate) -> PathBuf {
        let file_name = format!("{}.json", date.format("%Y-%m-%d"));
        Path::new(&self.settings.log_storage_dir).join(file_name)
    }

    /// 获取指定日期的日志记录
    pub fn get_entries_for_date(&self, date: &NaiveDate) -> Result<Vec<LogEntry>, AppError> {
        let file_path = self.get_log_file_path(date);

        if !file_path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(file_path)?;
        let entries: Vec<LogEntry> = serde_json::from_str(&content)?;

        Ok(entries)
    }

    /// 添加日志记录
    pub fn add_entry(&self, entry: LogEntry) -> Result<(), AppError> {
        // 确保日志目录存在
        self.settings.ensure_log_dirs_exist()?;

        // 从创建时间解析日期
        let created_at = DateTime::parse_from_rfc3339(&entry.created_at)
            .map_err(|e| AppError::ChronoError(e))?
            .with_timezone(&Local);

        let date = created_at.date_naive();
        let file_path = self.get_log_file_path(&date);

        let mut entries = if file_path.exists() {
            let content = fs::read_to_string(&file_path)?;
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Vec::new()
        };

        entries.push(entry);

        let content = serde_json::to_string_pretty(&entries)?;
        fs::write(file_path, content)?;

        Ok(())
    }

    /// 更新日志记录
    pub fn update_entry(&self, updated_entry: LogEntry) -> Result<(), AppError> {
        // 从创建时间解析日期
        let created_at = DateTime::parse_from_rfc3339(&updated_entry.created_at)
            .map_err(|e| AppError::ChronoError(e))?
            .with_timezone(&Local);

        let date = created_at.date_naive();
        let file_path = self.get_log_file_path(&date);

        if !file_path.exists() {
            return Err(AppError::LogManagerError(format!(
                "未找到日期 {} 的日志文件",
                date
            )));
        }

        let content = fs::read_to_string(&file_path)?;
        let mut entries: Vec<LogEntry> = serde_json::from_str(&content)?;

        // 查找并更新对应 ID 的记录
        let mut found = false;
        for entry in &mut entries {
            if entry.id == updated_entry.id {
                *entry = updated_entry.clone();
                found = true;
                break;
            }
        }

        if !found {
            return Err(AppError::LogManagerError(format!(
                "未找到 ID 为 {} 的日志记录",
                updated_entry.id
            )));
        }

        let updated_content = serde_json::to_string_pretty(&entries)?;
        fs::write(file_path, updated_content)?;

        Ok(())
    }

    /// 删除日志记录
    pub fn delete_entry(&self, entry_id: &str, date: &NaiveDate) -> Result<(), AppError> {
        let file_path = self.get_log_file_path(date);

        if !file_path.exists() {
            return Err(AppError::LogManagerError(format!(
                "未找到日期 {} 的日志文件",
                date
            )));
        }

        let content = fs::read_to_string(&file_path)?;
        let mut entries: Vec<LogEntry> = serde_json::from_str(&content)?;

        let original_len = entries.len();
        entries.retain(|entry| entry.id != entry_id);

        if entries.len() == original_len {
            return Err(AppError::LogManagerError(format!(
                "未找到 ID 为 {} 的日志记录",
                entry_id
            )));
        }

        if entries.is_empty() {
            // 如果没有记录了，就删除文件
            fs::remove_file(file_path)?;
        } else {
            let updated_content = serde_json::to_string_pretty(&entries)?;
            fs::write(file_path, updated_content)?;
        }

        Ok(())
    }

    /// 获取所有日志文件
    pub fn get_log_files(&self) -> Result<Vec<String>, AppError> {
        log::info!("开始获取日志文件列表");

        // 确保日志目录存在
        self.settings.ensure_log_dirs_exist()?;

        let dir = Path::new(&self.settings.log_storage_dir);
        let mut files = Vec::new();

        log::debug!("查找日志目录: {}", dir.display());

        if !dir.exists() {
            log::warn!("日志目录不存在: {}", dir.display());
            return Ok(files);
        }

        log::debug!("日志目录存在，开始读取文件列表");

        // 遍历目录内容
        for entry_result in fs::read_dir(dir)? {
            match entry_result {
                Ok(entry) => {
                    let path = entry.path();
                    log::trace!("找到文件: {}", path.display());

                    if path.is_file()
                        && path.extension().and_then(|ext| ext.to_str()) == Some("json")
                    {
                        if let Some(file_name) = path.file_name().and_then(|name| name.to_str()) {
                            log::debug!("添加日志文件: {}", file_name);
                            files.push(file_name.to_string());
                        }
                    }
                }
                Err(e) => {
                    log::error!("读取目录项失败: {}", e);
                    continue; // 跳过无法读取的项
                }
            }
        }

        // 按日期排序（最新的在前）
        files.sort_by(|a, b| b.cmp(a));

        log::info!("找到 {} 个日志文件", files.len());
        if !files.is_empty() {
            log::debug!("最新的日志文件: {}", files[0]);
        }

        Ok(files)
    }

    /// 获取指定时间范围内的所有日志
    pub fn get_entries_in_date_range(
        &self,
        start_date: &NaiveDate,
        end_date: &NaiveDate,
    ) -> Result<HashMap<String, Vec<LogEntry>>, AppError> {
        let mut result = HashMap::new();
        let mut current_date = *start_date;

        while current_date <= *end_date {
            let entries = self.get_entries_for_date(&current_date)?;
            if !entries.is_empty() {
                let date_str = current_date.format("%Y-%m-%d").to_string();
                result.insert(date_str, entries);
            }
            current_date = current_date.succ_opt().unwrap_or(*end_date);
        }

        Ok(result)
    }
}
