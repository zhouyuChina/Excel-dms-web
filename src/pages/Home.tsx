import React from "react";
import { Layout } from "@/components/layout";
import { DataManagementPage } from "@/components/business/data-management/DataManagementPage";
import { ExportCenterPage } from "@/components/business/export/ExportCenterPage";
import { ImportRecordsPage } from "@/components/business/import/ImportRecordsPage";
import { FieldManagementPage } from "@/components/business/field/FieldManagementPage";
import { BackupRestorePage } from "@/components/business/backup/BackupRestorePage";
import { InvalidQuarantinePage } from "@/components/business/validation/InvalidQuarantinePage";
import { AuditLogsPage } from "@/components/business/audit/AuditLogsPage";
import { TaskCenterPage } from "@/components/business/tasks/TaskCenterPage";
import { Navigate } from "react-router-dom";
import { OPEN_MODULE_EVENT } from "@/lib/dmsApi";

const Home: React.FC = () => {
  const [activeModule, setActiveModule] = React.useState("data-management");
  const token = localStorage.getItem("token");
  const role = (localStorage.getItem("userRole") || "viewer") as "admin" | "editor" | "viewer";
  const isAdmin = role === "admin";

  const guardedModule =
    !isAdmin && (activeModule === "backup-restore" || activeModule === "audit-logs")
      ? "data-management"
      : activeModule;

  if (!token) return <Navigate to="/login" replace />;

  React.useEffect(() => {
    const onOpenModule = (event: Event) => {
      const detail = (event as CustomEvent<{ module?: string }>).detail;
      if (!detail?.module) return;
      setActiveModule(detail.module);
    };
    window.addEventListener(OPEN_MODULE_EVENT, onOpenModule as EventListener);
    return () => window.removeEventListener(OPEN_MODULE_EVENT, onOpenModule as EventListener);
  }, []);

  return (
    <Layout
      title="EXSELL DMS"
      activeModule={guardedModule}
      onModuleChange={setActiveModule}
    >
      {guardedModule === "data-management" && <DataManagementPage />}
      {guardedModule === "export-center" && <ExportCenterPage />}
      {guardedModule === "import-records" && <ImportRecordsPage />}
      {guardedModule === "field-management" && <FieldManagementPage />}
      {guardedModule === "audit-logs" && <AuditLogsPage />}
      {guardedModule === "backup-restore" && <BackupRestorePage />}
      {guardedModule === "invalid-quarantine" && <InvalidQuarantinePage />}
      {guardedModule === "task-center" && <TaskCenterPage />}
    </Layout>
  );
};

export default Home;
