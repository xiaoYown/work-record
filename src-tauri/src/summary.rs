use crate::errors::AppError;
use crate::log_manager::LogEntry;
use crate::settings::Settings;
use chrono::{Datelike, Local, NaiveDate};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// 摘要类型
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum SummaryType {
    /// 周摘要
    Weekly,
    /// 月摘要
    Monthly,
    /// 季度摘要
    Quarterly,
    /// 自定义日期范围
    Custom,
}

/// 摘要生成配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryConfig {
    /// 摘要类型
    pub summary_type: SummaryType,
    /// 开始日期 (自定义日期范围时使用)
    pub start_date: Option<NaiveDate>,
    /// 结束日期 (自定义日期范围时使用)
    pub end_date: Option<NaiveDate>,
    /// 摘要标题
    pub title: String,
}

/// LLM API 响应
#[derive(Debug, Deserialize)]
struct OllamaResponse {
    response: String,
}

/// 摘要生成器
pub struct SummaryGenerator {
    settings: Settings,
    client: Client,
}

impl SummaryGenerator {
    /// 创建新的摘要生成器
    pub fn new(settings: Settings) -> Self {
        Self {
            settings,
            client: Client::new(),
        }
    }

    /// 生成摘要
    pub async fn generate_summary(
        &self,
        logs: HashMap<String, Vec<LogEntry>>,
        config: SummaryConfig,
    ) -> Result<String, AppError> {
        // 将日志合并为一个字符串
        let mut logs_content = String::new();
        
        for (date, entries) in logs.iter() {
            logs_content.push_str(&format!("## {}\n", date));
            
            for entry in entries {
                logs_content.push_str(&format!("- {}\n", entry.content));
            }
            
            logs_content.push('\n');
        }
        
        // 生成提示
        let prompt = match config.summary_type {
            SummaryType::Weekly => "对以下工作日志进行周总结，分析工作内容、成果和存在的问题，提出改进建议。",
            SummaryType::Monthly => "对以下工作日志进行月度总结，总结月度工作重点、成果和经验教训，提出下月工作计划。",
            SummaryType::Quarterly => "对以下工作日志进行季度总结，分析季度目标完成情况、主要项目进展、成果和问题，提出下季度规划。",
            SummaryType::Custom => "对以下指定时间范围内的工作日志进行总结，分析关键工作内容、成果和经验教训。",
        };
        
        let full_prompt = format!("{}\n\n{}", prompt, logs_content);
        
        // 调用LLM API生成摘要
        let summary = if self.settings.use_local_ollama {
            self.generate_with_ollama(&full_prompt).await?
        } else {
            self.generate_with_external_api(&full_prompt).await?
        };
        
        // 保存摘要到文件
        let file_name = self.get_summary_filename(&config);
        let file_path = Path::new(&self.settings.log_output_dir).join(file_name);
        
        // 确保目录存在
        if let Some(parent) = file_path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)?;
            }
        }
        
        // 保存摘要
        fs::write(&file_path, &summary)?;
        
        Ok(summary)
    }

    /// 使用本地 Ollama 生成摘要
    async fn generate_with_ollama(&self, prompt: &str) -> Result<String, AppError> {
        let url = format!("{}/api/generate", self.settings.ollama_address);
        
        let response = self.client
            .post(&url)
            .json(&json!({
                "model": self.settings.ollama_model,
                "prompt": prompt,
                "system": "你是一个专业的工作日志分析助手，擅长总结工作内容并提出见解。",
                "stream": false
            }))
            .send()
            .await
            .map_err(AppError::ReqwestError)?;
        
        if !response.status().is_success() {
            return Err(AppError::SummaryError(format!(
                "Ollama API 调用失败: {}",
                response.status()
            )));
        }
        
        let ollama_response: OllamaResponse = response
            .json()
            .await
            .map_err(AppError::ReqwestError)?;
        
        Ok(ollama_response.response)
    }

    /// 使用外部 API 生成摘要
    async fn generate_with_external_api(&self, prompt: &str) -> Result<String, AppError> {
        if self.settings.llm_api_url.is_empty() || self.settings.llm_api_key.is_empty() {
            return Err(AppError::SummaryError(
                "未配置外部 API URL 或 API Key".to_string()
            ));
        }
        
        let response = self.client
            .post(&self.settings.llm_api_url)
            .header("Authorization", format!("Bearer {}", self.settings.llm_api_key))
            .json(&json!({
                "model": "gpt-4",
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个专业的工作日志分析助手，擅长总结工作内容并提出见解。"
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            }))
            .send()
            .await
            .map_err(AppError::ReqwestError)?;
        
        if !response.status().is_success() {
            return Err(AppError::SummaryError(format!(
                "外部 API 调用失败: {}",
                response.status()
            )));
        }
        
        let json_response: serde_json::Value = response
            .json()
            .await
            .map_err(AppError::ReqwestError)?;
        
        // 尝试提取回复
        let content = json_response
            .get("choices")
            .and_then(|choices| choices.get(0))
            .and_then(|choice| choice.get("message"))
            .and_then(|message| message.get("content"))
            .and_then(|content| content.as_str())
            .ok_or_else(|| AppError::SummaryError("无法解析 API 响应".to_string()))?;
        
        Ok(content.to_string())
    }

    /// 获取摘要文件名
    fn get_summary_filename(&self, config: &SummaryConfig) -> String {
        let now = Local::now();
        
        match config.summary_type {
            SummaryType::Weekly => {
                format!("weekly_summary_{}.md", now.format("%Y-%m-%d"))
            }
            SummaryType::Monthly => {
                format!("monthly_summary_{}-{}.md", now.year(), now.month())
            }
            SummaryType::Quarterly => {
                let quarter = (now.month() - 1) / 3 + 1;
                format!("quarterly_summary_{}-Q{}.md", now.year(), quarter)
            }
            SummaryType::Custom => {
                let start = config
                    .start_date
                    .unwrap_or_else(|| now.date_naive())
                    .format("%Y-%m-%d")
                    .to_string();
                let end = config
                    .end_date
                    .unwrap_or_else(|| now.date_naive())
                    .format("%Y-%m-%d")
                    .to_string();
                format!("custom_summary_{}_{}.md", start, end)
            }
        }
    }
} 