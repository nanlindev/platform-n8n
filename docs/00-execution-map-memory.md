# Execution Map — job memory

**更新：** 2026-11-05（U8 远程已升 2.46.4）  
**钉版本：** `n8nio/n8n:2.46.4`（本地 + 远程）  
**真源：** [PRD](./EXECUTION_MAP_PRD.md) · [M1 Spike](./EXECUTION_MAP_SPIKE.md) · 应用 [`../execution-map/`](../execution-map/)

## 耐久决定

| 决定 | 内容 |
|------|------|
| 范围 | 仅 Nan 本地 / Nan 远程 `platform-n8n`；不碰 Salah/客户实例 |
| 形态 | 旁路小应用 `execution-map/`（Vite+React+React Flow）；不 fork n8n；不读 Jaeger |
| M1 | **2026-10-20 通过** |
| M2 | **2026-10-20 MVP 可用**：列表 + tag/名筛 + 全图画布 + I/O + 深链 |
| 拼图 | 主：`parentExecution` + 父节点 `subExecution` / `run.error.executionId`；correlation_id 链仍属 M3 |
| 黄灯 | continue 后常仍 `executionStatus=success`，看输出 `json.error` / `run.error` |
| 红样 | **2026-11-04**：`zz-smoke parent` 1182 → `zz-smoke child` 1183（Hard Fail Code）；截图 `upgrade-baseline/u5-red-parent-child-1182.png` |
| 黄样 | **2026-11-04**：`zz-smoke yellow` 1179（原 1133 已不在）；截图 `upgrade-baseline/u5-yellow-1179.png` |
| CRM 链样 | **2026-11-04 U6**：Intake **1187** → Enrichment 1188/1190 → CRM Sync 1189/1193；截图 `upgrade-baseline/u6-crm-parent-child-1187.png` |
| 深链 | `{base}/workflow/{workflowId}/executions/{executionId}` |
| API Key | 本地 `.env`（gitignore）+ n8n label `execution-map-m2`；勿提交密钥 |
| 2.46 注意 | Execute Sub-workflow 目标 WF 须 **published**（`workflow_published_version`）；未发布时 API 报 “not active” |

## 怎么跑

```bash
cd platform-n8n/execution-map
cp .env.example .env   # 填 N8N_API_KEY
npm install && npm run dev   # http://127.0.0.1:5179
```

## 当前步

- **升级轨：** U0–U9 已完成（钉 2.46.4 本地+远程）  
- **可选：** 本机 ExecMap 切远程 `.env` 抽查一条执行  
- **未做：** 像素编辑器、多租户、M3 correlation_id 树折叠  
