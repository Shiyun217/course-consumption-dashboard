param(
  [Parameter(Mandatory = $false)]
  [string]$Source,

  [Parameter(Mandatory = $false)]
  [string]$SourceDir = "D:\codex数据\课耗",

  [Parameter(Mandatory = $false)]
  [string]$CommitMessage
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$pythonCandidates = @(
  "C:\Users\guoshiyun\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe",
  "python"
)

$python = $null
foreach ($candidate in $pythonCandidates) {
  try {
    if ($candidate -eq "python") {
      $null = & python --version 2>$null
      $python = "python"
    } elseif (Test-Path $candidate) {
      $python = $candidate
    }
    if ($python) { break }
  } catch {
    $python = $null
  }
}

if (-not $python) {
  throw "未找到 Python。请先安装 Python，或确认 Codex runtime 路径存在。"
}

if ($Source) {
  $sourcePath = Resolve-Path $Source
  & $python "update_dashboard.py" --source $sourcePath
} else {
  if (-not (Test-Path $SourceDir)) {
    throw "未找到源表目录：$SourceDir"
  }
  & $python "update_dashboard.py" --source-dir $SourceDir
}

git status --short

$changed = git status --short -- history.json ss-course-consumption-dashboard.html update_dashboard.py course-history-data.js course-history.js
if (-not $changed) {
  Write-Host "看板没有新的数据变化，不需要提交。"
  exit 0
}

git add history.json ss-course-consumption-dashboard.html

if (-not $CommitMessage) {
  $currentDate = (Select-String -Path "ss-course-consumption-dashboard.html" -Pattern '"currentDate":\s*"([^"]+)"' | Select-Object -First 1).Matches.Groups[1].Value
  if ($currentDate) {
    $CommitMessage = "Update course dashboard data for $currentDate"
  } else {
    $CommitMessage = "Update course dashboard data"
  }
}

git commit -m $CommitMessage
git push

Write-Host "已更新并推送课耗看板。GitHub Pages 通常 1 分钟内刷新。"
