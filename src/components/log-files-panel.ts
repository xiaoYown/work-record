/**
 * 日志文件管理面板组件
 */
class LogFilesPanel extends HTMLElement {
  private logFiles: string[] = [];
  private currentFile: string | null = null;
  private logEntries: any[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadLogFiles();
  }

  /**
   * 加载日志文件列表
   */
  private async loadLogFiles() {
    try {
      // @ts-ignore - Tauri API
      const { invoke } = window.__TAURI__.core;
      this.logFiles = await invoke('get_log_files');
      this.renderLogFilesList();
      
      // 如果有日志文件，自动加载第一个
      if (this.logFiles.length > 0) {
        this.loadLogEntries(this.logFiles[0]);
      }
    } catch (error) {
      console.error('加载日志文件失败:', error);
      this.showError('加载日志文件失败，请重试');
    }
  }

  /**
   * 加载指定日志文件的条目
   */
  private async loadLogEntries(fileName: string) {
    try {
      const date = fileName.replace('.json', '');
      this.currentFile = fileName;

      // @ts-ignore - Tauri API
      const { invoke } = window.__TAURI__.core;
      this.logEntries = await invoke('get_log_entries', { date });
      
      this.renderLogEntries();
      this.updateSelectedFile();
    } catch (error) {
      console.error('加载日志条目失败:', error);
      this.showError('加载日志条目失败，请重试');
    }
  }

  /**
   * 处理日志文件点击
   */
  private handleFileClick(fileName: string) {
    this.loadLogEntries(fileName);
  }

  /**
   * 渲染日志文件列表
   */
  private renderLogFilesList() {
    if (!this.shadowRoot) return;

    const filesList = this.shadowRoot.getElementById('log-files-list');
    if (!filesList) return;

    if (this.logFiles.length === 0) {
      filesList.innerHTML = '<div class="empty-state">暂无日志文件</div>';
      return;
    }

    filesList.innerHTML = this.logFiles.map(file => {
      const date = file.replace('.json', '');
      const isActive = file === this.currentFile ? 'active' : '';
      return `<div class="file-item ${isActive}" data-file="${file}">${date}</div>`;
    }).join('');

    // 绑定点击事件
    const fileItems = filesList.querySelectorAll('.file-item');
    fileItems.forEach(item => {
      item.addEventListener('click', () => {
        const file = item.getAttribute('data-file');
        if (file) {
          this.handleFileClick(file);
        }
      });
    });
  }

  /**
   * 更新当前选中的文件
   */
  private updateSelectedFile() {
    if (!this.shadowRoot) return;

    const fileItems = this.shadowRoot.querySelectorAll('.file-item');
    fileItems.forEach(item => {
      const file = item.getAttribute('data-file');
      if (file === this.currentFile) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * 渲染日志条目
   */
  private renderLogEntries() {
    if (!this.shadowRoot) return;

    const entriesContainer = this.shadowRoot.getElementById('log-entries');
    if (!entriesContainer) return;

    if (this.logEntries.length === 0) {
      entriesContainer.innerHTML = '<div class="empty-state">当前文件没有日志记录</div>';
      return;
    }

    entriesContainer.innerHTML = this.logEntries.map(entry => {
      const date = new Date(entry.created_at).toLocaleString();
      const tagsHtml = entry.tags.length > 0 
        ? `<div class="entry-tags">${entry.tags.map((tag: string) => `<span class="tag">${tag}</span>`).join('')}</div>` 
        : '';
      
      return `
        <div class="log-entry" data-id="${entry.id}">
          <div class="entry-header">
            <div class="entry-time">${date}</div>
            <div class="entry-source">${entry.source}</div>
            <div class="entry-actions">
              <button class="edit-btn" data-id="${entry.id}">编辑</button>
              <button class="delete-btn" data-id="${entry.id}">删除</button>
            </div>
          </div>
          <div class="entry-content">${entry.content}</div>
          ${tagsHtml}
        </div>
      `;
    }).join('');

    // 绑定编辑和删除按钮事件
    const editButtons = entriesContainer.querySelectorAll('.edit-btn');
    editButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) {
          this.handleEditEntry(id);
        }
      });
    });

    const deleteButtons = entriesContainer.querySelectorAll('.delete-btn');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        if (id) {
          this.handleDeleteEntry(id);
        }
      });
    });
  }

  /**
   * 处理编辑日志条目
   */
  private handleEditEntry(entryId: string) {
    const entry = this.logEntries.find(e => e.id === entryId);
    if (!entry) return;

    // 创建日志编辑表单
    this.showEditForm(entry);
  }

  /**
   * 处理删除日志条目
   */
  private async handleDeleteEntry(entryId: string) {
    if (!this.currentFile) return;

    const confirmed = confirm('确定要删除这条日志吗？');
    if (!confirmed) return;

    try {
      const date = this.currentFile.replace('.json', '');
      
      // @ts-ignore - Tauri API
      const { invoke } = window.__TAURI__.core;
      await invoke('delete_log_entry', { entryId, date });
      
      // 重新加载日志条目
      this.loadLogEntries(this.currentFile);
      this.showSuccess('日志已删除');
    } catch (error) {
      console.error('删除日志失败:', error);
      this.showError('删除日志失败，请重试');
    }
  }

  /**
   * 显示日志编辑表单
   */
  private showEditForm(entry: any) {
    if (!this.shadowRoot) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>编辑日志</h3>
          <button class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="edit-form">
            <div class="form-group">
              <label for="content">内容</label>
              <textarea id="content" name="content" rows="6">${entry.content}</textarea>
            </div>
            <div class="form-group">
              <label>标签</label>
              <div class="tags-container">
                <div class="tag-item ${entry.tags.includes('工作') ? 'active' : ''}" data-tag="工作">工作</div>
                <div class="tag-item ${entry.tags.includes('问题') ? 'active' : ''}" data-tag="问题">问题</div>
                <div class="tag-item ${entry.tags.includes('学习') ? 'active' : ''}" data-tag="学习">学习</div>
                <div class="tag-item ${entry.tags.includes('计划') ? 'active' : ''}" data-tag="计划">计划</div>
                <div class="tag-item ${entry.tags.includes('其他') ? 'active' : ''}" data-tag="其他">其他</div>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" class="cancel-btn">取消</button>
              <button type="submit" class="save-btn">保存</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(modal);

    // 绑定关闭按钮
    const closeBtn = modal.querySelector('.close-btn');
    const cancelBtn = modal.querySelector('.cancel-btn');
    const closeModal = () => {
      if (this.shadowRoot) {
        this.shadowRoot.removeChild(modal);
      }
    };

    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeModal);
    }

    // 绑定标签点击事件
    const tagItems = modal.querySelectorAll('.tag-item');
    const selectedTags = new Set(entry.tags);

    tagItems.forEach(item => {
      item.addEventListener('click', () => {
        const tag = item.getAttribute('data-tag');
        if (!tag) return;

        if (selectedTags.has(tag)) {
          selectedTags.delete(tag);
          item.classList.remove('active');
        } else {
          selectedTags.add(tag);
          item.classList.add('active');
        }
      });
    });

    // 绑定表单提交事件
    const form = modal.querySelector('#edit-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const contentTextarea = form.querySelector('#content') as HTMLTextAreaElement;
        
        if (!contentTextarea || !this.currentFile) return;
        
        const updatedEntry = {
          ...entry,
          content: contentTextarea.value,
          tags: Array.from(selectedTags),
        };

        try {
          // @ts-ignore - Tauri API
          const { invoke } = window.__TAURI__.core;
          await invoke('update_log_entry', { entry: updatedEntry });
          
          closeModal();
          // 重新加载日志条目
          this.loadLogEntries(this.currentFile);
          this.showSuccess('日志已更新');
        } catch (error) {
          console.error('更新日志失败:', error);
          this.showError('更新日志失败，请重试');
        }
      });
    }
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
          height: 100%;
        }

        .container {
          display: grid;
          grid-template-columns: 200px 1fr;
          height: 100%;
          gap: 20px;
        }

        .files-sidebar {
          border-right: 1px solid #eee;
          overflow-y: auto;
        }

        .entries-container {
          overflow-y: auto;
          padding-right: 10px;
        }

        h2 {
          font-size: 20px;
          margin-bottom: 20px;
          color: #333;
        }

        .file-item {
          padding: 10px;
          cursor: pointer;
          border-bottom: 1px solid #eee;
          transition: background-color 0.2s;
        }

        .file-item:hover {
          background-color: #f5f5f5;
        }

        .file-item.active {
          background-color: #e6f7ff;
          border-left: 3px solid #1890ff;
          font-weight: 500;
        }

        .log-entry {
          background-color: #fff;
          border: 1px solid #eee;
          border-radius: 4px;
          margin-bottom: 15px;
          padding: 15px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }

        .entry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          font-size: 14px;
          color: #888;
        }

        .entry-content {
          margin-bottom: 10px;
          line-height: 1.5;
          white-space: pre-line;
        }

        .entry-tags {
          display: flex;
          gap: 5px;
          margin-top: 10px;
        }

        .tag {
          background-color: #e0e0e0;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 12px;
        }

        .entry-actions {
          display: flex;
          gap: 5px;
        }

        button {
          background-color: #007aff;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          cursor: pointer;
          font-size: 12px;
          transition: background-color 0.2s;
        }

        button:hover {
          background-color: #0062cc;
        }

        button.delete-btn {
          background-color: #ff3b30;
        }

        button.delete-btn:hover {
          background-color: #d63429;
        }

        .empty-state {
          color: #888;
          text-align: center;
          padding: 20px;
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

        .modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }

        .modal-content {
          background-color: #fff;
          border-radius: 4px;
          width: 600px;
          max-width: 90%;
          max-height: 90%;
          overflow-y: auto;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          border-bottom: 1px solid #eee;
        }

        .modal-header h3 {
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #888;
        }

        .modal-body {
          padding: 20px;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }

        textarea {
          width: 100%;
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
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        .cancel-btn {
          background-color: #f0f0f0;
          color: #333;
        }

        .save-btn {
          padding: 8px 16px;
        }
      </style>

      <div class="container">
        <div class="files-sidebar">
          <h2>日志文件</h2>
          <div id="log-files-list"></div>
        </div>
        
        <div class="entries-container">
          <h2>日志条目</h2>
          <div id="log-entries"></div>
        </div>
      </div>

      <div id="toast" class="toast"></div>
    `;
  }
}

// 注册自定义元素
customElements.define('log-files-panel', LogFilesPanel); 