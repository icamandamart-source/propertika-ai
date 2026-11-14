# PowerShell script to start Propertika AI server
# Kill any existing server on port 3000

$process = Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "node" }
if ($process) {
    Stop-Process -Id $process.Id -Force
    Write-Host "Stopped existing node processes"
}

# Navigate to project directory
cd C:\IVAN\Projects\propertika-ai

# Start the server
Write-Host "Starting Propertika AI server..."
npm start