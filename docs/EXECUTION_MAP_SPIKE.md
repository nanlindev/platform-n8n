# Execution Map — M1 Spike（2.28.7）

**日期：** 2026-10-20  
**实例：** 本地 `platform-n8n` → `n8nio/n8n:2.28.7`（`http://127.0.0.1:5678`）  
**闸门结论：** **通过 → 可开 M2**（父子字段符合预期；黄灯判定需按下方启发式，勿只看 `executionStatus=error`）

---

## 1. API 权限

| 项 | 结果 |
|----|------|
| 认证 | Public API：`X-N8N-API-KEY`（JWT，`aud=public-api`） |
| 实例现状 | spike 前 **0** 把 API Key；M2 需在 Settings → API 新建一把只读键 |
| 最小 scopes | `execution:list` `execution:read` `workflow:list` `workflow:read` `tag:list` `tag:read` `workflowTags:list` |
| 说明 | Spike 用临时键验证后已 **删除**；勿把密钥写进仓库 |

---

## 2. 列表 + tags 筛

| 调用 | 观测 |
|------|------|
| `GET /api/v1/executions?limit=20`（默认无 data） | HTTP 200；~4.7 KB / 20 条；字段含 `id,status,mode,workflowId,startedAt,stoppedAt,finished`；**无** `parentExecution` / tags / WF 名 |
| `GET /api/v1/tags` | HTTP 200；~1.3 KB；可做筛选项芯片 |
| `GET /api/v1/workflows?limit=50` | HTTP 200；**~1.0 MB**（含完整 `nodes`/`connections`） |
| `GET /api/v1/workflows?tags=crm-workflow&limit=50&excludePinnedData=true` | HTTP 200；仍 **~655 KB**（`excludePinnedData` 不够瘦） |

**列表拼装（可行）：** executions（轻）JOIN workflows（取 `id→name,tags`）。  
**M2 注意：** workflows 列表 payload 偏肥 → 启动时拉一次缓存，或按 tag 分页；勿每屏全量重拉。筛选用 **Workflow tags**（已验证：`crm-workflow` / `ecom-workflow` / `doc-workflow` 等）。

---

## 3. 父子树（`parentExecution` / `subExecution`）

真实样例（CRM Execute Sub-workflow 链，2026-10-19）：

```text
1128  B2B Lead Intake              mode=webhook     parent=∅
  │   runData["Execute Enrichment Scoring"].metadata.subExecution
  │     → { executionId: "1129", workflowId: "9zFyIH4vLMDtKPyB" }
  ▼
1129  B2B Lead Enrichment Scoring  mode=integrated  data.parentExecution.executionId=1128
  │   runData["Execute CRM Sync"].metadata.subExecution → 1130
  ▼
1130  B2B Lead CRM Sync            mode=integrated  data.parentExecution.executionId=1129
```

| 字段 | 位置（`includeData=true`） | 用途 |
|------|---------------------------|------|
| `data.parentExecution` | 子 execution 根上 | `{ executionId, workflowId, shouldResume, executionContext }` → **向上**拼树 |
| `runData[node].metadata.subExecution` | 父里 Execute Workflow 节点 | `{ executionId, workflowId }` → **向下**找子 |
| `customData.correlation_id` | 部分 execution 顶层 | HTTP 链回退（本链上也有，但原生父子已够） |

**列表响应不含父子元数据** → 必须对相关 id `GET /executions/{id}?includeData=true`。

闸门：**与 PRD 主路径一致，无需改拼图键。**

---

## 4. 绿 / 黄 / 红（含 continueOnFail）

### 4.1 绿（现网）

exec `1128` 等：`runData[*].executionStatus === "success"` 且无 `error`、输出非错误形。

### 4.2 黄（人工 fixture → 已删 WF，exec `1133` 可能仍留库）

临时 WF：Webhook → Code `throw` + `onError: continueRegularOutput` + `continueOnFail: true` → Set。

| 层 | 实际值 |
|----|--------|
| `execution.status` | **`success`**（整体仍成功） |
| Fail Soft `executionStatus` | **`success`**（不是 `error`！） |
| Fail Soft `error` 字段 | **不存在** |
| Fail Soft 输出 | `json: { "error": "spike_intentional_fail [line 1]" }` |
| 下游 After Fail | 仍执行，`{ ok: "continued" }` |

**M2 黄灯启发式（2.28.7）：**

```text
黄 = 节点已跑到，且满足任一：
  (A) run.error 存在，但 execution.status 仍为 success（或同 WF 后续节点继续）
  (B) 主输出 item.json 含可识别的 error 形（如 string/object 字段 "error"），
      且该节点配置/语义为 continue（continueOnFail / onError=continue*）
红 = execution.status ∈ {error,crashed} 或节点硬失败且未 continue
灰 = 不在 runData
绿 = success 且无上述黄信号
```

勿只写 `executionStatus === 'error'`，在 `continueRegularOutput` 下会漏黄。

现网业务 WF 多用 `onError`，库内几乎无历史黄样例 → M2 验收需再留一小 fixture 或保留 `1133`。

### 4.3 红

当前库内 **无** `status=error` 的 execution；硬失败路径留 M2 人为造一条即可。

---

## 5. Payload 体积

| 资源 | 体量（本机） |
|------|----------------|
| executions 列表 ×20 | ~5 KB |
| tags | ~1 KB |
| workflows ×50（含 nodes） | ~1 MB |
| exec 1128 includeData | ~93 KB |
| exec 1129 includeData | ~154 KB |
| exec 1130 includeData | ~342 KB |
| 黄 fixture 1133 includeData | ~3 KB |

详情按树按需拉 + I/O 截断仍必要（单链可到数百 KB）。

---

## 6. 深链 URL

官方编辑器（editor-ui / error-workflow 文案一致）：

```text
{N8N_EDITOR_BASE_URL}/workflow/{workflowId}/executions/{executionId}
```

例：`http://127.0.0.1:5678/workflow/XHRuUauIjyVCqFnX/executions/1128`  
（远程用 `.env` 的 `N8N_EDITOR_BASE_URL`）

---

## 7. 对 PRD / M2 的影响

| 项 | 动作 |
|----|------|
| 拼图键 `parentExecution` | 维持；辅以 `subExecution` 向下 |
| 黄灯 | PRD §6 语义不变；实现按 §4.2 启发式（本 spike 已验证） |
| Jaeger | 未使用 |
| 版本 | 钉 `2.28.7` 无异议 |

**下一步：** M2 脚手架（`execution-map/`）→ 列表 + React Flow 画布 + I/O 截断 + 深链。
