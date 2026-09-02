# =============================================================================
# adb-usb-bench.ps1
# USB Host 口吞吐批量测速脚本（adb 连接 Android/Linux 设备，如 RK3588 板）
#
# 原理：root 下向 U 盘挂载卷写入 / 读取测试文件，用 dd 测量真实吞吐。
#   - 写测：dd /dev/zero → 测试文件，随后 sync 强制落盘（Android toybox dd
#     不支持 conv=fdatasync，必须 sync 兜底，否则 page cache 虚高）
#   - 读测：先 echo 3 > /proc/sys/vm/drop_caches 清页缓存，再 dd 读入 /dev/null
#   - 支持多块大小 × 多轮，输出逐轮明细与平均值
#
# 用法示例：
#   .\adb-usb-bench.ps1                     # 默认 1GB、bs=1M/4M/8M、各 2 轮
#   .\adb-usb-bench.ps1 -GB 2 -Rounds 3     # 2GB 文件、3 轮
#   .\adb-usb-bench.ps1 -Blocks 1M,8M       # 只测 1M 与 8M 块
#   .\adb-usb-bench.ps1 -Mount /mnt/media_rw/0000-0000   # 手动指定挂载点
#
# 安全说明：只向"已挂载卷内的文件"读写，绝不 dd 块设备（会毁分区）。
# =============================================================================
param(
    [int]$GB = 1,                                        # 测试文件大小（GiB）
    [int]$Rounds = 2,                                    # 每块大小的轮次
    [string[]]$Blocks = @('1M', '4M', '8M'),             # 块大小列表
    [string]$Mount = '',                                 # 留空则自动探测
    [string]$Device = ''                                 # 留空则取 adb 第一台设备
)

$ErrorActionPreference = 'Stop'
$testFile = '/spd_bench.bin'   # 挂载点根下的测试文件名
$wLog = '/tmp/spd_w.log'       # 设备端 dd 写统计落盘文件
$rLog = '/tmp/spd_r.log'       # 设备端 dd 读统计落盘文件

# ---------- 1. 环境检查：adb / 设备 / root ----------
Write-Host '== 1/4 环境检查 ==' -ForegroundColor Cyan
$adb = Get-Command adb -ErrorAction SilentlyContinue
if (-not $adb) { throw '未找到 adb，请先安装 platform-tools 并加入 PATH' }

if (-not $Device) {
    # adb devices 状态行格式：<serial>\s+<state>（state=device 表示已授权在线；
    # 普通输出仅两列，行尾无内容，故不要求尾部空白；标题行不含独立 "device" 词）
    $devices = adb devices | Where-Object { $_ -match '^\S+\s+device(\s|$)' } |
        ForEach-Object { ($_ -split '\s+')[0] }
    if (-not $devices) { throw '未检测到 adb 设备，请先连接并授权' }
    $Device = @($devices)[0]
}
Write-Host "  设备: $Device"

$id = adb -s $Device shell id
if ($id -notmatch 'uid=0') {
    Write-Host '  当前非 root，尝试 adb root ...' -ForegroundColor Yellow
    adb -s $Device root | Out-Null
    Start-Sleep 2
    adb -s $Device wait-for-device
    $id = adb -s $Device shell id
    if ($id -notmatch 'uid=0') { throw '需要 root 权限（adb root 不可用），脚本无法执行直测' }
}
Write-Host '  root: 已获得' -ForegroundColor Green

# ---------- 2. 定位 U 盘挂载点 ----------
if (-not $Mount) {
    Write-Host '== 2/4 探测挂载点 ==' -ForegroundColor Cyan
    # 优先从 df 取 vold 挂载的真实路径（不同 Android 版本可能是
    # /mnt/media_rw/<vol> 或 /mnt/pass_through/<user>/<vol>）
    $dfLines = adb -s $Device shell df
    $voldLine = $dfLines | Where-Object { $_ -match 'vold/public' } | Select-Object -First 1
    if ($voldLine) {
        $parts = ($voldLine -split '\s+') | Where-Object { $_.Trim() }
        $Mount = $parts[-1].Trim()
    }
    # 兜底：枚举 /mnt/media_rw 下的卷目录
    if (-not $Mount) {
        $sub = adb -s $Device shell "ls /mnt/media_rw/"
        $mountName = ($sub | Where-Object { $_.Trim() } | Select-Object -First 1)
        if ($mountName) { $Mount = "/mnt/media_rw/$($mountName.Trim())" }
    }
    if (-not $Mount) {
        throw '未检测到 U 盘挂载：请确认 U 盘已插入 USB 口并被系统挂载（若已插入可先到系统设置弹出/重新插拔）；确认挂载后可用 -Mount <路径> 手动指定'
    }
}
Write-Host "  挂载点: $Mount" -ForegroundColor Green
Write-Host "  测试文件: ${GB} GiB × 块大小 [$($Blocks -join ', ')] × $Rounds 轮"

# ---------- 3. 工具函数 ----------
# 解析 dd 统计行（toybox 格式: "1073741824 bytes (1.0 G) copied, 8.622 s, 67 M/s"）
# 返回 [MB/s]。自行用 bytes/时间 换算，不依赖 dd 的速率单位。
function Get-DdMbPerSec([string]$logText) {
    $m = [regex]::Match($logText, '([0-9]+) bytes.*copied,\s+([0-9.]+)\s+s')
    if (-not $m.Success) { throw "无法解析 dd 输出: $logText" }
    $bytes = [long]$m.Groups[1].Value
    $sec = [double]$m.Groups[2].Value
    if ($sec -le 0) { throw 'dd 耗时异常(<=0s)' }
    return [math]::Round($bytes / 1MB / $sec, 1)
}

# 写测一轮：rm 旧文件 → dd → sync 落盘 → 读回统计
function Invoke-WriteRound([string]$mnt, [int]$count, [string]$bs) {
    adb -s $script:Device shell "rm -f $mnt$script:testFile" | Out-Null
    adb -s $script:Device shell "dd if=/dev/zero of=$mnt$script:testFile bs=$bs count=$count 2>$script:wLog" | Out-Null
    adb -s $script:Device shell sync
    $txt = (adb -s $script:Device shell cat $script:wLog) -join "`n"
    return Get-DdMbPerSec $txt
}

# 读测一轮：清页缓存 → dd 读 → 读回统计
function Invoke-ReadRound([string]$mnt, [int]$count, [string]$bs) {
    adb -s $script:Device shell "echo 3 > /proc/sys/vm/drop_caches" | Out-Null
    adb -s $script:Device shell "dd if=$mnt$script:testFile of=/dev/null bs=$bs count=$count 2>$script:rLog" | Out-Null
    $txt = (adb -s $script:Device shell cat $script:rLog) -join "`n"
    return Get-DdMbPerSec $txt
}

# ---------- 4. 批量测速 ----------
Write-Host ''
Write-Host '== 3/4 开始测速（进度） ==' -ForegroundColor Cyan
$summary = @()   # 汇总行：{bs, direction, rounds[], avg}

foreach ($bs in $Blocks) {
    $n = 0
    if ($bs -match '^(\d+)M$') { $n = [int]$Matches[1] }
    elseif ($bs -match '^(\d+)K$') { $n = [math]::Round([int]$Matches[1] / 1024, 2) }
    else { throw "不支持的块大小: $bs（示例 1M/4M/8M）" }
    if ($n -lt 0.125) { throw "块大小 $bs 过大（至少 128K）" }
    $count = [math]::Floor($GB * 1024 / $n)

    foreach ($direction in @('write', 'read')) {
        $vals = @()
        for ($r = 1; $r -le $Rounds; $r++) {
            $t0 = Get-Date
            $mbps = if ($direction -eq 'write') {
                Invoke-WriteRound $Mount $count $bs
            } else {
                Invoke-ReadRound $Mount $count $bs
            }
            $sec = [math]::Round(((Get-Date) - $t0).TotalSeconds, 1)
            $vals += $mbps
            Write-Host ("  [{0,-5} {1}] round {2}/{3}: {4,7:N1} MB/s ({5}s)" -f $bs, $direction, $r, $Rounds, $mbps, $sec) -ForegroundColor Gray
        }
        $avg = [math]::Round(($vals | Measure-Object -Average).Average, 1)
        $summary += [pscustomobject]@{
            块大小 = $bs; 方向 = $direction; 轮次 = ($vals -join '/'); 平均 = $avg
        }
    }
}

# ---------- 清理 + 汇总 ----------
adb -s $Device shell "rm -f $Mount$testFile $wLog $rLog" | Out-Null
Write-Host ''
Write-Host '== 4/4 汇总结果 ==' -ForegroundColor Cyan
$summary | Format-Table 块大小, 方向, 轮次, 平均 -AutoSize | Out-String -Width 80 | Write-Host
Write-Host '完成。测试文件已清理。' -ForegroundColor Green
