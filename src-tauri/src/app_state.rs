use crate::settings::Settings;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

/// 应用的全局状态，包含设置和其他共享资源
#[derive(Debug, Default, Clone)]
pub struct AppState {
    /// 应用设置
    pub settings: Arc<Mutex<Settings>>,
    /// 应用句柄，用于跨线程访问 Tauri 功能
    pub app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl AppState {
    /// 创建新的应用状态
    pub fn new() -> Self {
        let settings = Settings::load_or_default();
        Self {
            settings: Arc::new(Mutex::new(settings)),
            app_handle: Arc::new(Mutex::new(None)),
        }
    }

    /// 更新应用句柄
    pub fn set_app_handle(&self, handle: AppHandle) {
        if let Ok(mut app_handle) = self.app_handle.lock() {
            *app_handle = Some(handle);
        }
    }

    /// 获取设置
    pub fn get_settings(&self) -> Settings {
        self.settings.lock().unwrap().clone()
    }

    /// 更新设置
    pub fn update_settings(&self, settings: Settings) -> Result<(), String> {
        let mut current_settings = self.settings.lock().map_err(|e| e.to_string())?;
        *current_settings = settings.clone();
        settings.save().map_err(|e| e.to_string())?;
        Ok(())
    }
}
