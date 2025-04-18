use crate::app_state::AppState;
use crate::git_utils::{get_daily_commits, get_working_directory};
use crate::log_manager::{LogEntry, LogManager};
use crate::settings::Settings;
use crate::summary::{SummaryConfig, SummaryGenerator, SummaryType};
use chrono::{NaiveDate, Utc};
use std::collections::HashMap;
use std::path::Path;
use tauri::{AppHandle, GlobalShortcutManager, Manager, State};
use log;
use std::sync::{Arc, RwLock};
use serde_json::json;

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
    
    // 确保日志目录存在
    if let Err(e) = settings.ensure_log_dirs_exist() {
        return Err(format!("创建日志目录失败: {}", e));
    }
    
    let log_manager = LogManager::new(settings);
    
    let entry = LogEntry::new(content, source, tags);
    match log_manager.add_entry(entry) {
        Ok(_) => {
            // 日志记录成功，返回成功
            Ok(())
        }
        Err(e) => {
            // 记录错误并返回
            let error_msg = format!("添加日志失败: {}", e);
            log::error!("{}", error_msg);
            Err(error_msg)
        }
    }
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
    
    log::info!("收到获取日志文件列表请求");
    
    match log_manager.get_log_files() {
        Ok(files) => {
            log::info!("成功获取日志文件列表，共 {} 个文件", files.len());
            if !files.is_empty() {
                log::debug!("首个日志文件: {}", files[0]);
                log::debug!("末个日志文件: {}", files.last().unwrap_or(&"无".to_string()));
                
                // 添加更多详细信息记录
                if files.len() > 10 {
                    log::debug!("前10个文件: {:?}", &files[0..10]);
                } else {
                    log::debug!("所有文件: {:?}", files);
                }
            } else {
                log::debug!("日志文件列表为空");
            }
            Ok(files)
        }
        Err(err) => {
            let error_type = format!("{:?}", err);
            let error_msg = format!("获取日志文件列表失败: {}", err);
            log::error!("{}", error_msg);
            log::error!("错误类型: {}", error_type);
            
            // 根据不同的错误类型提供更具体的错误信息
            let user_friendly_error = match err {
                crate::errors::AppError::IoError(io_err) => {
                    log::error!("IO错误细节: {:?}", io_err.kind());
                    if let Some(ref_err) = io_err.get_ref() {
                        log::error!("IO错误内部错误: {:?}", ref_err);
                    }
                    
                    match io_err.kind() {
                        std::io::ErrorKind::NotFound => {
                            format!("日志目录不存在，请检查配置是否正确: {}", io_err)
                        },
                        std::io::ErrorKind::PermissionDenied => {
                            format!("没有足够权限访问日志目录，请检查权限设置: {}", io_err)
                        },
                        std::io::ErrorKind::ConnectionRefused => {
                            format!("连接被拒绝，无法访问日志目录: {}", io_err)
                        },
                        std::io::ErrorKind::ConnectionReset => {
                            format!("连接被重置，无法访问日志目录: {}", io_err)
                        },
                        std::io::ErrorKind::Interrupted => {
                            format!("操作被中断: {}", io_err)
                        },
                        _ => format!("读取日志目录时出现IO错误: {}", io_err)
                    }
                },
                crate::errors::AppError::LogManagerError(msg) => {
                    log::error!("日志管理器错误详细信息: {}", msg);
                    format!("日志管理器错误: {}", msg)
                },
                crate::errors::AppError::SettingsError(msg) => {
                    log::error!("配置错误详细信息: {}", msg);
                    format!("配置错误: {}", msg)
                },
                crate::errors::AppError::SerdeError(serde_err) => {
                    log::error!("序列化错误: {}", serde_err);
                    format!("解析日志文件时出现错误: {}", serde_err)
                },
                crate::errors::AppError::FsError(fs_err) => {
                    log::error!("文件系统错误: {}", fs_err);
                    format!("处理日志文件时出现文件系统错误: {}", fs_err)
                },
                crate::errors::AppError::GeneralError(gen_err) => {
                    log::error!("通用错误: {}", gen_err);
                    format!("获取日志文件时发生错误: {}", gen_err)
                },
                _ => {
                    log::error!("未识别的错误类型: {:?}", err);
                    error_msg
                }
            };
            
            Err(user_friendly_error)
        }
    }
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

/// 生成流式摘要
/// 
/// 流式摘要使用事件机制将摘要内容实时推送到前端
#[tauri::command]
pub async fn generate_summary_stream(
    summary_type: String,
    start_date: Option<String>,
    end_date: Option<String>,
    title: Option<String>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    log::info!("收到生成流式摘要请求: 类型={}, 标题={:?}", summary_type, title);
    
    // 发送事件通知前端开始生成
    app_handle.emit_all("summary-generation-start", ()).map_err(|e| {
        let err_msg = format!("无法发送摘要开始事件: {}", e);
        log::error!("{}", err_msg);
        err_msg
    })?;
    
    // 将字符串类型转换为SummaryType枚举
    let summary_type_enum = match summary_type.as_str() {
        "weekly" => SummaryType::Weekly,
        "monthly" => SummaryType::Monthly, 
        "quarterly" => SummaryType::Quarterly,
        _ => SummaryType::Custom,
    };
    
    // 解析日期范围
    let (start_naive_date, end_naive_date) = match summary_type_enum {
        SummaryType::Custom => {
            // 自定义类型需要解析日期
            let start = match start_date {
                Some(date) => NaiveDate::parse_from_str(&date, "%Y-%m-%d")
                    .map_err(|e| format!("开始日期格式错误: {}", e))?,
                None => return Err("自定义摘要类型需要提供开始日期".to_string())
            };
            
            let end = match end_date {
                Some(date) => NaiveDate::parse_from_str(&date, "%Y-%m-%d")
                    .map_err(|e| format!("结束日期格式错误: {}", e))?,
                None => return Err("自定义摘要类型需要提供结束日期".to_string())
            };
            
            (start, end)
        },
        _ => {
            // 使用预定义摘要类型的计算方法
            calculate_date_range(summary_type_enum)
        }
    };
    
    // 获取该日期范围内的日志
    let settings = state.get_settings();
    let log_manager = LogManager::new(settings.clone());
    
    let logs = match log_manager.get_entries_in_date_range(&start_naive_date, &end_naive_date) {
        Ok(logs) => logs,
        Err(e) => {
            let err_msg = format!("获取日志失败: {}", e);
            log::error!("{}", err_msg);
            
            // 发送错误事件
            app_handle.emit_all("summary-generation-error", err_msg.clone()).ok();
            return Err(err_msg);
        }
    };
    
    if logs.is_empty() {
        let err_msg = format!("指定日期范围内没有找到日志记录");
        log::warn!("{}", err_msg);
        
        // 发送错误事件
        app_handle.emit_all("summary-generation-error", err_msg.clone()).ok();
        return Err(err_msg);
    }
    
    // 发送事件通知前端正在处理
    app_handle.emit_all(
        "summary-generation-processing", 
        format!("正在处理 {} 条日志记录...", logs.len())
    ).ok();
    
    // 创建摘要配置
    let summary_config = SummaryConfig {
        summary_type: summary_type_enum,
        start_date: Some(start_naive_date),
        end_date: Some(end_naive_date),
        title: title.unwrap_or_else(|| {
            if summary_type == "custom" {
                format!("自定义摘要")
            } else {
                format!("{}摘要", match summary_type.as_str() {
                    "weekly" => "周",
                    "monthly" => "月",
                    "quarterly" => "季度",
                    _ => "",
                })
            }
        }),
    };
    
    // 创建回调函数，用于将流式结果发送给前端
    let app_handle_clone = app_handle.clone();
    let progress_callback = move |chunk: &str| {
        if !chunk.is_empty() {
            app_handle_clone.emit_all("summary-generation-chunk", chunk).ok();
        }
    };
    
    // 使用流式方法生成摘要
    let summary_generator = SummaryGenerator::new(settings.clone());
    let result = match summary_generator.generate_summary_with_stream(logs, summary_config, progress_callback).await {
        Ok(summary) => {
            log::info!("流式摘要生成成功");
            
            // 发送完成事件
            app_handle.emit_all("summary-generation-complete", summary).map_err(|e| {
                let err_msg = format!("无法发送摘要完成事件: {}", e);
                log::error!("{}", err_msg);
                err_msg
            })?;
            
            Ok(())
        },
        Err(e) => {
            let err_msg = format!("生成摘要失败: {}", e);
            log::error!("{}", err_msg);
            
            // 发送错误事件
            app_handle.emit_all("summary-generation-error", err_msg.clone()).ok();
            Err(err_msg)
        }
    };
    
    result
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

/// 生成摘要（向后兼容旧接口）
#[tauri::command(rename_all = "camelCase")]
pub async fn generate_summary(
    summary_type: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    title: Option<String>,
    state: State<'_, AppState>,
    app_handle: AppHandle,
) -> Result<(), String> {
    log::info!("收到旧版生成摘要请求，转发到流式摘要接口");
    
    // 检查summary_type是否存在
    let actual_summary_type = match summary_type {
        Some(st) => st,
        None => return Err("缺少摘要类型参数 'summary_type'".to_string())
    };
    
    log::debug!("参数处理: 摘要类型={}, 开始日期={:?}, 结束日期={:?}", 
                actual_summary_type, start_date, end_date);
    
    generate_summary_stream(actual_summary_type, start_date, end_date, title, state, app_handle).await
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