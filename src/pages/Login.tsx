import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Mock 数据 - 默认账号密码
  const mockUsers = [
    { username: "admin", password: "admin123", role: "管理员" },
    { username: "user", password: "user123", role: "普通用户" }
  ];
  
  const useMockData = true; // 开关，控制是否使用mock数据

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 使用 mock 数据进行验证
      if (useMockData) {
        const matchedUser = mockUsers.find(
          user => user.username === username && user.password === password
        );
        
        if (matchedUser) {
          // 模拟生成token并存储
          const mockToken = `mock_token_${matchedUser.username}_${Date.now()}`;
          localStorage.setItem("token", mockToken);
          localStorage.setItem("userRole", matchedUser.role);
          toast.success(`登录成功，欢迎 ${matchedUser.role}！`);
          nav("/home");
        } else {
          throw new Error("用户名或密码错误");
        }
      } else {
        // 原有的API调用逻辑
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        toast.success("登录成功");
        nav("/home");
      }
    } catch (err: any) {
      toast.error(err?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">企业资料管理系统</h1>
          <p className="text-gray-600 dark:text-gray-400">Powered by Excel - Enterprise Data Management</p>
        </div>
        <Card className="shadow-lg border-0 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-gray-800 to-gray-900 text-white">
            <CardTitle className="text-xl font-semibold">用户登录</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form className="space-y-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-700 dark:text-gray-300">用户名</Label>
                <Input 
                  id="username" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  placeholder="请输入用户名"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 dark:text-gray-300">密码</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  placeholder="请输入密码"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-all"
                />
              </div>
              <Button 
                className="w-full py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-md hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all"
                type="submit" 
                disabled={loading}
              >
                {loading ? "登录中..." : "登录"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
