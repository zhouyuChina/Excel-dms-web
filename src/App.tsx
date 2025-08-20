import { Routes, Route } from "react-router-dom";
import Login from "@/pages/Login";
import Records from "@/pages/Records";
import ImportPage from "@/pages/Import";
import Home from "@/pages/Home";

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/records" element={<Records />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}
