/**
 * 使用说明面板
 */
import { Icons } from './icons';

class HelpPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          color: var(--text-primary);
        }

        h2 {
          font-size: var(--font-size-lg);
          margin-bottom: 24px;
          color: var(--text-primary);
          font-weight: 600;
        }

        .help-content {
          max-width: 800px;
        }

        .help-section {
          background-color: var(--bg-elevated);
          border-radius: var(--border-radius);
          padding: 24px;
          margin-bottom: 28px;
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--border-color);
        }

        .section-title {
          font-size: var(--font-size-base);
          font-weight: 600;
          margin-top: 0;
          margin-bottom: 20px;
          color: var(--text-primary);
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 12px;
        }

        p {
          margin: 0 0 16px 0;
          line-height: 1.6;
        }

        ul {
          margin: 0 0 16px 20px;
          padding: 0;
        }

        li {
          margin-bottom: 8px;
          line-height: 1.5;
        }

        .key {
          display: inline-block;
          padding: 2px 8px;
          background-color: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-family: monospace;
          font-size: 0.9em;
        }

        .feature-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 16px;
          margin-top: 20px;
        }

        .feature-item {
          display: flex;
          flex-direction: column;
          background-color: var(--bg-primary);
          padding: 16px;
          border-radius: var(--border-radius);
          border: 1px solid var(--border-color);
        }

        .feature-icon {
          margin-bottom: 12px;
          color: var(--accent);
        }

        .feature-title {
          font-weight: 500;
          margin-bottom: 8px;
        }

        .feature-description {
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
        }

        .code-block {
          background-color: var(--bg-primary);
          border-radius: var(--border-radius);
          padding: 16px;
          margin: 12px 0;
          overflow-x: auto;
          border: 1px solid var(--border-color);
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          font-size: 13px;
        }

        code {
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          font-size: 0.9em;
          padding: 2px 5px;
          background-color: var(--bg-primary);
          border-radius: 3px;
          border: 1px solid var(--border-color);
        }

        .code-block pre {
          margin: 0;
          white-space: pre;
        }

        .code-block code {
          background: none;
          border: none;
          padding: 0;
          font-size: 13px;
          color: var(--text-primary);
        }

        .command-desc {
          margin-top: 8px;
          margin-left: 20px;
          color: var(--text-secondary);
          font-style: italic;
          font-size: var(--font-size-sm);
        }

        .note {
          background-color: rgba(255, 230, 0, 0.1);
          border-left: 3px solid var(--accent);
          padding: 10px 15px;
          margin: 16px 0;
          border-radius: 0 var(--border-radius) var(--border-radius) 0;
          font-size: var(--font-size-sm);
        }
      </style>

      <h2>使用说明</h2>

      <div class="help-content">
        <div class="help-section">
          <div class="section-title">应用介绍</div>
          <p>工作日志记录是一个简单高效的应用程序，帮助您记录和整理日常工作内容，生成工作摘要报告。它是专为需要定期提交工作报告的开发人员和其他专业人士设计的。</p>
          
          <div class="feature-list">
            <div class="feature-item">
              <div class="feature-icon">${Icons.edit}</div>
              <div class="feature-title">日志记录</div>
              <div class="feature-description">快速记录工作内容和时间</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">${Icons.summary}</div>
              <div class="feature-title">摘要生成</div>
              <div class="feature-description">自动生成工作内容摘要</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">${Icons.files}</div>
              <div class="feature-title">工作分析</div>
              <div class="feature-description">查看工作时间分布</div>
            </div>
            <div class="feature-item">
              <div class="feature-icon">${Icons.theme}</div>
              <div class="feature-title">主题切换</div>
              <div class="feature-description">支持三种视觉主题</div>
            </div>
          </div>
        </div>

        <div class="help-section">
          <div class="section-title">基本功能</div>
          
          <h3>日志记录</h3>
          <ul>
            <li><strong>添加日志</strong>：点击界面右上角的"添加日志"按钮，或使用快捷键（可在设置中自定义）</li>
            <li><strong>查看日志</strong>：在主界面的"日志文件"标签下可以查看所有已记录的日志</li>
            <li><strong>编辑日志</strong>：点击日志条目可以编辑内容</li>
          </ul>
          
          <h3>日志生成</h3>
          <ul>
            <li><strong>生成摘要</strong>：在"日志生成"标签下，选择日期范围后点击生成按钮</li>
            <li><strong>导出报告</strong>：生成的摘要可以导出为多种格式</li>
          </ul>
          
          <h3>快捷操作</h3>
          <ul>
            <li><strong>快速添加</strong>：设置全局快捷键后，可以在任何应用程序中快速记录工作内容</li>
            <li><strong>主题切换</strong>：点击侧边栏底部的"切换主题"可以在深色、浅色和中性主题之间切换</li>
          </ul>
        </div>
        
        <div class="help-section">
          <div class="section-title">高级功能</div>
          
          <h3>AI 摘要生成</h3>
          <p>应用可以利用本地 Ollama 模型或远程 API 生成更智能的工作内容摘要。在设置中可以选择：</p>
          <ul>
            <li><strong>本地 Ollama</strong>：使用本地运行的 Ollama 服务，支持离线使用</li>
            <li><strong>远程 API</strong>：使用 OpenAI 等服务，需要 API Key</li>
          </ul>
          
          <h3>Git 集成</h3>
          <p>设置 Git 作者名称后，应用可以自动从 Git 提交记录中提取工作内容，帮助您更全面地记录开发工作。</p>
        </div>
        
        <div class="help-section">
          <div class="section-title">命令行用法</div>
          
          <p>工作日志记录工具支持通过命令行使用，可以更快速地添加或生成日志。</p>
          
          <div class="code-block">
            <pre><code>work-record [command] [options]</code></pre>
          </div>
          
          <h3>可用命令</h3>
          <ul>
            <li>
              <strong>add</strong> - 添加新的工作日志
              <div class="code-block">
                <pre><code>work-record add "修复了登录页面的 UI 问题" --source "meeting" --tags "前端,UI" --date "2023-10-01"</code></pre>
              </div>
              <p class="command-desc">参数说明: content 日志内容(必需), --source 日志来源 (默认: manual), --tags 标签列表, --date 指定日期 (默认: 今天)</p>
            </li>
            <li>
              <strong>list</strong> - 列出指定日期的日志
              <div class="code-block">
                <pre><code>work-record list --date "2023-10-01" --format json</code></pre>
              </div>
              <p class="command-desc">参数说明: --date 指定日期 (默认: 今天), --format 输出格式 (text/json)</p>
            </li>
            <li>
              <strong>summary</strong> - 生成日志摘要
              <div class="code-block">
                <pre><code>work-record summary --type weekly --start-date "2023-10-01" --end-date "2023-10-07" --title "周报" --output report.md</code></pre>
              </div>
              <p class="command-desc">参数说明: --type 摘要类型 (daily/weekly/monthly/quarterly/custom), --start-date/--end-date 日期范围, --title 摘要标题, --output 输出文件</p>
            </li>
            <li>
              <strong>config</strong> - 显示应用配置信息
              <div class="code-block">
                <pre><code>work-record config</code></pre>
              </div>
            </li>
          </ul>
          
          <h3>示例工作流</h3>
          <ol>
            <li>每天记录工作内容: <code>work-record add "完成了用户模块重构" --source "coding" --tags "后端,重构"</code></li>
            <li>周末生成周报: <code>work-record summary --type weekly --title "本周工作总结" --output weekly-report.md</code></li>
          </ol>
          
          <p class="note">注意: 命令行工具会使用与图形界面相同的配置文件，保持数据同步。</p>
        </div>
        
        <div class="help-section">
          <div class="section-title">常见问题</div>
          
          <h3>如何更改数据存储位置？</h3>
          <p>在设置面板中，可以修改"日志记录文件存储目录"和"日志生成目录"的路径。</p>
          
          <h3>应用是否支持多设备同步？</h3>
          <p>目前不直接支持。但您可以将存储目录设置为云存储文件夹（如 Dropbox、OneDrive 等）实现基本同步。</p>
          
          <h3>如何获取帮助？</h3>
          <p>如遇到问题，请参考应用官方文档或联系技术支持。</p>
        </div>
      </div>
    `;
  }
}

// 注册自定义元素
customElements.define('help-panel', HelpPanel); 