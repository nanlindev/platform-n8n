# n8n 2.x 升级 — job memory

**更新：** 2026-11-05（U9 收尾完成）  
**真源过程记录：** [UPGRADE_2X.md](./UPGRADE_2X.md) · 计划 `n8n_2.x_upgrade_ca751b02.plan.md`  
**钉版本：** `n8nio/n8n:2.46.4`（本地 + 远程）

## 耐久决定

| 决定 | 内容 |
|------|------|
| 目标 | **2.46.4**（stable；不选 2.47.0/3.x） — **已落地** |
| 本地备份 | `~/lindev/_backups/n8n-2026-11-04-2.28.7/`（仓外，历史回滚用） |
| 远程备份 | Action 内 `scripts/backup_n8n_pre_deploy.sh` → `/home/deploy/backups/n8n-*-pre-deploy/` |
| Migration | **2.x finding = 0**；3.0 项只登记 → roadmap `v3-and-catalog` |
| zz-smoke | 本地 parent/child/yellow（未 active）；远程未强制导入 |
| RSS | 本机未导入；远程若跑 RSS 另确认 |
| Roadmap | `competitiveness_roadmap` 的 **`upgrade-2x` = completed** |

## 进度

| 步 | 状态 |
|----|------|
| U0–U9 | **全部完成** |

## 下一步（升级轨之外）

- 3.0 试升级 / Catalog：见 roadmap `v3-and-catalog` + `UPGRADE_2X.md`「升级经验 / 检查清单初稿」
- 主线项目：中国 LLM 成本评测（`eval-*` todos）
