/**
 * 应用头部组件
 */
import { createIcon } from './icons';

class AppHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  /**
   * 处理添加日志按钮点击
   */
  private handleAddLogClick() {
    // 使用 Tauri API 打开快速添加日志窗口
    // @ts-ignore - Tauri API
    if (window.__TAURI__) {
      // @ts-ignore - Tauri API
      const { invoke } = window.__TAURI__.core;
      invoke('show_quick_entry');
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
          display: flex;
          width: 100%;
          justify-content: space-between;
          align-items: center;
        }

        .app-title {
          font-size: var(--font-size-base);
          font-weight: 500;
          margin: 0;
          color: var(--text-primary);
        }

        .actions {
          display: flex;
          gap: 10px;
        }

        button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background-color: var(--accent);
          color: white;
          border: none;
          border-radius: var(--border-radius);
          padding: 6px 12px;
          cursor: pointer;
          font-size: var(--font-size-sm);
          font-weight: 500;
          transition: all var(--transition-base);
        }

        button:hover {
          background-color: var(--accent-hover);
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }

        button:active {
          transform: scale(0.98) translateY(0);
        }

        .icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        /* 标题栏中间显示应用名称 */
        .titlebar-center {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          -webkit-app-region: drag;
          pointer-events: none;
        }
        
        /* 标题栏文本 */
        .app-title {
          font-size: var(--font-size-base);
          font-weight: 500;
          color: var(--text-primary);
          margin: 0;
        }
      </style>
      
      <div class="titlebar-center">
        <h1 class="app-title">工作日志记录</h1>
      </div>
      
      <div class="actions">
        <button id="add-log-btn">
          <app-icon name="add" size="16"></app-icon>
          添加日志
        </button>
      </div>
    `;

    // 绑定添加日志事件
    const addLogBtn = this.shadowRoot.getElementById('add-log-btn');
    if (addLogBtn) {
      addLogBtn.addEventListener('click', this.handleAddLogClick.bind(this));
    }
  }
}

// 注册自定义元素
customElements.define('app-header', AppHeader); 