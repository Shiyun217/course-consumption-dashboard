# 港澳 LP / SS 运营驾驶舱

左侧“LP 看板”集中展示升舱率、整体/新生预计完课率、固定计划绑定率、IUR占比，以及M0/M1建群率，并位于“课耗看板”下方。核心指标配置位于 `core-overview-data.js`；未从登录数据源确认的数值保持为空。

这个目录用于维护 SS 课耗 HTML 看板。每天拿到新的邮件下载源表后，用 `update_dashboard.py` 追加历史数据并重新生成看板。

## 文件说明

- `update_dashboard.py`：读取每日源表，按课耗考核规则生成小组和个人汇总。
- `history.json`：历史快照库，记录每天的小组/个人考核学员数、预计达标学员数和预计完课率。
- `ss-course-consumption-dashboard.html`：最终 HTML 看板，可直接用浏览器打开。
- `index.html`：GitHub Pages 入口页，会自动跳转到课耗驾驶舱。
- `fixed-plan-data.js`：固定计划 M0-M1 分析结果，由两份固定计划源表更新。
- `fixed-plan.js` / `fixed-plan.css`：固定计划版块的交互与样式；课耗看板重生成后仍会自动加载。

## 固定计划版块

“固定计划”与课耗、LP运营、学科平级，包含三个子版块：

- M0-1固定计划绑定：已接入 2025-01 至 2026-07 cohort 的首次操作者分析。
- 历史固定计划绑定（用户维度）：已预留入口。
- 历史固定计划绑定（工单维度）：已预留入口。

M0-1 口径为首单所在自然月月初至次月月末。窗口内按学员 ID 和固定绑定时间排序，只保留最早一条；`Y=other` 时，`Z` 为空或 `-1` 归为 `other`，否则归为 `CC`。

## 统计口径

- 只保留 6 个核心 SS 小组：`BJ-JWSS01小组`、`BJ-JWSS02小组`、`BJ-JWSS04小组`、`BJ-JWSS07小组`、`GZ-SS01小组`、`GZ-SS04小组`。
- 是否考核课耗：`当前套餐低消次数要求=0 且 月初剩余课时量>=12`，或 `当前套餐低消次数要求>0 且 月初剩余课时量>=当前套餐低消次数要求`。
- 预计完课量：`当月完课量 + 当月已约未上课次`。
- 预计达标：预计完课量达到低消要求；低消为 0 时按 12 节计算。
- 拉动率：当前日期预计完课率减上一历史日期预计完课率。
- 四阶段目标：66%。
- 人均课耗：读取 `课耗公式.xlsx` 的 `课耗战报!F10`。
- 过程性高课耗占比：读取 `课耗公式.xlsx` 的 `课耗战报!H10`。

## 每日更新

默认脚本会读取 `D:\codex数据\课耗` 目录下最新日期的源表，并按文件名日期减一天作为看板日期：

```powershell
$py='C:\Users\guoshiyun\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $py 'course-consumption-dashboard\update_dashboard.py'
```

如果要手动指定某一份源表：

```powershell
$py='C:\Users\guoshiyun\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $py 'course-consumption-dashboard\update_dashboard.py' --source 'C:\你的新源表路径.xlsx'
```

如果第二张中转表路径也变了：

```powershell
$py='C:\Users\guoshiyun\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $py 'course-consumption-dashboard\update_dashboard.py' --source 'C:\你的新源表路径.xlsx' --formula 'D:\课耗相关\课耗公式.xlsx'
```

第一次初始化历史时才需要加 `--seed-followup`，它会从现有跟进表补入 7.24 和 7.25 的历史基线。

## 实习生更新权限

实习生需要 GitHub 账号，并在仓库中添加为协作者，权限建议为 `Write`。

当前仓库是公开仓库，不要把含学员明细的原始 Excel 上传到 GitHub。推荐流程是：源表只放在本地 `D:\codex数据\课耗`，然后运行一键脚本，脚本只提交生成后的看板和历史数据。

```powershell
.\scripts\update-course-dashboard.ps1
```

详细步骤见 `docs/intern-course-update-guide.md`。

## GitHub Pages 部署

将本目录作为独立仓库推送到 GitHub 后，在仓库 `Settings > Pages` 中选择 `Deploy from a branch`，分支选择 `main`，目录选择 `/root`。部署完成后访问仓库 Pages 地址即可自动打开 `ss-course-consumption-dashboard.html`。

## 固定计划跨电脑更新

固定计划的每日更新在浏览器中完成：进入“固定计划 > M0-1固定计划绑定-最新”，点击“更新数据”，选择固定计划明细和付费明细，输入发布口令后点击“发布并更新公共看板”。

- 原始 Excel、学员 ID 和操作人员姓名仅在当前浏览器中处理，不发送到后台。
- 后台只保存整体、端口和指定 14 个小组的汇总人数与比例。
- 发布成功后，其他电脑刷新 GitHub Pages 页面即可读取同一份公共汇总。
- 三个 sheet 的统计结果文件仍保存在上传者浏览器中，可在当前电脑下载。
- 公共数据接口由 Cloudflare Pages Functions 提供，配置见 `fixed-plan-sync-config.js`，服务代码见 `workers/fixed-plan-sync/`。
