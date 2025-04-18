import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { appWindow } from '@tauri-apps/api/window';
import './styles.css';
import ThemeManager from './theme-manager';

// 导入页面组件
import './components/icons';
import './components/main-layout';
import './components/header';
import './components/settings-panel';
import './components/log-files-panel';
import './components/log-entry-form';
// import './components/log-summary-panel'; // 注释掉有问题的组件
import './components/log-summary-fixed'; // 使用修复后的日志摘要面板
import './components/help-panel';

// 初始化应用
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化主题管理器
  ThemeManager.getInstance();
  
  // 创建主布局
  const app = document.querySelector('#app');
  if (app) {
    app.innerHTML = `<main-layout></main-layout>`;
  }

  // 设置事件监听器
  await setupEventListeners();
  
  console.log('应用初始化完成，使用修复后的日志摘要面板');
});

// 导航到指定页面
function navigateTo(page: string) {
  const mainLayout = document.querySelector('main-layout');
  if (mainLayout) {
    // @ts-ignore - 自定义元素属性
    mainLayout.activePage = page;
  }
}

// 监听导航事件
async function setupEventListeners() {
  try {
    await listen('navigate', (event) => {
      navigateTo(event.payload as string);
    });
  } catch (error) {
    console.error('设置事件监听失败:', error);
  }
}
