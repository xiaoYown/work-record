/**
 * 主布局组件，负责管理应用的整体结构和页面切换
 */
import ThemeManager, { ThemeMode, FontSize } from '../theme-manager';
import { createIcon } from './icons';

class MainLayout extends HTMLElement {
  private _activePage: string = 'log-files';
  private themeManager: ThemeManager;
  // 保存监听器引用以便正确移除
  private themeChangeListener: (settings: any) => void;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.themeManager = ThemeManager.getInstance();
    
    // 创建监听器引用
    this.themeChangeListener = () => {
      this.updateThemeClasses();
    };
  }

  connectedCallback() {
    this.render();
    
    // 监听主题变更
    this.themeManager.addThemeChangeListener(this.themeChangeListener);
  }

  disconnectedCallback() {
    // 清理主题监听器
    this.themeManager.removeThemeChangeListener(this.themeChangeListener);
  }

  /**
   * 获取当前活动页面
   */
  get activePage(): string {
    return this._activePage;
  }

  /**
   * 设置当前活动页面并更新视图
   */
  set activePage(value: string) {
    this._activePage = value;
    this.updateActiveContent();
  }

  /**
   * 更新当前活动内容
   */
  private updateActiveContent() {
    if (!this.shadowRoot) return;

    // 获取所有内容面板
    const panels = this.shadowRoot.querySelectorAll('.content-panel');
    
    // 隐藏所有面板
    panels.forEach(panel => {
      panel.classList.remove('active');
    });

    // 激活当前面板
    const activePanel = this.shadowRoot.querySelector(`.content-panel[data-page="${this._activePage}"]`);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    // 更新导航菜单高亮
    const navItems = this.shadowRoot.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      const page = item.getAttribute('data-page');
      if (page === this._activePage) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * 更新主题相关的类
   */
  private updateThemeClasses() {
    if (!this.shadowRoot) return;
    
    const settings = this.themeManager.getThemeSettings();
    const container = this.shadowRoot.querySelector('.container');
    
    if (container) {
      // 更新主题模式类
      container.classList.remove('theme-dark', 'theme-light', 'theme-neutral');
      container.classList.add(`theme-${settings.mode}`);
      
      // 更新字体大小类
      container.classList.remove('font-small', 'font-medium', 'font-large');
      container.classList.add(`font-${settings.fontSize}`);
    }
  }

  /**
   * 处理导航点击事件
   */
  private handleNavClick(e: Event) {
    const target = e.currentTarget as HTMLElement;
    const page = target.getAttribute('data-page');
    if (page) {
      this.activePage = page;
    }
  }

  /**
   * 切换主题
   */
  private handleThemeToggle() {
    this.themeManager.toggleTheme();
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
          height: 100vh;
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Icons', 
                     'Helvetica Neue', 'Helvetica', 'Arial', sans-serif;
        }

        .container {
          display: grid;
          grid-template-rows: auto 1fr;
          grid-template-columns: 230px 1fr;
          height: 100%;
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }

        .header {
          grid-column: 1 / 3;
          grid-row: 1;
          background-color: var(--bg-elevated);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          padding: 0 16px;
          height: 48px;
          -webkit-app-region: drag; /* 允许拖拽窗口 */
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }

        .sidebar {
          grid-column: 1;
          grid-row: 2;
          background-color: var(--bg-secondary);
          border-right: 1px solid var(--border-color);
          overflow-y: auto;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding-top: 16px;
          /* 磨砂玻璃效果 - 类似macOS Sidebar */
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .content {
          grid-column: 2;
          grid-row: 2;
          background-color: var(--bg-primary);
          padding: 24px 24px 32px 24px;
          overflow-y: auto;
        }

        .nav-menu {
          list-style: none;
          padding: 0;
          margin: 0 12px;
        }
        
        /* 侧边栏分组 - Apple风格 */
        .nav-group {
          margin-bottom: 24px;
        }
        
        .nav-group-title {
          font-size: var(--font-size-sm);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          padding: 0 16px;
          margin: 0 0 8px 0;
          font-weight: 600;
        }

        .nav-item {
          padding: 10px 16px;
          margin-bottom: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          color: var(--text-primary);
          font-size: var(--font-size-base);
          font-weight: 400;
          border-radius: var(--border-radius);
          transition: all var(--transition-base);
        }
        
        .nav-item-icon {
          margin-right: 12px;
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.9;
        }

        .nav-item:hover {
          background-color: var(--nav-active-bg);
        }

        .nav-item.active {
          background-color: var(--accent);
          color: white;
          font-weight: 500;
        }

        .content-panel {
          display: none;
          height: 100%;
        }

        .content-panel.active {
          display: block;
        }

        .theme-controls {
          margin-top: auto;
          padding: 20px 16px 28px 16px;
          border-top: 1px solid var(--border-color);
        }

        .theme-toggle {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          background-color: var(--bg-elevated);
          border-radius: var(--border-radius);
          cursor: pointer;
          font-size: var(--font-size-sm);
          color: var(--text-primary);
          transition: all var(--transition-base);
          box-shadow: var(--shadow-sm);
          margin-bottom: 14px;
        }

        .theme-toggle:hover {
          background-color: var(--nav-active-bg);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
        
        .theme-toggle:active {
          transform: translateY(0);
        }

        .theme-icon {
          margin-right: 8px;
          font-size: 16px;
        }
        
        /* 字体大小控制 */
        .font-controls {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }
        
        .font-size-btn {
          flex: 1;
          text-align: center;
          padding: 8px 0;
          background-color: var(--bg-elevated);
          border-radius: var(--border-radius);
          cursor: pointer;
          font-size: var(--font-size-sm);
          color: var(--text-secondary);
          transition: all var(--transition-base);
          box-shadow: var(--shadow-sm);
        }
        
        .font-size-btn:hover {
          background-color: var(--nav-active-bg);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
        
        .font-size-btn:active {
          transform: translateY(0);
        }
        
        .font-size-btn.active {
          background-color: var(--accent);
          color: white;
        }
      </style>

      <div class="container theme-${this.themeManager.getThemeSettings().mode} font-${this.themeManager.getThemeSettings().fontSize}">
        <div class="header">
          <app-header></app-header>
        </div>
        
        <div class="sidebar">
          <div class="nav-group">
            <h3 class="nav-group-title">工作记录</h3>
            <ul class="nav-menu">
              <li class="nav-item active" data-page="log-files">
                <span class="nav-item-icon">
                  <app-icon name="files" size="18"></app-icon>
                </span>
                日志文件
              </li>
              <li class="nav-item" data-page="log-summary">
                <span class="nav-item-icon">
                  <app-icon name="summary" size="18"></app-icon>
                </span>
                日志生成
              </li>
            </ul>
          </div>
          
          <div class="nav-group">
            <h3 class="nav-group-title">应用</h3>
            <ul class="nav-menu">
              <li class="nav-item" data-page="settings">
                <span class="nav-item-icon">
                  <app-icon name="settings" size="18"></app-icon>
                </span>
                设置
              </li>
              <li class="nav-item" data-page="help">
                <span class="nav-item-icon">
                  <app-icon name="help" size="18"></app-icon>
                </span>
                使用说明
              </li>
            </ul>
          </div>
          
          <div class="theme-controls">
            <div class="theme-toggle" id="theme-toggle">
              <span class="theme-icon">
                <app-icon name="theme" size="18"></app-icon>
              </span>
              <span class="theme-label">切换主题</span>
            </div>
            
            <div class="font-controls">
              <div class="font-size-btn" data-size="small">小</div>
              <div class="font-size-btn" data-size="medium">中</div>
              <div class="font-size-btn" data-size="large">大</div>
            </div>
          </div>
        </div>
        
        <div class="content">
          <div class="content-panel active" data-page="log-files">
            <log-files-panel></log-files-panel>
          </div>
          <div class="content-panel" data-page="log-summary">
            <log-summary-panel></log-summary-panel>
          </div>
          <div class="content-panel" data-page="settings">
            <settings-panel></settings-panel>
          </div>
          <div class="content-panel" data-page="help">
            <help-panel></help-panel>
          </div>
        </div>
      </div>
    `;

    // 绑定导航点击事件
    const navItems = this.shadowRoot.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', this.handleNavClick.bind(this));
    });

    // 绑定主题切换事件
    const themeToggle = this.shadowRoot.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', this.handleThemeToggle.bind(this));
    }
    
    // 绑定字体大小切换事件
    const fontSizeBtns = this.shadowRoot.querySelectorAll('.font-size-btn');
    fontSizeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const size = target.getAttribute('data-size') as FontSize;
        if (size) {
          this.themeManager.setFontSize(size);
          
          // 更新按钮高亮状态
          fontSizeBtns.forEach(b => b.classList.remove('active'));
          target.classList.add('active');
        }
      });
      
      // 设置当前字体大小按钮的高亮状态
      const size = btn.getAttribute('data-size');
      if (size === this.themeManager.getThemeSettings().fontSize) {
        btn.classList.add('active');
      }
    });

    // 初始化活动内容
    this.updateActiveContent();
    this.updateThemeClasses();
  }
}

// 注册自定义元素
customElements.define('main-layout', MainLayout); 