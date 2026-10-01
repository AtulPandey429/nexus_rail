param (
    [Parameter(Mandatory=$true)]
    [int]$DayNumber,

    [Parameter(Mandatory=$true)]
    [string]$CommitMessage
)

# Start base date: October 1, 2026
$baseDate = Get-Date "2026-10-01 10:00:00"
$commitDate = $baseDate.AddDays($DayNumber - 1)
$dateString = $commitDate.ToString("yyyy-MM-ddTHH:mm:ss")

Write-Host "📅 Setting commit timestamp for Day $DayNumber to $dateString..." -ForegroundColor Cyan

$env:GIT_AUTHOR_DATE = $dateString
$env:GIT_COMMITTER_DATE = $dateString

git add .
git commit -m $CommitMessage

Write-Host "✅ Day $DayNumber committed successfully with date $dateString!" -ForegroundColor Green
