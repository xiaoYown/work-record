use work_record_lib::cli;

#[tokio::main]
async fn main() {
    // 初始化日志
    env_logger::init();

    // 运行 CLI 程序
    if let Err(err) = cli::run_cli().await {
        eprintln!("错误: {}", err);
        std::process::exit(1);
    }
}
