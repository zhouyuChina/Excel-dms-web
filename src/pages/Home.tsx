import React from "react";
import { Layout } from "@/components/layout";
import { DataManagementPage } from "@/components/business/data-management/DataManagementPage";

const Home: React.FC = () => {
  const [activeModule, setActiveModule] = React.useState("data-management");

  return (
    <Layout
      title="企業資料管理系統"
      activeModule={activeModule}
      onModuleChange={setActiveModule}
    >
      {activeModule === "data-management" && <DataManagementPage />}
    </Layout>
  );
};

export default Home;
