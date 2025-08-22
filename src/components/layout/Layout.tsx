import React, { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';

interface LayoutProps {
  children: ReactNode;
  title: string;
  activeModule: string;
  onModuleChange: (module: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  activeModule,
  onModuleChange,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  return (
    <div className="flex flex-col h-screen dark:bg-gray-900">
      {/* 顶部 Header */}
      <Header title={title} />

      {/* 中间内容区域 - 侧边栏 + 主内容 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧边栏 */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeModule={activeModule}
          onModuleChange={onModuleChange}
        />

        {/* 右侧主内容区域 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 主内容 */}
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>

      {/* 底部 Footer */}
      <Footer />
    </div>
  );
};
