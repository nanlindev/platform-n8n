# n8n 2.x 升级 — job memory

**更新：** 2026-11-05（Nan「升远程」→ U8）  
**真源过程记录：** [UPGRADE_2X.md](./UPGRADE_2X.md) · 计划 `n8n_2.x_upgrade_ca751b02.plan.md`  
**钉版本：** `n8nio/n8n:2.46.4`（本地已升；远程随 U8 deploy）

## 耐久决定

| 决定 | 内容 |
|------|------|
| 目标 | **2.46.4**（stable；不选 2.47.0/3.x） |
| 本地备份 | `~/lindev/_backups/n8n-2026-11-04-2.28.7/`（仓外） |
| 远程备份 | Action 内 `scripts/backup_n8n_pre_deploy.sh` → `/home/deploy/backups/n8n-*-pre-deploy/` |
| Migration | **2.x finding = 0**；3.0 项只登记不修 |
| zz-smoke | parent/child/yellow 留在本地实例（未 active）；远程不强制导入 |
| 远程闸门 | **2026-11-05 Nan 已说「升远程」** → 允许 commit/push compose |
| RSS | 本机未导入；远程若跑 RSS 部署后另确认 |

## 进度

| 步 | 状态 |
|----|------|
| U0–U7 | **完成** |
| U8 | **进行中**（backup-in-deploy + push main） |
| U9 | 未开始 |

## U6 要点（2026-11-04）

- 快照：`upgrade-baseline/workflows-2.46.4.json` → **54 / active 9**（相对 U0 +3 zz-smoke）
- `smoke_n8n_platform.py --trigger` PASS（Intake **1187**）；Tally 需 `sign` + **compact JSON** HMAC
- doc primary + kit crm/ecom/doc `--live` 全 PASS（Langfuse UI 未起 → soft-pass）
- ExecMap CRM 链：1187 → Enrichment 1188/1190 → CRM Sync 1189/1193；截图 `u6-crm-parent-child-1187.png`
- RSS：SKIP（portfolio JSON only）

## 未提交（本地，勿擅自 push）

`docker/compose.yml` → 2.46.4；`UPGRADE_2X.md`；`upgrade-baseline/`；`scripts/smoke_n8n_platform.py` + `smoke_triggers.json`；ExecMap 钉版本相关 docs。  
**U8 前**由 Nan 确认后再 commit/push。
