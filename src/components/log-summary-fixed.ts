/**
 * 修复后的日志摘要面板组件
 */
import { invoke } from '@tauri-apps/api/tauri';

class LogSummaryPanel extends HTMLElement {
  private startDate: string = '';
  private endDate: string = '';
  private summaryTitle: string = '';
  private summaryType: number = 0; // 0: 周, 1: 月, 2: 季度, 3: 自定义

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupFormInitialValues();
    this.setupEventListeners();
  }

  /**
   * 设置表单初始值
   */
  private setupFormInitialValues() {
    if (!this.shadowRoot) return;

    // 设置默认为"周报告"
    const weeklyRadio = this.shadowRoot.getElementById('summary-type-weekly') as HTMLInputElement;
    if (weeklyRadio) {
      weeklyRadio.checked = true;
    }

    // 设置默认日期
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);

    const startDateInput = this.shadowRoot.getElementById('start-date') as HTMLInputElement;
    const endDateInput = this.shadowRoot.getElementById('end-date') as HTMLInputElement;

    if (startDateInput && endDateInput) {
      startDateInput.value = this.formatDate(weekAgo);
      endDateInput.value = this.formatDate(today);
      this.startDate = startDateInput.value;
      this.endDate = endDateInput.value;
    }

    // 设置默认标题
    const titleInput = this.shadowRoot.getElementById('summary-title') as HTMLInputElement;
    if (titleInput) {
      titleInput.value = `工作周报 (${this.formatDate(weekAgo)} ~ ${this.formatDate(today)})`;
      this.summaryTitle = titleInput.value;
    }

    // 设置自定义日期区域的禁用状态
    this.updateCustomDateFieldsState();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    if (!this.shadowRoot) return;

    // 表单提交
    const form = this.shadowRoot.getElementById('summary-form');
    if (form) {
      form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    // 摘要类型变更
    const radioButtons = this.shadowRoot.querySelectorAll('input[name="summary-type"]');
    radioButtons.forEach(radio => {
      radio.addEventListener('change', this.handleSummaryTypeChange.bind(this));
    });

    // 日期变更
    const startDateInput = this.shadowRoot.getElementById('start-date');
    const endDateInput = this.shadowRoot.getElementById('end-date');
    if (startDateInput) {
      startDateInput.addEventListener('change', this.handleDateChange.bind(this));
    }
    if (endDateInput) {
      endDateInput.addEventListener('change', this.handleDateChange.bind(this));
    }

    // 标题变更
    const titleInput = this.shadowRoot.getElementById('summary-title');
    if (titleInput) {
      titleInput.addEventListener('input', (e) => {
        this.summaryTitle = (e.target as HTMLInputElement).value;
      });
    }
  }

  /**
   * 处理摘要类型变更
   */
  private handleSummaryTypeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    this.summaryType = parseInt(target.value);
    
    // 更新标题
    this.updateSummaryTitle();
    
    // 更新自定义日期字段状态
    this.updateCustomDateFieldsState();
  }

  /**
   * 更新自定义日期字段的启用/禁用状态
   */
  private updateCustomDateFieldsState() {
    if (!this.shadowRoot) return;

    const startDateInput = this.shadowRoot.getElementById('start-date') as HTMLInputElement;
    const endDateInput = this.shadowRoot.getElementById('end-date') as HTMLInputElement;
    const dateFields = this.shadowRoot.getElementById('date-fields');

    if (startDateInput && endDateInput && dateFields) {
      const isCustom = this.summaryType === 3;
      startDateInput.disabled = !isCustom;
      endDateInput.disabled = !isCustom;
      
      if (isCustom) {
        dateFields.classList.remove('disabled');
      } else {
        dateFields.classList.add('disabled');
      }
    }
  }

  /**
   * 处理日期变更
   */
  private handleDateChange(e: Event) {
    const target = e.target as HTMLInputElement;
    
    if (target.id === 'start-date') {
      this.startDate = target.value;
    } else if (target.id === 'end-date') {
      this.endDate = target.value;
    }
    
    // 更新标题
    if (this.summaryType === 3) {
      this.updateSummaryTitle();
    }
  }

  /**
   * 更新摘要标题
   */
  private updateSummaryTitle() {
    if (!this.shadowRoot) return;

    const titleInput = this.shadowRoot.getElementById('summary-title') as HTMLInputElement;
    if (!titleInput) return;

    let title = '';
    
    switch (this.summaryType) {
      case 0: // 周报告
        title = `工作周报 (${this.startDate} ~ ${this.endDate})`;
        break;
      case 1: // 月报告
        title = `工作月报 (${this.getMonthFromDate(this.startDate)})`;
        break;
      case 2: // 季度报告
        title = `工作季报 (${this.getQuarterFromDate(this.startDate)})`;
        break;
      case 3: // 自定义
        title = `工作报告 (${this.startDate} ~ ${this.endDate})`;
        break;
    }
    
    titleInput.value = title;
    this.summaryTitle = title;
  }

  /**
   * 从日期字符串获取月份表示
   */
  private getMonthFromDate(dateStr: string): string {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  }

  /**
   * 从日期字符串获取季度表示
   */
  private getQuarterFromDate(dateStr: string): string {
    const date = new Date(dateStr);
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${date.getFullYear()}年第${quarter}季度`;
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 处理表单提交
   */
  private async handleSubmit(e: Event) {
    e.preventDefault();
    
    if (!this.shadowRoot) return;

    try {
      // 显示加载状态
      this.setGeneratingState(true);
      
      // 将数字类型的summaryType转换为对应的字符串类型
      let summaryTypeString: string;
      switch (this.summaryType) {
        case 0:
          summaryTypeString = "weekly";
          break;
        case 1:
          summaryTypeString = "monthly";
          break;
        case 2:
          summaryTypeString = "quarterly";
          break;
        case 3:
          summaryTypeString = "custom";
          break;
        default:
          summaryTypeString = "weekly"; // 默认值
      }
      
      console.log('准备生成摘要，类型:', this.summaryType, '(', summaryTypeString, ')', 
                  '标题:', this.summaryTitle, 
                  '日期范围:', this.summaryType === 3 ? `${this.startDate} 至 ${this.endDate}` : '自动');
      
      const params: any = {
        summaryType: summaryTypeString,  // 使用驼峰命名，匹配后端camelCase配置
        title: this.summaryTitle,
      };
      
      // 仅在自定义类型时提供日期
      if (this.summaryType === 3) {
        params.startDate = this.startDate;
        params.endDate = this.endDate;
      }
      
      console.log('调用generate_summary命令，参数:', JSON.stringify(params));
      
      // 使用导入的invoke而不是window.__TAURI__
      const response = await invoke('generate_summary', params);
      
      // 确保我们有一个字符串类型的摘要
      const summary = (typeof response === 'string') ? response : '';
      
      console.log('摘要生成成功，结果长度:', summary.length);
      
      // 显示摘要结果
      this.showSummaryResult(summary);
      this.setGeneratingState(false);
    } catch (error) {
      console.error('生成摘要失败:', error);
      
      // 详细记录错误信息以帮助调试
      let errorMessage = '生成摘要失败';
      
      if (typeof error === 'string') {
        errorMessage = error;
        console.error('错误信息(字符串):', error);
      } else if (error instanceof Error) {
        errorMessage = `${error.name}: ${error.message}`;
        console.error('错误详情(Error对象):', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      } else if (error && typeof error === 'object') {
        try {
          errorMessage = JSON.stringify(error);
          console.error('错误详情(对象):', error);
        } catch (e) {
          console.error('无法序列化错误对象:', e);
        }
      }
      
      this.showError(errorMessage);
      this.setGeneratingState(false);
    }
  }

  /**
   * 设置生成中状态
   */
  private setGeneratingState(isGenerating: boolean) {
    if (!this.shadowRoot) return;

    const generateBtn = this.shadowRoot.getElementById('generate-btn');
    const loadingIndicator = this.shadowRoot.getElementById('loading-indicator');
    
    if (generateBtn && loadingIndicator) {
      if (isGenerating) {
        generateBtn.setAttribute('disabled', 'true');
        generateBtn.textContent = '生成中...';
        loadingIndicator.classList.add('active');
      } else {
        generateBtn.removeAttribute('disabled');
        generateBtn.textContent = '生成摘要';
        loadingIndicator.classList.remove('active');
      }
    }
  }

  /**
   * 显示摘要结果
   */
  private showSummaryResult(summary: string) {
    if (!this.shadowRoot) return;
    
    const resultContainer = this.shadowRoot.getElementById('summary-result');
    if (resultContainer) {
      resultContainer.style.display = 'block';
      resultContainer.innerHTML = `
        <div class="result-header">
          <h3>${this.summaryTitle}</h3>
          <button id="copy-btn" class="copy-btn">复制</button>
        </div>
        <div class="result-content">${this.formatMarkdown(summary)}</div>
      `;

      // 绑定复制按钮
      const copyBtn = this.shadowRoot.getElementById('copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(summary)
            .then(() => this.showSuccess('摘要已复制到剪贴板'))
            .catch(() => this.showError('复制失败，请手动选择文本复制'));
        });
      }

      // 滚动到结果区域
      resultContainer.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /**
   * 格式化 Markdown 文本为 HTML
   */
  private formatMarkdown(markdown: string): string {
    // 检查markdown是否为null或undefined
    if (!markdown) {
      return '';
    }
    
    // 简单的 Markdown 格式化，实际项目中建议使用专门的 Markdown 解析库
    return markdown
      .replace(/\n/g, '<br>')
      .replace(/#{3} (.*)/g, '<h3>$1</h3>')
      .replace(/#{2} (.*)/g, '<h2>$1</h2>')
      .replace(/# (.*)/g, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/- (.*)/g, '• $1<br>');
  }

  /**
   * 显示成功提示
   */
  private showSuccess(message: string) {
    if (!this.shadowRoot) return;

    const toast = this.shadowRoot.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.className = 'toast success';
      setTimeout(() => {
        toast.className = 'toast';
      }, 3000);
    }
  }

  /**
   * 显示错误提示
   */
  private showError(message: string) {
    if (!this.shadowRoot) return;

    const toast = this.shadowRoot.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.className = 'toast error';
      setTimeout(() => {
        toast.className = 'toast';
      }, 3000);
    }
  }

  /**
   * 渲染组件
   */
  private render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }

        h2 {
          font-size: 20px;
          margin-bottom: 20px;
          color: var(--text-primary);
        }

        .summary-form {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          max-width: 800px;
          margin-bottom: 30px;
        }

        .form-group {
          display: grid;
          gap: 10px;
        }

        .form-group label {
          font-weight: 500;
          color: var(--text-secondary);
        }

        .radio-group {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
        }

        .radio-option {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        input[type="text"], input[type="date"] {
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          background-color: var(--bg-elevated);
          color: var(--text-primary);
          font-size: 14px;
        }

        input[type="radio"] {
          margin: 0;
          accent-color: var(--accent);
        }

        #date-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        #date-fields.disabled {
          opacity: 0.6;
        }

        button {
          padding: 10px 16px;
          background-color: var(--accent);
          color: white;
          border: none;
          border-radius: var(--border-radius);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color var(--transition-base);
        }

        button:hover {
          background-color: var(--accent-hover);
        }

        button:disabled {
          background-color: var(--border-color);
          cursor: not-allowed;
        }

        .loading-indicator {
          display: none;
          margin-left: 10px;
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: #fff;
          animation: spin 1s linear infinite;
        }
        
        .loading-indicator.active {
          display: inline-block;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        #summary-result {
          margin-top: 30px;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          background-color: var(--bg-elevated);
          padding: 20px;
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--border-color);
        }

        .result-header h3 {
          margin: 0;
          font-size: 18px;
          color: var(--text-primary);
        }

        .copy-btn {
          padding: 5px 10px;
          font-size: 12px;
        }

        .result-content {
          line-height: 1.6;
          color: var(--text-primary);
        }

        .result-content h1, .result-content h2, .result-content h3 {
          margin-top: 20px;
          margin-bottom: 10px;
          color: var(--text-primary);
        }

        .toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 10px 15px;
          border-radius: var(--border-radius);
          color: white;
          font-size: 14px;
          opacity: 0;
          transition: opacity 0.3s;
          z-index: 1000;
        }

        .toast.success {
          background-color: var(--success);
          opacity: 1;
        }

        .toast.error {
          background-color: var(--error);
          opacity: 1;
        }
      </style>

      <h2>生成工作摘要</h2>
      
      <form id="summary-form" class="summary-form">
        <div class="form-group">
          <label>摘要类型</label>
          <div class="radio-group">
            <div class="radio-option">
              <input type="radio" id="summary-type-weekly" name="summary-type" value="0">
              <label for="summary-type-weekly">周报告</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="summary-type-monthly" name="summary-type" value="1">
              <label for="summary-type-monthly">月报告</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="summary-type-quarterly" name="summary-type" value="2">
              <label for="summary-type-quarterly">季报告</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="summary-type-custom" name="summary-type" value="3">
              <label for="summary-type-custom">自定义</label>
            </div>
          </div>
        </div>
        
        <div class="form-group">
          <label>日期范围</label>
          <div id="date-fields" class="disabled">
            <input type="date" id="start-date" disabled>
            <input type="date" id="end-date" disabled>
          </div>
        </div>
        
        <div class="form-group">
          <label for="summary-title">标题</label>
          <input type="text" id="summary-title">
        </div>
        
        <div class="form-actions">
          <button type="submit" id="generate-btn">生成摘要</button>
          <div id="loading-indicator" class="loading-indicator"></div>
        </div>
      </form>
      
      <div id="summary-result" style="display:none;"></div>
      
      <div id="toast" class="toast"></div>
    `;
  }
}

// 注册自定义元素
customElements.define('log-summary-panel', LogSummaryPanel); 