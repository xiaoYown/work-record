use crate::app_state::AppState;
use crate::git_utils::{get_daily_commits, get_working_directory};
use crate::log_manager::{LogEntry, LogManager};
use crate::settings::Settings;
use crate::summary::{SummaryConfig, SummaryGenerator, SummaryType};
use chrono::{NaiveDate, Utc};
use std::collections::HashMap;
use std::path::Path;
use tauri::{AppHandle, GlobalShortcutManager, Manager, State};

#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::fs;

#[cfg(target_os = "macos")]
use std::os::unix::fs::symlink;

#[cfg(any(target_os = "macos", target_os = "linux"))]
use std::process::Command;

#[cfg(target_os = "windows")]
use tauri::api::dialog;

/// 添加日志条目
#[tauri::command]
pub async fn add_log_entry(
    content: String,
    source: String,
    tags: Vec<String>,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let settings = app_state.get_settings();
    let log_manager = LogManager::new(settings);
    
    let entry = LogEntry::new(content, source, tags);
    log_manager.add_entry(entry).map_err(|e| e.to_string())
}

/// 获取指定日期的日志条目
#[tauri::command]
pub async fn get_log_entries(
    date: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<LogEntry>, String> {
    let settings = app_state.get_settings();
    let log_manager = LogManager::new(settings);
    
    let date = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|e| format!("日期格式错误：{}", e))?;
    
    log_manager
        .get_entries_for_date(&date)
        .map_err(|e| e.to_string())
}

/// 获取日志文件列表
#[tauri::command]
pub async fn get_log_files(app_state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let settings = app_state.get_settings();
    let log_manager = LogManager::new(settings);
    
    log_manager.get_log_files().map_err(|e| e.to_string())
}

/// 更新日志条目
#[tauri::command]
pub async fn update_log_entry(
    entry: LogEntry,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let settings = app_state.get_settings();
    let log_manager = LogManager::new(settings);
    
    log_manager.update_entry(entry).map_err(|e| e.to_string())
}

/// 删除日志条目
#[tauri::command]
pub async fn delete_log_entry(
    entry_id: String,
    date: String,
    app_state: State<'_, AppState>,
) -> Result<(), String> {
    let settings = app_state.get_settings();
    let log_manager = LogManager::new(settings);
    
    let date = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|e| format!("日期格式错误：{}", e))?;
    
    log_manager
        .delete_entry(&entry_id, &date)
        .map_err(|e| e.to_string())
}

/// 从 Git 仓库获取提交信息
#[tauri::command]
pub async fn fetch_git_commits(
    repo_path: Option<String>,
    date: String,
    app_state: State<'_, AppState>,
) -> Result<Vec<HashMap<String, String>>, String> {
    let settings = app_state.get_settings();
    
    let path = match repo_path {
        Some(path) => path,
        None => get_working_directory().map_err(|e| e.to_string())?,
    };
    
    let date = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|e| format!("日期格式错误：{}", e))?;
    
    let commits = get_daily_commits(Path::new(&path), &settings.git_author, &date)
        .map_err(|e| e.to_string())?;
    
    // 将 GitCommit 转换为前端可用的格式
    let result: Vec<HashMap<String, String>> = commits
        .into_iter()
        .map(|commit| {
            let mut map = HashMap::new();
            map.insert("id".to_string(), commit.id);
            map.insert("message".to_string(), commit.message);
            map.insert("time".to_string(), commit.time.to_rfc3339());
            map.insert("author".to_string(), commit.author);
            map
        })
        .collect();
    
    Ok(result)
}

/// 生成日志摘要
#[tauri::command]
pub async fn generate_summary(
    summary_type: u8,
    start_date: Option<String>,
    end_date: Option<String>,
    title: String,
    app_state: State<'_, AppState>,
) -> Result<String, String> {
    // 转换摘要类型
    let summary_type = match summary_type {
        0 => SummaryType::Weekly,
        1 => SummaryType::Monthly,
        2 => SummaryType::Quarterly,
        _ => SummaryType::Custom,
    };
    
    // 解析日期
    let start_date = if let Some(date_str) = start_date {
        Some(
            NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
                .map_err(|e| format!("开始日期格式错误：{}", e))?,
        )
    } else {
        None
    };
    
    let end_date = if let Some(date_str) = end_date {
        Some(
            NaiveDate::parse_from_str(&date_str, "%Y-%m-%d")
                .map_err(|e| format!("结束日期格式错误：{}", e))?,
        )
    } else {
        None
    };
    
    // 创建摘要配置
    let config = SummaryConfig {
        summary_type,
        start_date,
        end_date,
        title,
    };
    
    let settings = app_state.get_settings();
    let log_manager = LogManager::new(settings.clone());
    
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
    
    Ok(summary)
}

/// 根据摘要类型计算日期范围
pub fn calculate_date_range(summary_type: SummaryType) -> (NaiveDate, NaiveDate) {
    let now = Utc::now().naive_local().date();
    
    match summary_type {
        SummaryType::Weekly => {
            // 从当前日期倒推7天
            let start = now
                .checked_sub_days(chrono::Days::new(7))
                .unwrap_or(now);
            (start, now)
        }
        SummaryType::Monthly => {
            // 从当前日期倒推30天
            let start = now
                .checked_sub_days(chrono::Days::new(30))
                .unwrap_or(now);
            (start, now)
        }
        SummaryType::Quarterly => {
            // 从当前日期倒推90天
            let start = now
                .checked_sub_days(chrono::Days::new(90))
                .unwrap_or(now);
            (start, now)
        }
        SummaryType::Custom => {
            // 自定义类型会在函数外部处理
            (now, now)
        }
    }
}

/// 获取应用设置
#[tauri::command]
pub async fn get_settings(app_state: State<'_, AppState>) -> Result<Settings, String> {
    Ok(app_state.get_settings())
}

/// 更新应用设置
#[tauri::command]
pub async fn update_settings(
    settings: Settings,
    app_state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    // 更新设置
    app_state.update_settings(settings.clone())?;

    // 注销所有快捷键
    app_handle.global_shortcut_manager().unregister_all().map_err(|e| e.to_string())?;

    // 如果启用了快捷键，则重新注册
    if !settings.shortcut.is_empty() {
        let app_handle = app_handle.clone();
        app_handle.global_shortcut_manager().register(&settings.shortcut, move || {
            if let Some(window) = app_handle.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// 选择目录
#[tauri::command]
pub async fn select_directory(_app_handle: AppHandle) -> Result<String, String> {
    let folder = tauri::api::dialog::blocking::FileDialogBuilder::new().pick_folder();
    
    match folder {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err("未选择目录".to_string()),
    }
}

/// 注册命令行工具
#[tauri::command]
pub async fn register_cli(app_handle: AppHandle) -> Result<(), String> {
    // 获取应用可执行文件路径
    let base_path = app_handle
        .path_resolver()
        .resolve_resource("../")
        .ok_or("无法获取应用路径")?
        .to_string_lossy()
        .to_string();
    
    // 检查操作系统
    #[cfg(target_os = "macos")]
    {
        // 目标符号链接路径
        let link_path = "/usr/local/bin/work-record";
        
        // 构建可能的路径列表
        // 1. 开发环境的调试版本
        let mut possible_paths = Vec::new();
        
        // 标准发布路径
        possible_paths.push(format!("{}/MacOS/工作日志记录", base_path));
        possible_paths.push(format!("{}/MacOS/work-record", base_path));
        possible_paths.push(format!("{}/工作日志记录", base_path));
        possible_paths.push(format!("{}/work-record", base_path));
        
        // 使用当前工作目录向上回溯查找
        let current_dir = std::env::current_dir().unwrap_or_default();
        let current_path = current_dir.to_string_lossy().to_string();
        
        // 开发环境中可能的路径 - 直接使用二进制命令
        let target_debug_path = format!("{}/target/debug/wr-cli", current_path.split("work-record").next().unwrap_or("") );
        let bin_path = if Path::new(&format!("{}/src-tauri", current_path)).exists() {
            format!("{}/src-tauri/target/debug/wr-cli", current_path)
        } else if current_path.contains("work-record") {
            let project_path = current_path.split("work-record").next().unwrap_or("");
            format!("{}/work-record/src-tauri/target/debug/wr-cli", project_path)
        } else {
            target_debug_path
        };
        
        possible_paths.push(bin_path);
        possible_paths.push(format!("{}/target/debug/工作日志记录", current_path));
        possible_paths.push(format!("{}/target/debug/wr-cli", current_path));
        possible_paths.push(format!("{}/work-record/src-tauri/target/debug/工作日志记录", current_path));
        possible_paths.push(format!("{}/src-tauri/target/debug/工作日志记录", current_path));
        
        // 尝试查找可用的可执行文件路径
        let mut found_exec_path = None;
        for path in &possible_paths {
            if Path::new(path).exists() {
                found_exec_path = Some(path.clone());
                break;
            }
        }
        
        // 如果找不到任何一个路径
        let exec_path = match found_exec_path {
            Some(path) => path,
            None => {
                // 如果找不到二进制文件，则尝试使用cargo安装
                let cargo_install_cmd = "cargo install --path $(find $(pwd) -type d -name src-tauri | head -1) --bin wr-cli";
                return Err(format!("无法找到可执行文件。\n\n您可以通过以下方式安装命令行工具:\n\n{};\nsudo ln -sf $(which wr-cli) /usr/local/bin/work-record\n\n或者使用提供的打包版本。", cargo_install_cmd));
            }
        };
        
        // 返回需要执行的命令
        let sudo_command = format!("sudo ln -sf \"{}\" \"{}\"", exec_path, link_path);
        return Err(format!("需要管理员权限来创建命令行工具。\n\n请在终端中手动执行以下命令：\n\n{}\n\n执行后即可使用 work-record 命令", sudo_command));
    }
    
    #[cfg(target_os = "linux")]
    {
        // 目标符号链接路径
        let link_path = "/usr/local/bin/work-record";
        
        // 查找可执行文件路径
        let mut exec_path = format!("{}/work-record", base_path);
        
        // 检查文件是否存在
        if !Path::new(&exec_path).exists() {
            // 尝试检查debug目录
            let debug_path = format!("{}/target/debug/wr-cli", base_path.replace("/share/resources", ""));
            if Path::new(&debug_path).exists() {
                exec_path = debug_path;
            } else {
                // 尝试查找工作目录中的二进制文件
                let current_dir = std::env::current_dir().unwrap_or_default();
                let current_path = current_dir.to_string_lossy().to_string();
                
                let alt_path = if current_path.contains("work-record") {
                    format!("{}/src-tauri/target/debug/wr-cli", current_path)
                } else {
                    format!("{}/work-record/src-tauri/target/debug/wr-cli", current_path)
                };
                
                if Path::new(&alt_path).exists() {
                    exec_path = alt_path;
                } else {
                    // 如果找不到二进制文件，则尝试使用cargo安装
                    let cargo_install_cmd = "cargo install --path $(find $(pwd) -type d -name src-tauri | head -1) --bin wr-cli";
                    return Err(format!("无法找到可执行文件。\n\n您可以通过以下方式安装命令行工具:\n\n{};\nsudo ln -sf $(which wr-cli) /usr/local/bin/work-record\n\n或者使用提供的打包版本。", cargo_install_cmd));
                }
            }
        }
        
        // 返回需要执行的命令
        let sudo_command = format!("sudo ln -sf \"{}\" \"{}\"", exec_path, link_path);
        return Err(format!("需要管理员权限来创建命令行工具。\n\n请在终端中手动执行以下命令：\n\n{}\n\n执行后即可使用 work-record 命令", sudo_command));
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows下使用环境变量
        // 获取可执行文件路径
        let exec_path = format!("{}\\work-record.exe", base_path);
        
        // 获取用户主目录
        let home_dir = std::env::var("USERPROFILE")
            .map_err(|_| "无法获取用户主目录".to_string())?;
        
        // 创建批处理文件在用户目录下
        let batch_path = format!("{}\\work-record.bat", home_dir);
        
        // 创建批处理文件内容
        let batch_content = format!("@echo off\r\n\"{}\" %*", exec_path.replace("\\", "\\\\"));
        
        // 写入批处理文件
        fs::write(&batch_path, batch_content)
            .map_err(|e| format!("创建批处理文件失败: {}", e))?;
        
        // 返回需要执行的命令
        return Err(format!("批处理文件已创建在：{}\n\n请以管理员身份在命令提示符中执行以下命令将目录添加到PATH：\n\nsetx PATH \"%PATH%;{}\" /M", batch_path, home_dir));
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Err("当前操作系统不支持命令行注册".to_string())
    }
}

/// 注销命令行工具
#[tauri::command]
pub async fn unregister_cli() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let link_path = "/usr/local/bin/work-record";
        
        // 检查符号链接是否存在
        if Path::new(link_path).exists() {
            // 返回需要执行的命令
            let sudo_command = format!("sudo rm \"{}\"", link_path);
            return Err(format!("需要管理员权限来删除命令行工具。\n\n请在终端中手动执行以下命令：\n\n{}", sudo_command));
        } else {
            return Ok(());
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let link_path = "/usr/local/bin/work-record";
        
        // 检查符号链接是否存在
        if Path::new(link_path).exists() {
            // 返回需要执行的命令
            let sudo_command = format!("sudo rm \"{}\"", link_path);
            return Err(format!("需要管理员权限来删除命令行工具。\n\n请在终端中手动执行以下命令：\n\n{}", sudo_command));
        } else {
            return Ok(());
        }
    }
    
    #[cfg(target_os = "windows")]
    {
        // Windows下删除批处理文件
        let home_dir = std::env::var("USERPROFILE")
            .map_err(|_| "无法获取用户主目录".to_string())?;
        
        let batch_path = format!("{}\\work-record.bat", home_dir);
        
        // 检查批处理文件是否存在
        if Path::new(&batch_path).exists() {
            fs::remove_file(&batch_path)
                .map_err(|e| format!("删除批处理文件失败: {}", e))?;
        }
        
        Ok(())
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Err("当前操作系统不支持命令行注销".to_string())
    }
} 