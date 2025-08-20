# dms-web (shadcn/ui + Vite + Tailwind)

使用 React + Vite + **shadcn/ui**（Tailwind + Radix）构建的前端应用。对接 dms-api 提供的 BFF 接口。

- 路由：/login, /records, /import
- Dev 代理：/api → http://localhost:8080
- UI：本地组件（`src/components/ui/*`），可继续用 `npx shadcn-ui add xxx` 扩展

## 环境
- Node.js 20 LTS
- 包管理器：npm

## 安装与启动
```bash
npm install
npm run dev
```
打开 http://localhost:5173

## 构建与预览
```bash
npm run build
npm run preview
```

## 本地对接 dms-core（可选）
在 dms-core 仓库：
```bash
npm link
```
在本仓库：
```bash
npm link @your-scope/dms-core
```

## 使用 shadcn/ui CLI（可选）
该模板已包含 `components.json`，你可以直接：
```bash
npx shadcn-ui@latest add button
# 或添加 dialog/card/input 等组件
```

## 注意
- 开发阶段，Vite 代理会把 `/api` 转发到 `http://localhost:8080`。
- 生产环境请通过 Nginx 反代 / 部署静态资源到 /var/www/dms-web。
