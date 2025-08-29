import React from "react";
import { Layout } from "@/components/layout";
import { DataManagementPage } from "@/components/business/data-management/DataManagementPage";
import { ExportCenterPage } from "@/components/business/export/ExportCenterPage";
import { ImportRecordsPage } from "@/components/business/import/ImportRecordsPage";
import { FieldManagementPage } from "@/components/business/field/FieldManagementPage";
import { StatisticalAnalysisPage } from "@/components/business/statistics/StatisticalAnalysisPage";
import { BackupRestorePage } from "@/components/business/backup/BackupRestorePage";
import { DocumentCenterPage } from "@/components/business/document/DocumentCenterPage";
import { DataValidationPage } from "@/components/business/validation/DataValidationPage";

const Home: React.FC = () => {
  const [activeModule, setActiveModule] = React.useState("data-management");

  return (
    <Layout
      title="企業資料管理系統"
      activeModule={activeModule}
      onModuleChange={setActiveModule}
    >
      {activeModule === "data-management" && <DataManagementPage />}
      {activeModule === "export-center" && <ExportCenterPage />}
      {activeModule === "import-records" && <ImportRecordsPage />}
      {activeModule === "field-management" && <FieldManagementPage />}
      {activeModule === "statistical-analysis" && <StatisticalAnalysisPage />}
      {activeModule === "backup-restore" && <BackupRestorePage />}
      {activeModule === "document-center" && <DocumentCenterPage />}
      {activeModule === "data-validation" && <DataValidationPage />}
    </Layout>
  );
};

export default Home;
