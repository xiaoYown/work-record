/**
 * 主题管理器
 * 负责管理应用的主题和字体大小设置
 */

// 主题类型
export type ThemeMode = 'dark' | 'light' | 'neutral';

// 字体大小预设
export type FontSize = 'small' | 'medium' | 'large';

// 主题设置接口
export interface ThemeSettings {
  mode: ThemeMode;
  fontSize: FontSize;
}

// 字体大小映射（像素值）
const fontSizeMap = {
  small: 13,
  medium: 15,
  large: 17
};

// CSS变量名
const CSS_VARS = {
  // 颜色变量
  bgPrimary: '--bg-primary',
  bgSecondary: '--bg-secondary',
  bgElevated: '--bg-elevated',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  accent: '--accent',
  accentHover: '--accent-hover',
  border: '--border-color',
  divider: '--divider-color',
  success: '--success-color',
  error: '--error-color',
  navActive: '--nav-active-bg',
  inputBg: '--input-bg',
  
  // 字体大小变量
  fontBase: '--font-size-base',
  fontSm: '--font-size-sm',
  fontLg: '--font-size-lg',
  fontXl: '--font-size-xl',
  
  // 其他变量
  borderRadius: '--border-radius',
  shadowSm: '--shadow-sm',
  shadowMd: '--shadow-md',
  transition: '--transition-base',
};

// 主题颜色映射 - 优化为更接近Apple风格的配色
const themeColorMap = {
  dark: {
    // macOS暗色主题色值
    [CSS_VARS.bgPrimary]: '#1e1e1e',
    [CSS_VARS.bgSecondary]: '#2d2d2d',
    [CSS_VARS.bgElevated]: '#323232',
    [CSS_VARS.textPrimary]: '#ffffff',    // 更亮的主文本颜色
    [CSS_VARS.textSecondary]: '#ababab',  // 更亮的次要文本颜色
    [CSS_VARS.accent]: '#a084e8',         // 优雅的紫罗兰色
    [CSS_VARS.accentHover]: '#b39ddb',
    [CSS_VARS.border]: '#444444',
    [CSS_VARS.divider]: '#444444',
    [CSS_VARS.success]: '#32d74b',        // macOS绿色
    [CSS_VARS.error]: '#ff453a',          // macOS红色
    [CSS_VARS.navActive]: '#3a3a3a',
    [CSS_VARS.inputBg]: '#1c1c1e',
  },
  light: {
    // macOS亮色主题色值
    [CSS_VARS.bgPrimary]: '#ffffff',
    [CSS_VARS.bgSecondary]: '#f5f5f7',
    [CSS_VARS.bgElevated]: '#ffffff',
    [CSS_VARS.textPrimary]: '#1d1d1f',
    [CSS_VARS.textSecondary]: '#86868b',
    [CSS_VARS.accent]: '#7e57c2',         // 温暖的紫色
    [CSS_VARS.accentHover]: '#9575cd',
    [CSS_VARS.border]: '#d2d2d7',
    [CSS_VARS.divider]: '#e5e5e5',
    [CSS_VARS.success]: '#32cd32',
    [CSS_VARS.error]: '#ff3b30',
    [CSS_VARS.navActive]: '#e9e9e9',
    [CSS_VARS.inputBg]: '#ffffff',
  },
  neutral: {
    // macOS中性/灰色主题
    [CSS_VARS.bgPrimary]: '#f5f5f7',
    [CSS_VARS.bgSecondary]: '#e5e5ea',
    [CSS_VARS.bgElevated]: '#ffffff',
    [CSS_VARS.textPrimary]: '#1d1d1f',
    [CSS_VARS.textSecondary]: '#6e6e73',
    [CSS_VARS.accent]: '#6a5acd',         // 板岩蓝色
    [CSS_VARS.accentHover]: '#7b68ee',
    [CSS_VARS.border]: '#d2d2d7',
    [CSS_VARS.divider]: '#d2d2d7',
    [CSS_VARS.success]: '#34c759',
    [CSS_VARS.error]: '#ff3b30',
    [CSS_VARS.navActive]: '#d8d8dd',
    [CSS_VARS.inputBg]: '#ffffff',
  }
};

/**
 * 主题管理器类
 */
class ThemeManager {
  private static instance: ThemeManager;
  private settings: ThemeSettings = {
    mode: 'dark',
    fontSize: 'medium'
  };
  
  // 事件监听器
  private themeChangeListeners: Array<(settings: ThemeSettings) => void> = [];

  private constructor() {
    this.loadThemeSettings();
    this.applyTheme();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * 加载主题设置
   */
  private loadThemeSettings(): void {
    try {
      const savedSettings = localStorage.getItem('themeSettings');
      if (savedSettings) {
        this.settings = JSON.parse(savedSettings);
      } else {
        // 如果没有保存的设置，使用系统首选项
        this.settings.mode = this.getSystemPreferredTheme();
      }
    } catch (error) {
      console.error('加载主题设置失败:', error);
    }
  }

  /**
   * 获取系统首选主题
   */
  private getSystemPreferredTheme(): ThemeMode {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  /**
   * 保存主题设置
   */
  private saveThemeSettings(): void {
    try {
      localStorage.setItem('themeSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('保存主题设置失败:', error);
    }
  }

  /**
   * 应用主题设置到 CSS 变量
   */
  private applyTheme(): void {
    const root = document.documentElement;
    const { mode, fontSize } = this.settings;
    
    // 应用颜色主题
    const colors = themeColorMap[mode];
    Object.entries(colors).forEach(([variable, value]) => {
      root.style.setProperty(variable, value);
    });
    
    // 应用字体大小
    const baseFontSize = fontSizeMap[fontSize];
    root.style.setProperty(CSS_VARS.fontBase, `${baseFontSize}px`);
    root.style.setProperty(CSS_VARS.fontSm, `${baseFontSize - 2}px`);
    root.style.setProperty(CSS_VARS.fontLg, `${baseFontSize + 2}px`);
    root.style.setProperty(CSS_VARS.fontXl, `${baseFontSize + 4}px`);
    
    // 应用其他常量
    root.style.setProperty(CSS_VARS.borderRadius, '8px');  // 更大的圆角，更符合Apple风格
    root.style.setProperty(CSS_VARS.shadowSm, '0 2px 4px rgba(0, 0, 0, 0.06)');
    root.style.setProperty(CSS_VARS.shadowMd, '0 4px 12px rgba(0, 0, 0, 0.1)');
    root.style.setProperty(CSS_VARS.transition, '0.2s cubic-bezier(0.4, 0, 0.2, 1)');
    
    // 通知所有监听器
    this.notifyListeners();
  }
  
  /**
   * 通知所有主题变更监听器
   */
  private notifyListeners(): void {
    this.themeChangeListeners.forEach(listener => {
      listener(this.settings);
    });
  }

  /**
   * 获取当前主题设置
   */
  public getThemeSettings(): ThemeSettings {
    return { ...this.settings };
  }

  /**
   * 设置主题模式
   */
  public setThemeMode(mode: ThemeMode): void {
    if (this.settings.mode !== mode) {
      this.settings.mode = mode;
      this.saveThemeSettings();
      this.applyTheme();
    }
  }

  /**
   * 设置字体大小
   */
  public setFontSize(size: FontSize): void {
    if (this.settings.fontSize !== size) {
      this.settings.fontSize = size;
      this.saveThemeSettings();
      this.applyTheme();
    }
  }

  /**
   * 切换到下一个主题
   */
  public toggleTheme(): void {
    const themes: ThemeMode[] = ['dark', 'light', 'neutral'];
    const currentIndex = themes.indexOf(this.settings.mode);
    const nextIndex = (currentIndex + 1) % themes.length;
    this.setThemeMode(themes[nextIndex]);
  }
  
  /**
   * 添加主题变更监听器
   */
  public addThemeChangeListener(listener: (settings: ThemeSettings) => void): void {
    this.themeChangeListeners.push(listener);
  }
  
  /**
   * 移除主题变更监听器
   */
  public removeThemeChangeListener(listener: (settings: ThemeSettings) => void): void {
    this.themeChangeListeners = this.themeChangeListeners.filter(l => l !== listener);
  }
}

export default ThemeManager; 