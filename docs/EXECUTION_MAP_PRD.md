# PRD — n8n 全流程执行图（Execution Map）

**状态：** Draft（**M1 spike + M2 MVP 2026-10-20**；硬失败红样待现网补验）  
**日期：** 2026-10-19（spike/M2：2026-10-20）  
**钉版本：** `n8nio/n8n:2.28.7`（本地 + Nan 远程 `platform-n8n`）  
**受众：** 自用 + 作品展示；非多租户产品  
**Spike 真源：** [`EXECUTION_MAP_SPIKE.md`](./EXECUTION_MAP_SPIKE.md)

---

## 1. 一句话

在自定义入口里列出实例上的完整业务执行，按 **Workflow tag** 筛选，点开后看到**一张跨 WF 只读全流程图**（实线=节点边，虚线=父子 WF），节点近原生、带 I/O、红/黄/绿标色；数据只读 n8n，解耦 Jaeger。

## 2. 为什么做

官方 All Executions 是**扁列表**（一行一次 execution，父子不分组）；画布内仅有点对点 **View sub-execution**。没有：可筛的逻辑全链视图、continueOnFail **黄灯**、一张图看完多 WF。社区仍在要 Hierarchical Execution History（2026-03）——官方未交付我们要的体验。

## 3. 用户旅程（MVP）

1. 打开旁路入口（独立小站 / 侧栏链到自托管 UI）。
2. 看到**完整执行列表**（以根/入口执行为主；子执行可折进详情树）。
3. 用 **WF tag** 筛选；无 tag 时用**入口 WF 名**。
4. 点一行 → 全图画布：同 WF 内 **实线**；跨父子 WF **虚线**。
5. 点节点 → I/O 面板（默认截断，可展开）；绿/黄/红/灰。
6. 「在 n8n 中打开」→ 深链官方该 execution。

## 4. 功能范围

| In | Out |
|----|-----|
| 只读列表 + WF tag 筛 + 入口 WF 名 | 编辑 WF / 重跑（可链到官方） |
| 官方 `executionId` + `parentExecution` 拼树 | 像素级复刻 n8n 编辑器 |
| 无原生父子时：`customData.correlation_id` JOIN | 依赖 Jaeger / OTel |
| 黄=实际出错且 continue 的节点 | 靠节点命名后缀 / 业务 JSON 嗅探降级 |
| 按需 `includeData` + I/O 截断 | 客户/Salah 实例；多租户 SaaS |
| 钉 2.28.7 | 为做地图先大版本升级 |

## 5. 拼图键

1. **主路径：** 官方父子元数据（Execute Sub-workflow）。
2. **回退：** 同 `correlation_id`（HTTP/Webhook 链）；能改成 Sub-workflow 的优先改。
3. **皆无：** 只画单 WF，标明未关联。

列表筛选用 **Workflow tags**；拼图**不靠** tag。

## 6. 颜色语义

| 色 | 含义 |
|----|------|
| 绿 | 节点成功 |
| 黄 | 节点曾 error / error 输出，但执行继续（continueOnFail / `onError: continueRegularOutput` 等）。**2.28.7 实测：** continue 后节点 `executionStatus` 常仍为 `success`，错误在输出 `json.error`，不一定有 `run.error` — 见 spike §4 |
| 红 | 硬失败（未 continue / execution failed） |
| 灰 | 未执行到 |

不单独识别「降级处理节点」；可接受汇合下游偶发偏黄。

## 7. 技术草图

- **形态：** 旁路只读应用（建议 React Flow 类画布）；读 n8n Public API 和/或 Postgres；不 fork n8n 核心。
- **列表：** `GET /executions`（`includeData=false`）+ workflows（tags）。
- **详情：** 相关 execution `includeData=true` → `runData` + connections → 图。
- **部署：** 仅 Nan 本地 / Nan 远程；与 `platform-n8n` 同网或配 API Key。

```text
[List UI] --tag/name--> [API: executions + workflows]
                              |
[Map UI] <-- tree(parentExecution | correlation_id) + runData
                              |
                     deep link --> n8n editor execution
```

## 8. 验收（MVP）

- [x] 自定义入口可见近期执行；WF tag 可筛；无 tag 可用入口 WF 名。（`execution-map/` 列表页）
- [x] Execute Sub-workflow 链：一张图含父子，虚线区分关系。（`parentExecution` + `subExecution` → React Flow）
- [x] 人为 continueOnFail：出错节点黄、整体 success 仍可见。（色启发式按 spike §4；fixture exec `1133` 可点验）
- [ ] 硬失败节点/单红。（库内暂无 error execution；启发式已实现，待现网样例）
- [x] 节点可看截断 I/O；可深链官方 execution。
- [x] 不请求 Jaeger；断 OTel 不影响地图。
- [x] 钉在 2.28.7 文档与 compose 一致。

## 9. 里程碑

| 步 | 内容 |
|----|------|
| M0 | 本文 PRD（本文件） |
| M1 | Spike：2.28.7 API 拉列表/详情、`parentExecution`、tags、黄灯判定样例 |
| M2 | MVP UI：列表 + 画布 + I/O + 深链 |
| M3 | （可选）correlation_id 链、列表树折叠、展示抛光 |

## 10. 风险

- 大 `runData` → 必须截断/按需。
- HTTP 链无 parent → 依赖 correlation 纪律或单 WF 降级。
- 官方日后出层级列表 → 自用仍可留黄灯+全图画布；不赌官方时间表。
- `GET /workflows` 默认带全量 nodes（spike：50 条约 1 MB）→ 列表侧需缓存/瘦客户端字段。

---

## 附录 A — M1 Spike 摘要（2026-10-20）

全文见 [`EXECUTION_MAP_SPIKE.md`](./EXECUTION_MAP_SPIKE.md)。要点：

1. Public API 可读；需 API Key（scopes：execution/workflow/tag 只读）。
2. 父子：子 `data.parentExecution`；父 Execute 节点 `metadata.subExecution`（CRM 链 1128→1129→1130 已验）。
3. 黄灯：continue 后多为 `execution.status=success` + 输出 `json.error`，勿只认 `executionStatus=error`。
4. 深链：`{base}/workflow/{workflowId}/executions/{executionId}`。
5. **闸门通过，可进 M2。**
