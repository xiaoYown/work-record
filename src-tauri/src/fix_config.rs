use dirs::home_dir;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// 应用设置结构，与原始设置相同
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub log_storage_dir: String,
    pub log_output_dir: String,
    pub git_author: String,
    pub auto_open_window: bool,
    pub shortcut: String,
    pub enable_shortcut: bool,
    pub use_local_ollama: bool,
    pub ollama_address: String,
    pub ollama_model: String,
    pub llm_api_key: String,
    pub llm_api_url: String,
}

/// 诊断并修复配置问题
pub fn diagnose_and_fix_config() -> Result<(), String> {
    println!("开始诊断配置问题...");

    // 获取配置目录
    let config_dir = get_config_dir();
    println!("配置目录: {}", config_dir.display());

    // 确保配置目录存在
    if !config_dir.exists() {
        println!("配置目录不存在，创建中...");
        fs::create_dir_all(&config_dir).map_err(|e| format!("创建配置目录失败: {}", e))?;
    }

    // 设置文件路径
    let settings_path = config_dir.join("settings.json");

    let mut settings = if settings_path.exists() {
        println!("找到设置文件: {}", settings_path.display());
        // 读取设置文件
        let content =
            fs::read_to_string(&settings_path).map_err(|e| format!("读取设置文件失败: {}", e))?;

        // 解析设置
        match serde_json::from_str::<Settings>(&content) {
            Ok(s) => {
                println!("成功解析设置");
                s
            }
            Err(e) => {
                println!("解析设置失败，创建新的设置: {}", e);
                create_default_settings()
            }
        }
    } else {
        println!("设置文件不存在，创建新的设置");
        create_default_settings()
    };

    // 默认存储目录使用了~/work_records，如果用户指定了其他目录，要尊重用户设置
    let user_specified_dir = settings.log_storage_dir
        != home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("work_records")
            .to_string_lossy()
            .to_string();

    // 如果用户设置了/tmp/work_logs作为存储目录，使用它
    if !user_specified_dir {
        let tmp_dir = "/tmp/work_logs";
        println!("设置日志存储目录为: {}", tmp_dir);
        settings.log_storage_dir = tmp_dir.to_string();
        settings.log_output_dir = format!("{}/summaries", tmp_dir);
    }

    // 保存设置
    let content =
        serde_json::to_string_pretty(&settings).map_err(|e| format!("序列化设置失败: {}", e))?;

    fs::write(&settings_path, content).map_err(|e| format!("保存设置文件失败: {}", e))?;

    println!(
        "配置已修复，日志存储目录设置为: {}",
        settings.log_storage_dir
    );

    // 确保日志目录存在
    let storage_dir = Path::new(&settings.log_storage_dir);
    if !storage_dir.exists() {
        println!("创建日志目录: {}", storage_dir.display());
        fs::create_dir_all(storage_dir).map_err(|e| format!("创建日志目录失败: {}", e))?;
    }

    let output_dir = Path::new(&settings.log_output_dir);
    if !output_dir.exists() {
        println!("创建日志输出目录: {}", output_dir.display());
        fs::create_dir_all(output_dir).map_err(|e| format!("创建日志输出目录失败: {}", e))?;
    }

    Ok(())
}

/// 获取配置目录
fn get_config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("work-record")
}

/// 创建默认设置
fn create_default_settings() -> Settings {
    let home_path = home_dir().unwrap_or_else(|| PathBuf::from("."));
    let tmp_dir = "/tmp/work_logs";

    Settings {
        log_storage_dir: tmp_dir.to_string(),
        log_output_dir: format!("{}/summaries", tmp_dir),
        git_author: String::new(),
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
