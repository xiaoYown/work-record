use crate::errors::AppError;
use chrono::{DateTime, NaiveDate, TimeZone, Utc};
use git2::{Commit, Repository};
use std::path::Path;

/// Git 提交信息
#[derive(Debug, Clone)]
pub struct GitCommit {
    /// 提交 ID
    pub id: String,
    /// 提交消息
    pub message: String,
    /// 提交时间
    pub time: DateTime<Utc>,
    /// 提交作者
    pub author: String,
}

/// 获取 Git 仓库的提交信息
pub fn get_commits_for_author(
    repo_path: &Path,
    author: &str,
    since_date: Option<NaiveDate>,
    until_date: Option<NaiveDate>,
) -> Result<Vec<GitCommit>, AppError> {
    let repo = Repository::open(repo_path)?;
    let mut revwalk = repo.revwalk()?;

    // 添加头部引用
    revwalk.push_head()?;

    let mut commits = Vec::new();

    for oid_result in revwalk {
        let oid = oid_result?;
        let commit = repo.find_commit(oid)?;

        // 过滤作者
        if !author.is_empty() && commit.author().name() != Some(author) {
            continue;
        }

        let commit_time = Utc.timestamp_opt(commit.time().seconds(), 0).unwrap();
        let commit_date = commit_time.date_naive();

        // 过滤日期
        if let Some(since) = since_date {
            if commit_date < since {
                continue;
            }
        }

        if let Some(until) = until_date {
            if commit_date > until {
                continue;
            }
        }

        let commit_info = extract_commit_info(&commit, commit_time)?;
        commits.push(commit_info);
    }

    Ok(commits)
}

/// 从 Commit 对象提取信息
fn extract_commit_info(commit: &Commit, time: DateTime<Utc>) -> Result<GitCommit, AppError> {
    let id = commit.id().to_string();
    let message = commit.message().unwrap_or("").to_string();
    let author = commit.author().name().unwrap_or("").to_string();

    Ok(GitCommit {
        id,
        message,
        time,
        author,
    })
}

/// 为指定作者整理指定日期的 Git 提交信息
pub fn get_daily_commits(
    repo_path: &Path,
    author: &str,
    date: &NaiveDate,
) -> Result<Vec<GitCommit>, AppError> {
    let next_date = date
        .succ_opt()
        .ok_or_else(|| AppError::GeneralError("无法计算下一天日期".to_string()))?;

    get_commits_for_author(repo_path, author, Some(*date), Some(next_date))
}

/// 获取工作目录路径
pub fn get_working_directory() -> Result<String, AppError> {
    let current_dir = std::env::current_dir()?;
    Ok(current_dir.to_string_lossy().to_string())
}
