use thiserror::Error;

/// 应用错误类型
#[derive(Debug, Error)]
pub enum AppError {
    /// IO 错误
    #[error("IO 错误: {0}")]
    IoError(#[from] std::io::Error),

    /// 序列化/反序列化错误
    #[error("序列化错误: {0}")]
    SerdeError(#[from] serde_json::Error),

    /// Git 操作错误
    #[error("Git 错误: {0}")]
    GitError(#[from] git2::Error),

    /// 网络请求错误
    #[error("网络请求错误: {0}")]
    ReqwestError(#[from] reqwest::Error),

    /// 日期解析错误
    #[error("日期解析错误: {0}")]
    ChronoError(#[from] chrono::ParseError),

    /// Tauri 错误
    #[error("Tauri 错误: {0}")]
    TauriError(#[from] tauri::Error),

    /// 文件系统错误
    #[error("文件系统错误: {0}")]
    FsError(String),

    /// 设置错误
    #[error("设置错误: {0}")]
    SettingsError(String),

    /// 日志管理错误
    #[error("日志管理错误: {0}")]
    LogManagerError(String),

    /// 摘要生成错误
    #[error("摘要生成错误: {0}")]
    SummaryError(String),

    /// 通用错误
    #[error("{0}")]
    GeneralError(String),
}

/// 转换为字符串以便在前端展示
pub fn error_to_string(err: AppError) -> String {
    err.to_string()
}

/// 将 Result<T, AppError> 转换为 Result<T, String>
pub fn map_err_to_string<T, E: Into<AppError>>(result: Result<T, E>) -> Result<T, String> {
    result.map_err(|e| e.into().to_string())
}
