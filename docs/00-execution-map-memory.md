# Execution Map — job memory

**更新：** 2026-10-20（M2 MVP 落地）  
**钉版本：** `n8nio/n8n:2.28.7`  
**真源：** [PRD](./EXECUTION_MAP_PRD.md) · [M1 Spike](./EXECUTION_MAP_SPIKE.md) · 应用 [`../execution-map/`](../execution-map/)

## 耐久决定

| 决定 | 内容 |
|------|------|
| 范围 | 仅 Nan 本地 / Nan 远程 `platform-n8n`；不碰 Salah/客户实例 |
| 形态 | 旁路小应用 `execution-map/`（Vite+React+React Flow）；不 fork n8n；不读 Jaeger |
| M1 | **2026-10-20 通过** |
| M2 | **2026-10-20 MVP 可用**：列表 + tag/名筛 + 全图画布 + I/O + 深链 |
| 拼图 | 主：`parentExecution` + 父节点 `subExecution`；correlation_id 链仍属 M3 |
| 黄灯 | continue 后常仍 `executionStatus=success`，看输出 `json.error` / `run.error` |
| 深链 | `{base}/workflow/{workflowId}/executions/{executionId}` |
| API Key | 本地 `.env`（gitignore）+ n8n label `execution-map-m2`；勿提交密钥 |

## 怎么跑

```bash
cd platform-n8n/execution-map
cp .env.example .env   # 填 N8N_API_KEY
npm install && npm run dev   # http://127.0.0.1:5179
```

## 当前步

- **下一步（可选）：** 现网硬失败红样验收；M3 correlation_id / 列表树折叠  
- **未做：** 像素编辑器、升级离 2.28.7、多租户
