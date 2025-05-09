/**
 * 日志摘要面板组件
 */
class LogSummaryPanel extends HTMLElement {
  private startDate: string = '';
  private endDate: string = '';
  private summaryTitle: string = '';
  private summaryType: number = 0; // 0: 周, 1: 月, 2: 季度, 3: 自定义
  private currentSummary: string = ''; // 存储当前累积的摘要内容
  private eventListenersActive: boolean = false; // 跟踪是否已注册事件监听器

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupFormInitialValues();
    this.setupEventListeners();
    this.setupTauriEventListeners();
  }

  disconnectedCallback() {
    // 在组件移除时清理事件监听器
    this.removeTauriEventListeners();
  }

  /**
   * 设置Tauri事件监听器
   */
  private setupTauriEventListeners() {
    if (this.eventListenersActive) return;

    try {
      // @ts-ignore - Tauri API
      const { listen } = window.__TAURI__.event;

      // 监听摘要生成开始事件
      listen('summary-generation-start', () => {
        console.log('摘要生成开始');
        this.setGeneratingState(true);
        // 重置当前摘要内容
        this.currentSummary = '';
        
        // 创建或清空结果容器
        const resultContainer = this.shadowRoot?.getElementById('summary-result');
        if (resultContainer) {
          resultContainer.innerHTML = `
            <div class="result-header">
              <h3>${this.summaryTitle}</h3>
            </div>
            <div id="result-stream-content" class="result-content"></div>
          `;
        }
      });

      // 监听处理中事件
      listen('summary-generation-processing', (event: { payload: string }) => {
        console.log('摘要生成处理中:', event.payload);
        // 可以显示一些处理状态或总的进度，如果需要
      });

      // 监听分块内容事件
      listen('summary-generation-chunk', (event: { payload: string }) => {
        const chunk = event.payload;
        if (!chunk) return;

        // 累积摘要内容
        this.currentSummary += chunk;
        
        // 更新流式显示
        const streamContent = this.shadowRoot?.getElementById('result-stream-content');
        if (streamContent) {
          streamContent.innerHTML = this.formatMarkdown(this.currentSummary);
          // 自动滚动到底部以查看最新内容
          streamContent.scrollTop = streamContent.scrollHeight;
        }
      });

      // 监听完成事件
      listen('summary-generation-complete', (event: { payload: string }) => {
        console.log('摘要生成完成');
        const summary = event.payload || '';
        
        // 显示完整摘要结果
        this.showSummaryResult(summary);
        this.setGeneratingState(false);
      });

      // 监听错误事件
      listen('summary-generation-error', (event: { payload: string }) => {
        console.error('摘要生成错误:', event.payload);
        this.showError(event.payload || '生成摘要失败，请重试');
        this.setGeneratingState(false);
      });

      this.eventListenersActive = true;
    } catch (error: unknown) {
      console.error('设置Tauri事件监听器失败:', error);
    }
  }

  /**
   * 移除Tauri事件监听器
   */
  private removeTauriEventListeners() {
    try {
      // @ts-ignore - Tauri API
      const { listen } = window.__TAURI__.event;
      
      listen.drop('summary-generation-start');
      listen.drop('summary-generation-processing');
      listen.drop('summary-generation-chunk');
      listen.drop('summary-generation-complete');
      listen.drop('summary-generation-error');
      
      this.eventListenersActive = false;
    } catch (error: unknown) {
      console.error('移除Tauri事件监听器失败:', error);
    }
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
      // 设置初始加载状态
      this.setGeneratingState(true);
      
      // 调用后端生成摘要
      // @ts-ignore - Tauri API
      const { invoke } = window.__TAURI__.core;
      
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
      
      // 调用后端接口，但不等待结果（结果通过事件传递）
      invoke('generate_summary', params).catch((error: unknown) => {
        console.error('调用摘要生成接口失败:', error);
        this.showError(typeof error === 'string' ? error : '调用摘要生成接口失败，请重试');
        this.setGeneratingState(false);
      });
      
      // 注意：不再在这里设置非生成状态，将在收到完成事件时设置
    } catch (error: unknown) {
      console.error('生成摘要失败:', error);
      this.showError(typeof error === 'string' ? error : '生成摘要失败，请重试');
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
    
    // 确保summary不为null或undefined
    const safeContent = summary || '';

    const resultContainer = this.shadowRoot.getElementById('summary-result');
    if (resultContainer) {
      resultContainer.innerHTML = `
        <div class="result-header">
          <h3>${this.summaryTitle}</h3>
          <button id="copy-btn" class="copy-btn">复制</button>
        </div>
        <div class="result-content">${this.formatMarkdown(safeContent)}</div>
      `;

      // 绑定复制按钮
      const copyBtn = this.shadowRoot.getElementById('copy-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(safeContent)
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
          color: #333;
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
          color: #555;
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
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        input[type="radio"] {
          margin: 0;
        }

        .date-fields {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          align-items: center;
        }

        .date-fields.disabled {
          opacity: 0.6;
        }

        .date-field {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: center;
          gap: 10px;
        }

        button {
          background-color: #0d6efd;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 10px 20px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background-color 0.2s;
        }

        button:hover:not(:disabled) {
          background-color: #0062cc;
        }

        button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 10px;
        }

        .loading-indicator {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          display: none;
        }

        .loading-indicator.active {
          display: inline-block;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .summary-result {
          margin-top: 30px;
          border: 1px solid #eee;
          border-radius: 4px;
          overflow: hidden;
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px;
          background-color: #f5f5f5;
          border-bottom: 1px solid #eee;
        }

        .result-header h3 {
          margin: 0;
          font-size: 16px;
        }

        .copy-btn {
          padding: 6px 12px;
          font-size: 13px;
        }

        .result-content {
          padding: 20px;
          white-space: pre-line;
          background-color: #ffffff;
          line-height: 1.6;
          max-height: 500px;
          overflow-y: auto;
        }

        .toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 10px 15px;
          border-radius: 4px;
          color: white;
          font-size: 14px;
          opacity: 0;
          transition: opacity 0.3s;
          z-index: 1000;
        }

        .toast.success {
          background-color: #4caf50;
          opacity: 1;
        }

        .toast.error {
          background-color: #f44336;
          opacity: 1;
        }

        h2, h3 {
          color: #333;
        }

        .section-divider {
          height: 1px;
          background-color: #eee;
          margin: 20px 0;
        }
      </style>

      <h2>日志摘要生成</h2>

      <form id="summary-form" class="summary-form">
        <div class="form-group">
          <label>摘要类型</label>
          <div class="radio-group">
            <div class="radio-option">
              <input type="radio" id="summary-type-weekly" name="summary-type" value="0">
              <label for="summary-type-weekly">周摘要</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="summary-type-monthly" name="summary-type" value="1">
              <label for="summary-type-monthly">月摘要</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="summary-type-quarterly" name="summary-type" value="2">
              <label for="summary-type-quarterly">季度摘要</label>
            </div>
            <div class="radio-option">
              <input type="radio" id="summary-type-custom" name="summary-type" value="3">
              <label for="summary-type-custom">自定义时间范围</label>
            </div>
          </div>
        </div>

        <div id="date-fields" class="date-fields disabled">
          <div class="date-field">
            <label for="start-date">开始日期</label>
            <input type="date" id="start-date" name="start-date" disabled>
          </div>
          <div class="date-field">
            <label for="end-date">结束日期</label>
            <input type="date" id="end-date" name="end-date" disabled>
          </div>
        </div>

        <div class="form-group">
          <label for="summary-title">摘要标题</label>
          <input type="text" id="summary-title" name="summary-title" required>
        </div>

        <div class="form-actions">
          <button type="submit" id="generate-btn">
            生成摘要
            <div id="loading-indicator" class="loading-indicator"></div>
          </button>
        </div>
      </form>

      <div class="section-divider"></div>

      <div id="summary-result"></div>

      <div id="toast" class="toast"></div>
    `;
  }
}

// 注册自定义元素
customElements.define('log-summary-panel', LogSummaryPanel); 