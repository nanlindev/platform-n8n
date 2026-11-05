# n8n 2.x 升级记录（platform-n8n）

计划：[n8n_2.x_upgrade_ca751b02.plan.md](/Users/lotey/.cursor/plans/n8n_2.x_upgrade_ca751b02.plan.md)  
仓库：`platform-n8n` · 钉版本：`n8nio/n8n:2.46.4`（本地已升；远程 U8 进行中）

## 目标版本

| 项 | 值 |
|----|----|
| 基线镜像 | `n8nio/n8n:2.28.7`（本地 `docker exec … n8n --version` 确认） |
| **目标镜像** | **`n8nio/n8n:2.46.4`** |
| 选定日期 | 2026-11-04 |
| 选定依据 | Docker Hub 当日 `stable` / `latest` digest 与 `2.46.4` 一致；`≥ 2.39`；同日另有 `2.47.0` 但与 `next`/`beta` digest 一致，不采用 |
| 故意不选 | `3.1.0` / `3.0.0`（留给 3.0 plan）；`2.47.0`（next/beta 通道） |

查询源：Docker Hub `n8nio/n8n` tags；GitHub Releases `n8n-io/n8n`（`n8n@2.29.0` … `n8n@2.46.4`）。

## 2.28.7 → 2.46.4 Breaking / 弃用摘要

官方 [`BREAKING-CHANGES.md`](https://github.com/n8n-io/n8n/blob/master/packages/cli/BREAKING-CHANGES.md) 在 2.0 之后本段区间**没有**新的硬性 2.x breaking 条目（近期条目多为 1.x 与 Unreleased packages）。下面是从 **2.29–2.46** release notes 抽出、对本仓可能有影响的弃用 / 行为变化（非完整 changelog）。

| 版本附近 | 变更 | 对本仓影响（U0 静态核对） |
|----------|------|---------------------------|
| 2.30 | 表达式编辑器弃用 `$getPairedItem` | 生成器 / workflow JSON 未检出 |
| 2.33 | Public API `…/activate`、`…/deactivate` 弃用 | 仓内脚本未用这两端点 |
| 2.34 | Execute Workflow：Local File / URL 源弃用 | 未检出 `localFile` / `url` source |
| 2.35 | 自托管 AI Assistant 默认启用；不必再设 `N8N_ENABLED_MODULES=instance-ai`；可用 `N8N_DISABLED_MODULES=instance-ai` 关掉 | 升级后按需决定是否关掉 |
| 2.36 | 表达式 `Array.merge` 弃用 → `Array.mergeIntoObject` | 未检出 |
| 2.37 | Caller policy「Any workflow」弃用 | 现有 JSON 均为 `workflowsFromSameOwner`（35 处） |
| 2.38–2.39 | Workflow version API 新路径；Code 节点 Ask AI 页隐藏；退役节点类型标 deprecated | 升级后靠 Migration Report（U4）再扫 |
| 2.39+ | Migration Report / v3 规则陆续落地（存储目录改名、Chat Hub 移除等） | **多数是给 3.0 用的预警**；U4 分类记录 |
| 2.42.6 / 2.44 | 禁止对含 deprecated 节点的工作流 create/update | U4 若报告有 deprecated 节点须先换掉再改 |
| 2.45–2.46 | 移除节点的自动迁移、Migration Report CSV、编辑器阻止使用 deprecated 节点；v3 规则增加 LangChain Code 等 | U4 主战场；LangChain Code 等归 3.0 桶 |

**U0 结论：** 从笔记看，升到 2.46.4 对本仓生成器/JSON **没有已知必炸项**；真正要修的内容以 U3 后 Migration Report（U4）为准。

## 基线快照

- 文件：[`upgrade-baseline/workflows-2.28.7.json`](./upgrade-baseline/workflows-2.28.7.json)
- 来源：`GET http://127.0.0.1:5678/api/v1/workflows`（元数据：`id` / `name` / `active` / `isArchived` / `tags` / `updatedAt`）
- 捕获时：`count=51` · `active=9`（均为 B2B Lead *）· `archived=16`

## 基线 smoke 结果（U0，仍在 2.28.7）

机器：M1 8GB。OBS 栈临时起 Elasticsearch + Jaeger + OTel collector；sidecar **轮流**起（crm 原本已在跑；ecom → 停 → doc）。Langfuse UI **未起**（kit 对 Langfuse 为 soft-pass / skip）。

| 检查 | 命令 | 结果 | 备注 |
|------|------|------|------|
| n8n 版本 | `docker exec platform-n8n-n8n_app-1 n8n --version` | **2.28.7** | |
| 工作流快照 | API → `docs/upgrade-baseline/workflows-2.28.7.json` | **OK** | 51 / active 9 |
| doc primary | `doc-workflow/scripts/smoke_doc_primary.py` | **PASS** | exit 0 |
| kit crm path | `obs-quality-kit/scripts/smoke_kit_crm_path.py --live` | **PASS** | Jaeger OK；Langfuse UI warn soft-pass |
| kit ecom path | `obs-quality-kit/scripts/smoke_kit_ecom_path.py --live` | **PASS** | 同上 |
| kit doc path | `obs-quality-kit/scripts/smoke_kit_doc_path.py --live --skip-primary` | **PASS** | primary 已单独跑过，避免重复 LLM；OBS D1/D5/D6/D8/D9 OK |
| execution-map | `cd execution-map && npm run build` | **PASS** | `tsc --noEmit && vite build` |

## U6 本地整体回归（2.46.4，与 U0 并排）

机器 / OBS 策略同 U0（Jaeger + ES + OTel；sidecar 轮流；Langfuse UI 未起）。平台 smoke 基线改为 `workflows-2.46.4.json`（含 U5 `zz-smoke`）。

| 检查 | U0（2.28.7） | U6（2.46.4） | 偏差说明 |
|------|--------------|--------------|----------|
| n8n 版本 | **2.28.7** | **2.46.4** | 预期 |
| 工作流快照 | 51 / active 9 | 54 / active 9（`workflows-2.46.4.json`） | +3 = U5 `zz-smoke parent/child/yellow`（均未 active） |
| platform smoke | （U1 后无 `--trigger`） | **PASS**（`--baseline …2.46.4.json --trigger`） | Tally HMAC：`sign` + compact JSON（对齐 `JSON.stringify(body)`；item 常无 `rawBody`） |
| doc primary | **PASS** | **PASS** | 同 |
| kit crm `--live` | **PASS**（Langfuse soft-pass） | **PASS**（同上） | 同 |
| kit ecom `--live` | **PASS**（Langfuse soft-pass） | **PASS**（同上） | 同 |
| kit doc `--live --skip-primary` | **PASS** | **PASS** | 同；primary 已单独 PASS |
| Execution Map CRM 父子链 | （U0 仅 build） | **PASS**：Intake **1187** → Enrichment **1188/1190** → CRM Sync **1189/1193**（虚线 sub-WF） | 截图 `upgrade-baseline/u6-crm-parent-child-1187.png` |
| RSS 定时 WF 手动跑 | — | **SKIP** | 本机实例无 `RSS News Filter`（仅 `n8n_portfolio/workflows/` JSON；未导入） |

## 本地备份（U2）

目录（仓库外，勿提交）：`~/lindev/_backups/n8n-2026-11-04-2.28.7/`

| 文件 | 来源 | 验收 |
|------|------|------|
| `n8n_postgres.dump` | `pg_dump -Fc`（容器内 env，约 1.3 MB） | `docker run --rm -v … postgres:16-alpine pg_restore --list` 可见表（112 条 `TABLE DATA`） |
| `workflows.json` | `n8n export:workflow --all` | **51** 条，与 U0 基线一致 |
| `credentials.json` | `n8n export:credentials --all`（**未** `--decrypted`） | 16 条；`data` 为密文字符串 |
| `n8n_data.tar.gz` | volume `platform-n8n_n8n_data` | 非空；含 `config` / `nodes` / `storage` |
| `MANIFEST.txt` | 本目录说明 | — |

## 回滚（U2）

在 **本地** 升级失败、需要回到 2.28.7 时按顺序做。远程回滚见 U8（另备服务器 dump）。路径变量：

```bash
BACKUP="$HOME/lindev/_backups/n8n-2026-11-04-2.28.7"
cd ~/lindev/platform-n8n
```

1. **改回镜像 tag**  
   把 `docker/compose.yml` 里 `n8nio/n8n:…` 改回 `n8nio/n8n:2.28.7`（若已 commit 目标 tag，用 git 还原该文件即可）。

2. **停栈**  
   ```bash
   docker compose -f docker/compose.yml --env-file .env stop n8n_app
   # 恢复 DB 前建议连 postgres 一并停，避免写入竞态
   docker compose -f docker/compose.yml --env-file .env stop
   ```

3. **恢复 Postgres**（会覆盖当前库数据）  
   ```bash
   docker compose -f docker/compose.yml --env-file .env up -d n8n_postgres
   # 等 healthy 后：
   docker exec -i platform-n8n-n8n_postgres-1 \
     sh -c 'pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
     < "$BACKUP/n8n_postgres.dump"
   ```
   若 `pg_restore` 报部分 error（依赖顺序），可改用「空库再 restore」：删 volume `platform-n8n_postgres_data` 后只起 postgres，再 `pg_restore`（无 `--clean`）。**删 volume 前确认 dump 可读。**

4. **恢复 n8n 数据卷**（加密 key / 二进制等）  
   ```bash
   docker run --rm \
     -v platform-n8n_n8n_data:/data \
     -v "$BACKUP":/backup \
     alpine:3.20 \
     sh -c 'rm -rf /data/* /data/.[!.]* 2>/dev/null; tar xzf /backup/n8n_data.tar.gz -C /data'
   ```

5. **拉起并验收**  
   ```bash
   docker compose -f docker/compose.yml --env-file .env up -d
   docker exec platform-n8n-n8n_app-1 n8n --version   # 期望 2.28.7
   set -a && source execution-map/.env && set +a
   export EXPECTED_N8N_VERSION=2.28.7
   python3 scripts/smoke_n8n_platform.py \
     --baseline docs/upgrade-baseline/workflows-2.28.7.json
   ```

6. **可选：从 JSON 重导工作流/凭据**（仅当 DB+卷恢复后仍缺对象；凭据须同一 encryption key）  
   ```bash
   docker cp "$BACKUP/workflows.json" platform-n8n-n8n_app-1:/tmp/workflows.json
   docker cp "$BACKUP/credentials.json" platform-n8n-n8n_app-1:/tmp/credentials.json
   docker exec platform-n8n-n8n_app-1 n8n import:credentials --input=/tmp/credentials.json
   docker exec platform-n8n-n8n_app-1 n8n import:workflow --input=/tmp/workflows.json
   ```

**不要**把 dump / credentials / 加密 key 写进 git 或聊天日志。

## Migration Report（U4）

入口：Settings → Migration report（需 **≥2.39**）。官方说明：[v3.0 Migration tool](https://docs.n8n.io/changelog/v30-migration-tool) · [v3.0 breaking changes](https://docs.n8n.io/changelog/v30-breaking-changes)。

它是 n8n 内置的 **升级前体检**：对照即将到来的大版本规则（本机报告目标为 **3.0.0**）扫描本实例的工作流节点与实例配置，按影响分级列出，可 Refresh / Export CSV。**不等于**已经升到 3.0；在 2.46.4 上跑它是为了提前清债。

本机快照（2026-11-04，`migration_finding` + UI）：

| 桶 | 条数 | 处理 |
|----|------|------|
| **影响当前 2.x**（`targetVersion=v2`） | **0** | 无需修；验收通过 |
| **仅影响 3.0**（`targetVersion=v3`） | Workflow 2 类 / 9 条 finding；UI Instance issues 4 | 记录留给 3.0 plan；本步不改生成器 |

原始导出：[`upgrade-baseline/migration-findings-2.46.4.csv`](./upgrade-baseline/migration-findings-2.46.4.csv)

### A. 影响当前 2.x → 本步应修

无（DB `migration_finding` 中 `targetVersion=v2` 为空）。  
`smoke_n8n_platform.py` + `EXPECTED_N8N_VERSION=2.46.4` 仍 **PASS**。

### B. 仅影响 3.0 → 留给 3.0 plan

**Workflow issues**

| ruleId | 影响 | 工作流 | 备注 |
|--------|------|--------|------|
| `always-output-data-multi-output-v3` | Behavior changes | B2B Lead：Intake / Daily / Weekly / Booking Follow-up / Calendly / Slack Actions；Earls Local：Sync Payments、Retry Failed | Google Sheets 读节点开了 `alwaysOutputData`；3.0 后多输出节点空 item 行为会变。crm 走 `generate_workflows.py`；Earls 在 `upwork/salah-earls-property` |
| `gmail-trigger-version-v3` | Behavior changes | Doc Email Ingest（`gmailTrigger` typeVersion **1.2**） | 3.0 起一律按 v1.4 行为（Max Emails / drafts 等）。改 `doc-workflow` 生成器后再导入 |

**Instance issues（UI 恰好 4 条，2026-11-04 重登后核对）**

| 标题 | 说明 | 3.0 建议 |
|------|------|----------|
| Compression node limits are lowered | 解压默认 2 GiB→256 MiB；ZIP entries 5000→1000 | 大压缩包工作流显式设旧上限 |
| Task runner timeout default is reduced to 1 minute | `N8N_RUNNERS_TASK_TIMEOUT` 默认 300→60 | 长 Code 任务显式设超时 |
| Unverified community packages are disabled by default | `N8N_UNVERIFIED_PACKAGES_ENABLED` 默认→`false` | 若仍要未验证社区包，显式 `true`；本仓目前可忽略 |
| Workflow import from URL is removed | 编辑器「Import from URL」将删 | 改用文件/粘贴/CLI/API（我们本就不用 URL 导入） |

**启动 deprecation（不在上述 4 条里，额外记下）**

| 项 | 说明 |
|----|------|
| `WEBHOOK_URL` → `N8N_WEBHOOK_URL` | 配置卫生；2.x 仍可用旧名 |
| `N8N_RUNNERS_MODE`（internal） | internal runner 将来移除；评估 external task runner |

未使用 Chat Hub / 无 `binaryData`+`storage` 双目录冲突（卷内已是 `storage/`）/ 无 removed-node finding。

## U7 阶段审查（是否升远程）

**日期：** 2026-11-05 · **结论草案：** 本地 2.46.4 可视为升远程候选；**须 Nan 回复「升远程」后才进 U8**（先服务器备份，再同意 commit/push）。

### 1. 对外发送闸门

依据：crm `config_main.mode=test`（见 [TEST_PRODUCTION](../../crm-workflow/docs/zh/TEST_PRODUCTION.md)）+ U6 trigger 链实测（Intake **1187** → Enrichment **1188** → CRM Sync **1189/1193**）。

| 副作用 | test 设计 | U6 实测 |
|--------|-----------|--------|
| HubSpot / GHL | 跳过 | `sync_hubspot=false`；节点 `Skip CRM Test Mode` / `Skip GHL`；`first_touch_skip_reason=test_mode` |
| Slack 通知 | 跳过 | `notification_status=skipped_test_mode`；`should_send_slack=false`；`Skip Notification Test` |
| 首触发送 | 跳过 | `Skip First Touch` |
| Sheets `leads` / audit | **仍写入**（test 本意） | Intake/Enrichment 跑通，会落烟测行（含 SmokeMarker） |

**结论：** 对外 CRM/Slack/邮件闸门仍有效。test 下会写 Sheets——升级远程前勿把 `mode` 误开成 `production`。

### 2. 凭据

- U2 备份：`credentials.json` **16** 条（加密导出，类型含 Sheets / HubSpot / Slack / Gmail / GHL / DeepSeek 等）。
- Public API `GET /credentials` 对本 key **403**（只读范围不足）；未做 production 打 CRM。
- **功能侧证：** U6 CRM 链 success → Sheets 读写 + webhook 验签 + Enrichment HTTP 可用；HubSpot/Slack 在 test 下按设计未打，不能据此声称「生产凭据已联通验证」，只能说 **升级未抹掉凭据、test 路径依赖的凭据可用**。

### 3. Error 端口

全部 **active** 业务 WF 的 `settings.errorWorkflow` 均指向 `B2B Lead Error Handler`（`w1TuzC8GiveQXc8W`）；Error Handler 自身 `errWF=None`（正确）。Handler 近期仍有历史 `mode=error` 执行记录（10-27），绑定未断。

### 4. Migration Report 剩余项

| 桶 | 状态 | 升远程影响 |
|----|------|------------|
| 影响当前 **2.x** | **0** | 无阻塞 |
| 仅 **3.0** Workflow（`alwaysOutputData` / Gmail Trigger 1.2） | 已登记，未改生成器 | **不阻塞** 2.46.4 远程 |
| 仅 **3.0** Instance ×4 + 启动 deprecation | 已登记 | **不阻塞**；3.0 plan 再处理 |

### 5. 其它剩余 / 风险

| 项 | 说明 |
|----|------|
| 本地未提交 | `compose.yml`→2.46.4、`UPGRADE_2X.md`、`upgrade-baseline/`、`smoke_n8n_platform.py` + triggers、ExecMap 钉版本 docs |
| RSS | 本机未导入；远程若仍跑 RSS，部署后需单独确认 schedule |
| zz-smoke ×3 | 本地多出来；远程是否一并导入可选（建议不 active） |
| OTel | 无 collector 时启动有 OTLP warn（预期）；有 OBS 则 U6 已绿 |
| 远程 U8 顺序 | 服务器 `pg_dump`+卷备份 → Nan 同意 → commit/push → Action → 远程 smoke |

### 闸门

**2026-11-05：** Nan 已回复「升远程」→ 进入 U8。

## U8 远程升级

**顺序：** 服务器备份（Action 内、pull 前）→ commit/push `main` → Deploy Action → 远程 healthz + `n8n --version` 校验 2.46.4 →（可选）本机用远程 `N8N_BASE_URL` + API key 跑 `smoke_n8n_platform.py`。

| 项 | 做法 |
|----|------|
| 备份 | `scripts/backup_n8n_pre_deploy.sh` → `/home/deploy/backups/n8n-<utc>-pre-deploy/`（`pg_dump -Fc` + `n8n_data.tar.gz` + MANIFEST；保留最近 5 份）。`SKIP_PRE_DEPLOY_BACKUP=1` 可跳过 |
| 部署 | `.github/workflows/deploy.yml`：reset → backup → pull/up → curl `/healthz` → 断言版本含 `2.46.4` |
| 本机 SSH | agent 无 deploy 私钥；备份与健康检查走 GitHub Actions SSH |
| 远程 smoke | Action 内已做 healthz+version；完整 API smoke 需远程 base URL + key（本机 `.env` 现为 ngrok，非生产） |

远程回滚：用最新 `…-pre-deploy` dump/卷，按本地 U2 回滚步骤在服务器执行（镜像先改回 `2.28.7` 再 restore）。

## 步骤记录

| 日期 | 步骤 | 结果 | 偏差 |
|------|------|------|------|
| 2026-11-04 | U0 | 完成：目标 **2.46.4**；快照与 smoke 基线表已写入 | kit doc 用 `--live --skip-primary`（primary 已单独 PASS）；Langfuse UI 未起（预期 soft-pass） |
| 2026-11-04 | U1 | 完成：`scripts/smoke_n8n_platform.py` + `scripts/smoke_triggers.json`；2.28.7 基线跑通 exit 0；`EXPECTED_N8N_VERSION=9.9.9` → exit 1 | 版本探测走 editor bundle `n8n@x.y.z`（可用 `N8N_REPORTED_VERSION` 覆盖）；`--trigger` 未在 U1 实跑（默认关闭，U6 再开） |
| 2026-11-04 | U2 | 完成：备份在 `~/lindev/_backups/n8n-2026-11-04-2.28.7/`；回滚步骤已写入本文；workflows 51=基线；`pg_restore --list` OK；凭据保持加密 | 宿主机无 `pg_restore`，用 `postgres:16-alpine` 容器列出 TOC |
| 2026-11-04 | U3 | 完成：`docker/compose.yml` → `n8nio/n8n:2.46.4`；pull+up；119 条 migration 全部 Finished；`EXPECTED_N8N_VERSION=2.46.4` smoke exit 0（无 `--trigger`） | OTel collector 未起 → 启动时 OTLP connect warn（预期）；版本探测补上 2.46 meta `n8n:config:sentry` |
| 2026-11-04 | U4 | 完成：Migration Report 整理进本文；**2.x 问题 = 0**（无需改生成器）；3.0 项已登记；smoke 仍 PASS | 初版 Instance 列表曾混入启动 warn；Nan 重登后 UI 四条已校正写入 |
| 2026-11-04 | U5 | 完成：`zz-smoke parent/child/yellow`；红样 1182→1183（虚线+2r）；黄样 1179（1y）；`npm run build` PASS；PRD §8 全勾；截图入 `upgrade-baseline/` | 原黄样 1133 已不在，新建 yellow；子 WF 须 publish 后 Execute Workflow 才跑得通；CLI execute 需停主进程（Task Broker 端口） |
| 2026-11-04 | U6 | 完成：platform `--trigger` + doc/kit 三条 + ExecMap CRM 链；并排表见上文 | RSS 本机未导入 → SKIP；`--trigger` 补 Tally `sign`/compact JSON；WF 54 vs U0 51 因 zz-smoke |
| 2026-11-05 | U7 | 完成：阶段审查写入本文 §U7；闸门/error/Migration 剩余已核对 | **等 Nan「升远程」才进 U8**；凭据 API 403，靠 U6 功能侧证 |
