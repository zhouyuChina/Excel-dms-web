import React from "react";
import { Layout } from "@/components/layout";

const Home: React.FC = () => {
  const [activeModule, setActiveModule] = React.useState("documents");

  return (
    <Layout
      title="企業資料管理系統"
      activeModule={activeModule}
      onModuleChange={setActiveModule}
    >
      {/* main 區域：後續在這裡掛載資料管理等具體業務模組 */}
      <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 text-gray-600 dark:text-gray-300">
        主內容區（將在此掛載資料管理模塊）。
      </div>
    </Layout>
  );
};

export default Home;
