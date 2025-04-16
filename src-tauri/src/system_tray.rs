use crate::app_state::AppState;
use crate::errors::AppError;
use tauri::{
    AppHandle, CustomMenuItem, GlobalShortcutManager, Manager, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem,
};

/// 设置系统托盘
pub fn setup_system_tray(app_handle: AppHandle, state: AppState) -> Result<(), AppError> {
    // 更新应用句柄
    state.set_app_handle(app_handle.clone());

    // 注册快捷键
    let settings = state.get_settings();
    if !settings.shortcut.is_empty() {
        let app_handle_clone = app_handle.clone();
        app_handle
            .global_shortcut_manager()
            .register(&settings.shortcut, move || {
                if let Some(window) = app_handle_clone.get_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            })
            .map_err(|e| AppError::TauriError(e.into()))?;
    }

    // 设置系统托盘
    let tray_menu = get_tray_menu();
    app_handle
        .tray_handle()
        .set_menu(tray_menu)
        .map_err(|e| AppError::TauriError(e))?;

    // 如果是 macOS，设置图标显示模式
    #[cfg(target_os = "macos")]
    {
        app_handle
            .tray_handle()
            .set_icon_as_template(true)
            .expect("Failed to set icon as template");
    }

    Ok(())
}

/// 处理系统托盘事件
pub fn handle_system_tray_event(app: &AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "add_log" => {
                let _ = app.emit_all("show_quick_entry", ());
                let _ = app
                    .get_window("main")
                    .map(|w| w.emit("navigate", "log-files"));
            }
            "settings" => {
                let _ = show_main_window(app);
                let _ = app
                    .get_window("main")
                    .map(|w| w.emit("navigate", "settings"));
            }
            "open_main" => {
                let _ = show_main_window(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        },
        SystemTrayEvent::LeftClick { .. } => {
            let _ = show_main_window(app);
        }
        _ => {}
    }
}

/// 创建系统托盘菜单
pub fn get_tray_menu() -> SystemTrayMenu {
    let add_log = CustomMenuItem::new("add_log".to_string(), "添加日志");
    let settings = CustomMenuItem::new("settings".to_string(), "设置");
    let open_main = CustomMenuItem::new("open_main".to_string(), "打开主窗口");
    let quit = CustomMenuItem::new("quit".to_string(), "退出");

    SystemTrayMenu::new()
        .add_item(add_log)
        .add_item(settings)
        .add_item(open_main)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(quit)
}

/// 显示主窗口
fn show_main_window(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}
