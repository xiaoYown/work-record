use crate::errors::AppError;
use dirs::home_dir;
use log;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// 应用设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    /// 日志记录文件存储目录
    pub log_storage_dir: String,
    /// 日志生成目录
    pub log_output_dir: String,
    /// Git 作者名称
    pub git_author: String,
    /// 是否在启动时自动打开窗口
    pub auto_open_window: bool,
    /// 快捷键
    pub shortcut: String,
    /// 是否启用快捷键
    pub enable_shortcut: bool,
    /// 是否使用本地 Ollama 服务
    pub use_local_ollama: bool,
    /// Ollama 服务地址
    pub ollama_address: String,
    /// Ollama 模型名称
    pub ollama_model: String,
    /// LLM API Key
    pub llm_api_key: String,
    /// LLM API URL
    pub llm_api_url: String,
}

impl Default for Settings {
    fn default() -> Self {
        let home_path = home_dir().unwrap_or_else(|| PathBuf::from("."));
        let default_log_dir = home_path.join("work_records").to_string_lossy().to_string();
        let default_output_dir = home_path
            .join("work_records/summaries")
            .to_string_lossy()
            .to_string();

        // 获取系统 Git 用户
        let git_author = get_system_git_author().unwrap_or_else(|_| String::from(""));

        Self {
            log_storage_dir: default_log_dir,
            log_output_dir: default_output_dir,
            git_author,
            auto_open_window: false,
            shortcut: "Alt+Shift+L".to_string(),
            enable_shortcut: true,
            use_local_ollama: true,
            ollama_address: "http://localhost:11434".to_string(),
            ollama_model: "llama3".to_string(),
            llm_api_key: String::new(),
            llm_api_url: String::new(),
        }
    }
}

impl Settings {
    /// 获取设置文件路径
    fn get_settings_path() -> PathBuf {
        // 设置文件存在用户配置目录下
        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("work-record");

        // 确保配置目录存在
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).unwrap_or_else(|_| {});
        }

        config_dir.join("settings.json")
    }

    /// 加载设置或使用默认值
    pub fn load_or_default() -> Result<Self, AppError> {
        let settings_path = Self::get_settings_path();

        let settings = if settings_path.exists() {
            match fs::read_to_string(&settings_path) {
                Ok(content) => serde_json::from_str(&content).map_err(AppError::from)?,
                Err(_) => Self::default(),
            }
        } else {
            let default_settings = Self::default();
            let _ = default_settings.save();
            default_settings
        };

        // 确保日志目录存在
        if let Err(e) = settings.ensure_log_dirs_exist() {
            log::warn!("无法创建日志目录: {}", e);
        }

        Ok(settings)
    }

    /// 保存设置到文件
    pub fn save(&self) -> Result<(), AppError> {
        let settings_path = Self::get_settings_path();
        let content = serde_json::to_string_pretty(self)?;
        fs::write(settings_path, content)?;
        Ok(())
    }

    /// 确保日志目录存在
    pub fn ensure_log_dirs_exist(&self) -> Result<(), AppError> {
        let storage_dir = Path::new(&self.log_storage_dir);
        let output_dir = Path::new(&self.log_output_dir);

        if !storage_dir.exists() {
            fs::create_dir_all(storage_dir)
                .map_err(|e| AppError::FsError(format!("无法创建日志存储目录: {}", e)))?;
        }

        if !output_dir.exists() {
            fs::create_dir_all(output_dir)
                .map_err(|e| AppError::FsError(format!("无法创建日志输出目录: {}", e)))?;
        }

        Ok(())
    }

    /// 获取摘要API类型
    pub fn get_summary_api_type(&self) -> u8 {
        if self.use_local_ollama {
            0 // 本地Ollama
        } else if self.llm_api_url.contains("dashscope.aliyuncs.com") {
            2 // 百炼API
        } else {
            1 // 标准OpenAI API
        }
    }

    /// 获取摘要API密钥
    pub fn get_summary_api_key(&self, api_type: u8) -> String {
        if api_type == 0 {
            // 本地Ollama不需要API密钥
            String::new()
        } else {
            self.llm_api_key.clone()
        }
    }

    /// 获取摘要API URL
    pub fn get_summary_api_url(&self, api_type: u8) -> String {
        match api_type {
            0 => format!("{}/api/generate", self.ollama_address),
            _ => self.llm_api_url.clone(),
        }
    }
}

/// 获取系统 Git 用户名
fn get_system_git_author() -> Result<String, AppError> {
    let config = git2::Config::open_default()?;
    let name = config.get_string("user.name")?;
    Ok(name)
}
