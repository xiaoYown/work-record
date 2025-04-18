// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use env_logger;
use tauri::Manager;

pub mod app_state;
pub mod cli;
mod commands;
pub mod errors;
mod git_utils;
mod log_manager;
pub mod log_summary_cli;
pub mod settings;
pub mod summary;
mod system_tray;

use app_state::AppState;
use system_tray::{get_tray_menu, setup_system_tray};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn show_quick_entry(app_handle: tauri::AppHandle) {
    log::info!("调用了 show_quick_entry 命令");

    if let Some(window) = app_handle.get_window("quick_entry") {
        log::info!("找到已存在的 quick_entry 窗口，尝试显示");
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    log::info!("创建新的 quick_entry 窗口");
    let _ = tauri::WindowBuilder::new(
        &app_handle,
        "quick_entry",
        tauri::WindowUrl::App("quick_entry.html".into()),
    )
    .title("快速添加日志")
    .center()
    .always_on_top(true)
    .resizable(true)
    .inner_size(500.0, 200.0)
    .build();

    log::info!("quick_entry 窗口创建完成");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志系统
    env_logger::init();
    log::info!("工作日志记录应用启动");

    let app_state = AppState::new();
    let state = app_state.clone();

    tauri::Builder::default()
        .system_tray(tauri::SystemTray::new().with_menu(get_tray_menu()))
        .manage(app_state)
        .setup(move |app| {
            let main_window = app.get_window("main").unwrap();

            #[cfg(target_os = "macos")]
            {
                main_window.set_title("工作日志记录").unwrap();
            }

            setup_system_tray(app.handle(), state.clone())?;

            Ok(())
        })
        .on_system_tray_event(system_tray::handle_system_tray_event)
        .invoke_handler(tauri::generate_handler![
            commands::add_log_entry,
            commands::get_log_entries,
            commands::get_log_files,
            commands::update_log_entry,
            commands::delete_log_entry,
            commands::fetch_git_commits,
            commands::generate_summary_stream,
            commands::generate_summary,
            commands::get_settings,
            commands::update_settings,
            commands::select_directory,
            commands::register_cli,
            commands::unregister_cli,
            show_quick_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
