/**
 * 设置面板组件
 */
import ThemeManager, { ThemeMode, FontSize } from '../theme-manager';
import { createIcon } from './icons';
import { open } from '@tauri-apps/api/dialog';
import { invoke } from '@tauri-apps/api/tauri';

class SettingsPanel extends HTMLElement {
  private settings: any = null;
  private themeManager: ThemeManager;
  // 保存监听器引用，以便正确移除
  private themeChangeListener: (settings: any) => void;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.themeManager = ThemeManager.getInstance();
    
    // 创建监听器引用
    this.themeChangeListener = () => {
      this.updateThemeSelections();
    };
  }

  connectedCallback() {
    this.loadSettings();
    this.render();
    
    // 添加主题变更监听器
    this.themeManager.addThemeChangeListener(this.themeChangeListener);
  }
  
  disconnectedCallback() {
    // 清理主题监听器
    this.themeManager.removeThemeChangeListener(this.themeChangeListener);
  }

  /**
   * 加载设置
   */
  private async loadSettings() {
    try {
      this.settings = await invoke('get_settings');
      this.updateForm();
    } catch (error) {
      console.error('加载设置失败:', error);
      this.showError('加载设置失败，请重试');
    }
  }

  /**
   * 更新表单数据
   */
  private updateForm() {
    if (!this.shadowRoot || !this.settings) return;

    const form = this.shadowRoot.getElementById('settings-form') as HTMLFormElement;
    if (!form) return;

    // 设置表单值
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
      if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
        const name = input.name;
        if (name && this.settings[name] !== undefined) {
          if (input instanceof HTMLInputElement && input.type === 'checkbox') {
            input.checked = this.settings[name];
          } else if (input instanceof HTMLSelectElement) {
            input.value = this.settings[name];
          } else {
            input.value = this.settings[name];
          }
        }
      }
    });

    // 更新 ollama 相关字段的禁用状态
    this.updateOllamaFieldsState();

    // 更新当前主题选择
    this.updateThemeSelections();
  }

  /**
   * 更新主题选择状态
   */
  private updateThemeSelections() {
    if (!this.shadowRoot) return;

    const themeSettings = this.themeManager.getThemeSettings();
    
    // 更新主题模式选择
    const themeSelect = this.shadowRoot.getElementById('theme_mode') as HTMLSelectElement;
    if (themeSelect) {
      themeSelect.value = themeSettings.mode;
    }
    
    // 更新字体大小选择
    const fontSizeSelect = this.shadowRoot.getElementById('font_size') as HTMLSelectElement;
    if (fontSizeSelect) {
      fontSizeSelect.value = themeSettings.fontSize;
    }
  }

  /**
   * 更新 Ollama 相关字段的启用/禁用状态
   */
  private updateOllamaFieldsState() {
    if (!this.shadowRoot) return;

    const useLocalOllama = this.shadowRoot.getElementById('use_local_ollama') as HTMLInputElement;
    const ollamaAddress = this.shadowRoot.getElementById('ollama_address') as HTMLInputElement;
    const ollamaModel = this.shadowRoot.getElementById('ollama_model') as HTMLInputElement;
    const llmApiKey = this.shadowRoot.getElementById('llm_api_key') as HTMLInputElement;
    const llmApiUrl = this.shadowRoot.getElementById('llm_api_url') as HTMLInputElement;

    if (useLocalOllama && ollamaAddress && ollamaModel && llmApiKey && llmApiUrl) {
      // 本地 Ollama 启用时，启用 Ollama 相关字段，禁用远程 API 字段
      ollamaAddress.disabled = !useLocalOllama.checked;
      ollamaModel.disabled = !useLocalOllama.checked;
      llmApiKey.disabled = useLocalOllama.checked;
      llmApiUrl.disabled = useLocalOllama.checked;
    }
  }

  /**
   * 处理选择目录按钮点击
   */
  private async handleSelectDirectory(targetField: string) {
    // 获取对应的按钮元素 (修正ID匹配)
    const buttonId = targetField === 'log_storage_dir' ? 'select-log-dir' : 'select-output-dir';
    const button = this.shadowRoot?.getElementById(buttonId) as HTMLButtonElement;
    if (!button) return;
    
    // 设置按钮为加载状态
    const originalContent = button.innerHTML;
    button.innerHTML = `<div class="loading-spinner"></div>`;
    button.disabled = true;
    
    try {
      // 使用Tauri的dialog API
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: '选择目录'
      });
      
      if (selectedPath && this.shadowRoot) {
        const input = this.shadowRoot.getElementById(targetField) as HTMLInputElement;
        if (input) {
          // 确保处理数组或字符串结果
          input.value = Array.isArray(selectedPath) ? selectedPath[0] : selectedPath as string;
          this.showSuccess('目录已选择');
        }
      }
    } catch (error) {
      console.error('选择目录失败:', error);
      this.showError('无法打开文件选择对话框');
    } finally {
      // 恢复按钮状态
      button.innerHTML = originalContent;
      button.disabled = false;
    }
  }

  /**
   * 处理表单提交
   */
  private async handleSubmit(event: Event) {
    event.preventDefault();

    if (!this.shadowRoot) return;

    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const newSettings: any = { ...this.settings };

    // 获取表单数据
    formData.forEach((value, key) => {
      if (key === 'auto_open_window' || key === 'use_local_ollama') {
        // 处理复选框
        newSettings[key] = value === 'on';
      } else {
        newSettings[key] = value;
      }
    });

    try {
      // 设置提交按钮为加载状态
      const submitButton = this.shadowRoot.querySelector('button[type="submit"]') as HTMLButtonElement;
      const originalButtonText = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.innerHTML = `<div class="loading-spinner"></div> 保存中...`;

      // 调用Tauri命令保存设置
      await invoke('update_settings', { settings: newSettings });
      
      this.settings = newSettings;
      this.showSuccess('设置已保存');
      
      // 恢复按钮状态
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    } catch (error) {
      console.error('保存设置失败:', error);
      this.showError(`保存设置失败: ${error}`);
      
      // 恢复按钮状态
      const submitButton = this.shadowRoot.querySelector('button[type="submit"]') as HTMLButtonElement;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = '保存设置';
      }
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
   * 处理复选框变更
   */
  private handleCheckboxChange(event: Event) {
    const target = event.target as HTMLInputElement;
    
    if (target.id === 'use_local_ollama') {
      this.updateOllamaFieldsState();
    }
  }

  /**
   * 处理主题更改
   */
  private handleThemeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    const value = target.value;
    
    if (target.id === 'theme_mode') {
      this.themeManager.setThemeMode(value as ThemeMode);
    } else if (target.id === 'font_size') {
      this.themeManager.setFontSize(value as FontSize);
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
          color: var(--text-primary);
          box-sizing: border-box;
        }

        *, *:before, *:after {
          box-sizing: border-box;
        }

        h2 {
          font-size: var(--font-size-lg);
          margin-bottom: 24px;
          color: var(--text-primary);
          font-weight: 600;
        }

        .settings-form {
          display: grid;
          grid-template-columns: 1fr;
          gap: 28px;
          max-width: 800px;
        }

        .form-section {
          background-color: var(--bg-elevated);
          border-radius: var(--border-radius);
          padding: 24px;
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--border-color);
          transition: all 0.3s ease;
          overflow: hidden;
        }
        
        .form-section:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .form-group {
          display: grid;
          grid-template-columns: 200px minmax(0, 1fr);
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }
        
        .form-group:last-child {
          margin-bottom: 0;
        }

        .form-group.directory {
          grid-template-columns: 200px minmax(0, 1fr) auto;
        }

        .form-group label {
          font-weight: 500;
          color: var(--text-primary);
          font-size: var(--font-size-base);
        }

        input[type="text"], input[type="password"], select {
          padding: 10px 14px;
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius);
          font-size: var(--font-size-base);
          width: 100%;
          background-color: var(--input-bg);
          color: var(--text-primary);
          transition: all var(--transition-base);
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        input[type="text"]:focus, input[type="password"]:focus, select:focus {
          border-color: var(--accent);
          outline: none;
          box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.25);
        }
        
        input[type="text"]:hover, input[type="password"]:hover, select:hover {
          border-color: rgba(150, 150, 150, 0.6);
        }

        input[type="checkbox"] {
          appearance: none;
          width: 20px;
          height: 20px;
          border: 1px solid var(--border-color);
          border-radius: 5px;
          background-color: var(--input-bg);
          position: relative;
          cursor: pointer;
          vertical-align: middle;
          transition: all 0.2s ease;
        }
        
        input[type="checkbox"]:hover {
          border-color: var(--accent);
        }
        
        input[type="checkbox"]:checked {
          background-color: var(--accent);
          border-color: var(--accent);
        }
        
        input[type="checkbox"]:checked::after {
          content: '';
          position: absolute;
          left: 7px;
          top: 3px;
          width: 5px;
          height: 10px;
          border: solid white;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }

        button {
          background-color: var(--accent);
          color: white;
          border: none;
          border-radius: var(--border-radius);
          padding: 10px 18px;
          cursor: pointer;
          font-size: var(--font-size-base);
          font-weight: 500;
          transition: all var(--transition-base);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        button:hover:not(:disabled) {
          background-color: var(--accent-hover);
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
          opacity: 1;
        }
        
        button:active:not(:disabled) {
          transform: scale(0.98) translateY(0);
          opacity: 0.9;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 32px;
        }
        
        .form-actions button {
          padding: 12px 24px;
          font-weight: 600;
          min-width: 120px;
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

        .section-divider {
          height: 1px;
          background-color: var(--border-color);
          margin: 28px 0;
        }

        .toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 18px;
          border-radius: var(--border-radius);
          color: white;
          font-size: var(--font-size-sm);
          font-weight: 500;
          opacity: 0;
          transition: all 0.3s;
          z-index: 1000;
          box-shadow: var(--shadow-md);
          transform: translateY(20px);
        }

        .toast.success {
          background-color: var(--success-color);
          opacity: 1;
          transform: translateY(0);
        }

        .toast.error {
          background-color: var(--error-color);
          opacity: 1;
          transform: translateY(0);
        }

        .select-dir-btn {
          padding: 10px 14px;
          white-space: nowrap;
        }

        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .secondary-btn {
          background-color: var(--bg-elevated);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .command-line-buttons {
          display: flex;
          gap: 10px;
        }

        .cli-info {
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
          line-height: 1.5;
          grid-column: 1 / 3;
        }

        code {
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          font-size: 0.9em;
          padding: 2px 5px;
          background-color: var(--bg-primary);
          border-radius: 3px;
          border: 1px solid var(--border-color);
        }
      </style>

      <h2>设置</h2>

      <form id="settings-form" class="settings-form">
        <div class="form-section">
          <div class="section-title">界面设置</div>
          
          <div class="form-group">
            <label for="theme_mode">主题</label>
            <select id="theme_mode" name="theme_mode">
              <option value="dark">深色主题</option>
              <option value="light">浅色主题</option>
              <option value="neutral">中性主题</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="font_size">字体大小</label>
            <select id="font_size" name="font_size">
              <option value="small">小</option>
              <option value="medium">中</option>
              <option value="large">大</option>
            </select>
          </div>
        </div>
        
        <div class="form-section">
          <div class="section-title">基本设置</div>

          <div class="form-group directory">
            <label for="log_storage_dir">日志记录文件存储目录</label>
            <input type="text" id="log_storage_dir" name="log_storage_dir" required>
            <button type="button" class="select-dir-btn" id="select-log-dir">
              <app-icon name="folderOpen" size="16"></app-icon>
              选择目录
            </button>
          </div>

          <div class="form-group directory">
            <label for="log_output_dir">日志生成目录</label>
            <input type="text" id="log_output_dir" name="log_output_dir" required>
            <button type="button" class="select-dir-btn" id="select-output-dir">
              <app-icon name="folderOpen" size="16"></app-icon>
              选择目录
            </button>
          </div>

          <div class="form-group">
            <label for="git_author">Git 作者名称</label>
            <input type="text" id="git_author" name="git_author">
          </div>

          <div class="form-group">
            <label for="shortcut">快捷键</label>
            <input type="text" id="shortcut" name="shortcut" placeholder="例如: Alt+Shift+L">
          </div>

          <div class="form-group">
            <label for="auto_open_window">启动时自动打开窗口</label>
            <input type="checkbox" id="auto_open_window" name="auto_open_window">
          </div>
        </div>
        
        <div class="form-section">
          <div class="section-title">摘要生成设置</div>

          <div class="form-group">
            <label for="use_local_ollama">使用本地 Ollama 服务</label>
            <input type="checkbox" id="use_local_ollama" name="use_local_ollama">
          </div>

          <div class="form-group">
            <label for="ollama_address">Ollama 服务地址</label>
            <input type="text" id="ollama_address" name="ollama_address" placeholder="http://localhost:11434">
          </div>

          <div class="form-group">
            <label for="ollama_model">Ollama 模型名称</label>
            <input type="text" id="ollama_model" name="ollama_model" placeholder="llama3">
          </div>

          <div class="form-group">
            <label for="llm_api_url">LLM API 地址</label>
            <input type="text" id="llm_api_url" name="llm_api_url" placeholder="https://api.openai.com/v1/chat/completions">
          </div>

          <div class="form-group">
            <label for="llm_api_key">LLM API Key</label>
            <input type="password" id="llm_api_key" name="llm_api_key">
          </div>
        </div>

        <div class="form-section">
          <div class="section-title">命令行工具</div>
          
          <div class="form-group command-line">
            <label>命令行工具</label>
            <div class="command-line-buttons">
              <button type="button" id="register-cli-btn" class="secondary-btn">
                <app-icon name="save" size="16"></app-icon>
                注册命令行
              </button>
              <button type="button" id="unregister-cli-btn" class="secondary-btn">
                <app-icon name="edit" size="16"></app-icon>
                注销命令行
              </button>
            </div>
          </div>
          
          <div class="form-group">
            <div class="cli-info">
              注册后可使用 <code>work-record</code> 命令。需要管理员权限，并会在系统 PATH 中创建符号链接。
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit">保存设置</button>
        </div>
      </form>

      <div id="toast" class="toast"></div>
    `;

    // 绑定表单提交事件
    const form = this.shadowRoot.getElementById('settings-form');
    if (form) {
      form.addEventListener('submit', this.handleSubmit.bind(this));
    }

    // 绑定目录选择按钮事件
    const selectLogDirBtn = this.shadowRoot.getElementById('select-log-dir');
    if (selectLogDirBtn) {
      selectLogDirBtn.addEventListener('click', () => this.handleSelectDirectory('log_storage_dir'));
    }

    const selectOutputDirBtn = this.shadowRoot.getElementById('select-output-dir');
    if (selectOutputDirBtn) {
      selectOutputDirBtn.addEventListener('click', () => this.handleSelectDirectory('log_output_dir'));
    }

    // 绑定复选框变更事件
    const useLocalOllamaCheckbox = this.shadowRoot.getElementById('use_local_ollama');
    if (useLocalOllamaCheckbox) {
      useLocalOllamaCheckbox.addEventListener('change', this.handleCheckboxChange.bind(this));
    }
    
    // 绑定主题和字体大小变更事件
    const themeSelect = this.shadowRoot.getElementById('theme_mode');
    const fontSizeSelect = this.shadowRoot.getElementById('font_size');
    
    if (themeSelect) {
      themeSelect.addEventListener('change', this.handleThemeChange.bind(this));
    }
    
    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('change', this.handleThemeChange.bind(this));
    }
    
    // 更新主题选择状态
    this.updateThemeSelections();

    // Bind CLI registration/unregistration buttons
    const registerCliBtn = this.shadowRoot.getElementById('register-cli-btn');
    if (registerCliBtn) {
      registerCliBtn.addEventListener('click', this.handleRegisterCli.bind(this));
    }

    const unregisterCliBtn = this.shadowRoot.getElementById('unregister-cli-btn');
    if (unregisterCliBtn) {
      unregisterCliBtn.addEventListener('click', this.handleUnregisterCli.bind(this));
    }
  }

  /**
   * 处理注册命令行
   */
  private async handleRegisterCli() {
    try {
      const registerBtn = this.shadowRoot?.getElementById('register-cli-btn') as HTMLButtonElement;
      if (!registerBtn) return;
      
      // 设置按钮为加载状态
      const originalContent = registerBtn.innerHTML;
      registerBtn.innerHTML = `<div class="loading-spinner"></div> 注册中...`;
      registerBtn.disabled = true;
      
      // 调用后端命令注册CLI
      try {
        await invoke('register_cli');
        this.showSuccess('命令行工具已成功注册');
      } catch (error: any) {
        // 检查是否是需要显示命令的错误信息
        if (typeof error === 'string' && error.includes('请在终端中手动执行')) {
          this.showCommandDialog('注册命令行工具', error);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('注册命令行失败:', error);
      this.showError(`注册命令行失败: ${error}`);
    } finally {
      // 恢复按钮状态
      const registerBtn = this.shadowRoot?.getElementById('register-cli-btn') as HTMLButtonElement;
      if (registerBtn) {
        registerBtn.innerHTML = `<app-icon name="save" size="16"></app-icon> 注册命令行`;
        registerBtn.disabled = false;
      }
    }
  }

  /**
   * 处理注销命令行
   */
  private async handleUnregisterCli() {
    try {
      const unregisterBtn = this.shadowRoot?.getElementById('unregister-cli-btn') as HTMLButtonElement;
      if (!unregisterBtn) return;
      
      // 设置按钮为加载状态
      const originalContent = unregisterBtn.innerHTML;
      unregisterBtn.innerHTML = `<div class="loading-spinner"></div> 注销中...`;
      unregisterBtn.disabled = true;
      
      // 调用后端命令注销CLI
      try {
        await invoke('unregister_cli');
        this.showSuccess('命令行工具已成功注销');
      } catch (error: any) {
        // 检查是否是需要显示命令的错误信息
        if (typeof error === 'string' && error.includes('请在终端中手动执行')) {
          this.showCommandDialog('注销命令行工具', error);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('注销命令行失败:', error);
      this.showError(`注销命令行失败: ${error}`);
    } finally {
      // 恢复按钮状态
      const unregisterBtn = this.shadowRoot?.getElementById('unregister-cli-btn') as HTMLButtonElement;
      if (unregisterBtn) {
        unregisterBtn.innerHTML = `<app-icon name="edit" size="16"></app-icon> 注销命令行`;
        unregisterBtn.disabled = false;
      }
    }
  }

  /**
   * 显示命令对话框
   */
  private showCommandDialog(title: string, message: string) {
    if (!this.shadowRoot) return;

    // 创建对话框元素
    const dialog = document.createElement('div');
    dialog.className = 'command-dialog';

    // 提取命令 - 修复提取逻辑
    // 查找命令模式：在 "：\n\n" 和 "\n\n" 之间的内容
    let command = '';
    const regex = /：\n\n(.*?)\n\n/s;
    // 如果上面的模式没匹配到，尝试不同的格式 "：\n\n" 之后的所有内容直到结尾
    const altRegex = /：\n\n([^]*?)(?:\n\n|$)/s;
    
    const match = message.match(regex) || message.match(altRegex);
    if (match && match[1]) {
      command = match[1].trim();
    }
    
    // 如果仍然没有找到，提取消息中可能的sudo命令
    if (!command) {
      const sudoMatch = message.match(/sudo [^;]+/);
      if (sudoMatch) {
        command = sudoMatch[0];
      }
    }

    dialog.innerHTML = `
      <div class="command-dialog-content">
        <div class="command-dialog-header">
          <h3>${title}</h3>
          <button class="close-dialog-btn">&times;</button>
        </div>
        <div class="command-dialog-body">
          <p>${message.replace(/\n/g, '<br>')}</p>
          ${command ? `
            <div class="command-copy">
              <code>${command}</code>
              <button class="copy-command-btn">复制命令</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // 添加到 DOM
    this.shadowRoot.appendChild(dialog);

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      .command-dialog {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      
      .command-dialog-content {
        background-color: var(--bg-elevated);
        border-radius: var(--border-radius);
        width: 80%;
        max-width: 600px;
        box-shadow: var(--shadow-lg);
        overflow: hidden;
      }
      
      .command-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-color);
      }
      
      .command-dialog-header h3 {
        margin: 0;
        font-size: var(--font-size-lg);
        color: var(--text-primary);
      }
      
      .close-dialog-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--text-secondary);
      }
      
      .command-dialog-body {
        padding: 20px;
        color: var(--text-primary);
        line-height: 1.5;
      }
      
      .command-copy {
        margin-top: 20px;
        background-color: var(--bg-primary);
        border-radius: var(--border-radius);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        border: 1px solid var(--border-color);
      }
      
      .command-copy code {
        font-family: monospace;
        white-space: pre-wrap;
        word-break: break-all;
      }
      
      .copy-command-btn {
        align-self: flex-end;
        padding: 8px 12px;
        background-color: var(--accent);
        color: white;
        border: none;
        border-radius: var(--border-radius);
        cursor: pointer;
        font-size: var(--font-size-sm);
      }
      
      .copy-command-btn:hover {
        background-color: var(--accent-hover);
      }
    `;
    this.shadowRoot.appendChild(style);

    // 绑定关闭按钮事件
    const closeBtn = dialog.querySelector('.close-dialog-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        dialog.remove();
        style.remove();
      });
    }

    // 绑定复制命令按钮事件
    const copyBtn = dialog.querySelector('.copy-command-btn');
    if (copyBtn && command) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(command).then(() => {
          this.showSuccess('命令已复制到剪贴板');
          
          // 显示已复制的内容（调试用）
          console.log('已复制命令:', command);
        }).catch(err => {
          console.error('复制失败:', err);
          this.showError('复制命令失败，请手动复制');
        });
      });
    }
  }
}

// 注册自定义元素
customElements.define('settings-panel', SettingsPanel); 