/**
 * 日志条目输入表单组件
 */
class LogEntryForm extends HTMLElement {
  private selectedTags: Set<string> = new Set();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    if (!this.shadowRoot) return;

    // 表单提交
    const form = this.shadowRoot.getElementById('log-form');
    if (form) {
      form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    // 标签点击
    const tagItems = this.shadowRoot.querySelectorAll('.tag-item');
    tagItems.forEach(tag => {
      tag.addEventListener('click', this.handleTagClick.bind(this));
    });

    // 获取Git提交
    const fetchGitBtn = this.shadowRoot.getElementById('fetch-git-btn');
    if (fetchGitBtn) {
      fetchGitBtn.addEventListener('click', this.handleFetchGit.bind(this));
    }
  }

  /**
   * 处理标签点击
   */
  private handleTagClick(e: Event) {
    const target = e.currentTarget as HTMLElement;
    const tag = target.getAttribute('data-tag');
    
    if (!tag) return;

    if (this.selectedTags.has(tag)) {
      this.selectedTags.delete(tag);
      target.classList.remove('active');
    } else {
      this.selectedTags.add(tag);
      target.classList.add('active');
    }
  }

  /**
   * 处理表单提交
   */
  private async handleSubmit(e: Event) {
    e.preventDefault();
    
    if (!this.shadowRoot) return;

    const contentTextarea = this.shadowRoot.getElementById('content') as HTMLTextAreaElement;
    const content = contentTextarea?.value?.trim() || '';

    if (!content) {
      this.showError('请输入日志内容');
      return;
    }

    try {
      // @ts-ignore - Tauri API
      if (!window.__TAURI__) {
        this.showError('Tauri API 不可用');
        return;
      }
      
      // @ts-ignore - Tauri API
      const { invoke } = window.__TAURI__;
      console.log('调用添加日志接口，内容:', content);
      
      await invoke('add_log_entry', {
        content,
        source: 'manual',
        tags: Array.from(this.selectedTags),
      });

      console.log('日志添加成功');
      this.showSuccess('日志添加成功');
      this.resetForm();
      
      // 触发日志更新事件，通知文件列表组件刷新
      const event = new CustomEvent('log-added');
      this.dispatchEvent(event);
    } catch (error) {
      console.error('添加日志失败:', error);
      this.showError('添加日志失败，请重试');
    }
  }

  /**
   * 处理获取Git提交
   */
  private async handleFetchGit() {
    try {
      // @ts-ignore - Tauri API
      if (!window.__TAURI__) {
        this.showError('Tauri API 不可用');
        return;
      }
      
      // @ts-ignore - Tauri API
      const { invoke } = window.__TAURI__;
      console.log('正在获取Git提交...');
      
      const today = new Date().toISOString().split('T')[0];
      const commits = await invoke('fetch_git_commits', { date: today });
      
      if (!commits || (commits as any[]).length === 0) {
        this.showError('今日没有Git提交记录');
        return;
      }
      
      const contentTextarea = this.shadowRoot?.getElementById('content') as HTMLTextAreaElement;
      if (!contentTextarea) return;
      
      const commitMessages = (commits as any[])
        .map(commit => `- ${commit.message}`)
        .join('\n');
      
      // 如果文本区域已有内容，添加到现有内容
      const currentContent = contentTextarea.value;
      contentTextarea.value = currentContent ? 
        `${currentContent}\n\nGit提交:\n${commitMessages}` : 
        `Git提交:\n${commitMessages}`;
      
      this.showSuccess('已添加Git提交记录');
    } catch (error) {
      console.error('获取Git提交失败:', error);
      this.showError('获取Git提交失败，请重试');
    }
  }

  /**
   * 重置表单
   */
  private resetForm() {
    if (!this.shadowRoot) return;

    const contentTextarea = this.shadowRoot.getElementById('content') as HTMLTextAreaElement;
    if (contentTextarea) {
      contentTextarea.value = '';
    }

    // 重置标签
    this.selectedTags.clear();
    const tagItems = this.shadowRoot.querySelectorAll('.tag-item');
    tagItems.forEach(tag => {
      tag.classList.remove('active');
    });
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

        .log-form {
          display: grid;
          grid-template-columns: 1fr;
          gap: 15px;
        }

        .form-group {
          display: grid;
          gap: 10px;
        }

        .form-group label {
          font-weight: 500;
          color: #555;
        }

        textarea {
          width: 100%;
          height: 150px;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          resize: vertical;
          font-family: inherit;
          font-size: 14px;
        }

        .tags-container {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .tag-item {
          background-color: #f0f0f0;
          padding: 5px 10px;
          border-radius: 15px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .tag-item:hover {
          background-color: #e5e5e5;
        }

        .tag-item.active {
          background-color: #007aff;
          color: white;
        }

        .form-actions {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
        }

        button {
          background-color: #007aff;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.2s;
        }

        button:hover:not(:disabled) {
          background-color: #0062cc;
        }

        button.secondary {
          background-color: #f0f0f0;
          color: #333;
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
      </style>

      <h2>新建日志</h2>

      <form id="log-form" class="log-form">
        <div class="form-group">
          <label for="content">内容</label>
          <textarea id="content" name="content" placeholder="输入今日工作内容..." required></textarea>
        </div>

        <div class="form-group">
          <label>标签</label>
          <div class="tags-container">
            <div class="tag-item" data-tag="工作">工作</div>
            <div class="tag-item" data-tag="问题">问题</div>
            <div class="tag-item" data-tag="学习">学习</div>
            <div class="tag-item" data-tag="计划">计划</div>
            <div class="tag-item" data-tag="其他">其他</div>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" id="fetch-git-btn" class="secondary">提取Git提交</button>
          <button type="submit">保存日志</button>
        </div>
      </form>

      <div id="toast" class="toast"></div>
    `;
  }
}

// 注册自定义元素
customElements.define('log-entry-form', LogEntryForm); 