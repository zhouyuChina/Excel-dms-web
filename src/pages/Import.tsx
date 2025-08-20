import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<any>(null);

  const uploadToS3 = async () => {
    if (!file) return toast.warning("请选择文件");
    const key = `imports/${Date.now()}-${file.name}`;
    // 1) 请求预签名 URL
    const res = await fetch(`/api/files/presign-put?key=${encodeURIComponent(key)}&contentType=${encodeURIComponent(file.type || "application/octet-stream")}`);
    if (!res.ok) return toast.error("获取预签名 URL 失败");
    const { url } = await res.json();
    // 2) PUT 上传到 S3
    const put = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
    if (!put.ok) return toast.error("上传失败");
    // 3) 创建导入作业
    const create = await fetch("/api/imports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileKey: key, mapping: {} })
    });
    const jobInfo = await create.json();
    setJob(jobInfo);
    toast.success("导入作业已创建");
  };

  return (
    <Card>
      <CardHeader><CardTitle>导入数据</CardTitle></CardHeader>
      <CardContent className="space-y-3 max-w-xl">
        <div className="flex items-center gap-2">
          <Input readOnly value={file?.name || ""} placeholder="选择文件后显示文件名" />
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <Button onClick={uploadToS3}>上传并创建作业</Button>
        {job && <div>作业已创建：ID = {job.id}，状态 = {job.status}</div>}
      </CardContent>
    </Card>
  );
}
