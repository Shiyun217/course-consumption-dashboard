# 课耗看板实习生更新说明

## 权限

实习生需要 GitHub 账号，并加入仓库协作者，权限建议设为 `Write`。

仓库地址：

https://github.com/Shiyun217/course-consumption-dashboard

> 注意：当前仓库是公开仓库，不要把含学员明细的原始 Excel 上传到 GitHub。原始表只放在本地电脑或公司内部盘，更新脚本只提交生成后的 `history.json` 和 `ss-course-consumption-dashboard.html`。

## 每日更新流程

1. 将邮件下载的课耗源表放到本地目录：

   `D:\codex数据\课耗`

2. 文件名需要保留日期，例如：

   `海外运营中台 - 张海光 - DS任务-港澳SS服务标可见度学员明细_2026-09-01-结果.xlsx`

3. 在仓库目录打开 PowerShell：

   `C:\Users\guoshiyun\Documents\数据看板搭建\course-consumption-dashboard`

4. 运行：

   ```powershell
   .\scripts\update-course-dashboard.ps1
   ```

5. 脚本会自动：

   - 读取最新源表
   - 按考核课耗口径更新数据
   - 保存历史数据
   - 重新生成看板 HTML
   - 提交并推送到 GitHub

6. 推送后访问：

   https://shiyun217.github.io/course-consumption-dashboard/

## 手动指定源表

如果只想更新某一份表格，可以运行：

```powershell
.\scripts\update-course-dashboard.ps1 -Source "D:\codex数据\课耗\你的源表.xlsx"
```

## 日期口径

源表文件名日期代表邮件/下载日期，看板日期按前一天计算。例如：

- 文件名 `2026-09-01`
- 看板数据日期 `2026-08-31`

## 异常处理

- 如果提示缺少字段，先检查源表是不是港澳 SS 服务标可见度学员明细。
- 如果提示没有 GitHub 权限，需要让仓库管理员把实习生加入协作者。
- 如果网页没立刻刷新，等待 1 分钟后按 `Ctrl + F5` 强制刷新。
