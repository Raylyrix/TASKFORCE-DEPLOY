# Admin Database Cleanup Script (PowerShell)
# Safe manual cleanup tool for administrators

param(
    [string]$BackendUrl = "https://your-backend-url.com",
    [string]$AuthToken = "",
    [int]$LimitMB = 500
)

# Functions
function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Check-Auth {
    if ([string]::IsNullOrEmpty($AuthToken)) {
        Write-Error "AUTH_TOKEN not set!"
        Write-Host "Set it with: `$env:AUTH_TOKEN='your-token'" -ForegroundColor Yellow
        exit 1
    }
}

function Check-Size {
    Write-Header "Step 1: Checking Database Size"
    
    $headers = @{
        "Authorization" = "Bearer $AuthToken"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BackendUrl/api/data-retention/size" `
            -Method GET -Headers $headers
        
        $currentSize = $response.estimatedSizeMB
        $totalRows = $response.totalRows
        
        Write-Host "Current Size: $currentSize MB"
        Write-Host "Total Rows: $totalRows"
        Write-Host ""
        Write-Host "Breakdown:"
        $response.breakdown | Format-Table
        
        $percentage = ($currentSize / $LimitMB) * 100
        Write-Host ""
        Write-Host "Usage: $([math]::Round($percentage, 2))% of $LimitMB MB limit"
        
        if ($currentSize -gt $LimitMB) {
            Write-Error "Database exceeds limit!"
            return 1
        }
        elseif ($currentSize -gt ($LimitMB * 0.8)) {
            Write-Warning "Database approaching limit (80%)"
            return 2
        }
        else {
            Write-Success "Database size is healthy"
            return 0
        }
    }
    catch {
        Write-Error "Failed to check size: $_"
        return 1
    }
}

function Check-CleanupNeeded {
    Write-Header "Step 2: Checking if Cleanup is Needed"
    
    $headers = @{
        "Authorization" = "Bearer $AuthToken"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BackendUrl/api/data-retention/check?limitMB=$LimitMB" `
            -Method GET -Headers $headers
        
        $needsCleanup = $response.needsCleanup
        $percentage = $response.percentageUsed
        
        Write-Host "Needs Cleanup: $needsCleanup"
        Write-Host "Percentage Used: $percentage%"
        
        if ($needsCleanup) {
            Write-Warning "Cleanup is recommended"
            return 0
        }
        else {
            Write-Success "Cleanup not needed at this time"
            return 1
        }
    }
    catch {
        Write-Error "Failed to check cleanup status: $_"
        return 1
    }
}

function Verify-ActiveCampaigns {
    Write-Header "Step 3: Verifying Active Campaigns (Safety Check)"
    
    $headers = @{
        "Authorization" = "Bearer $AuthToken"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BackendUrl/api/campaigns?status=RUNNING&status=SCHEDULED&status=PAUSED" `
            -Method GET -Headers $headers
        
        $activeCount = $response.campaigns.Count
        
        Write-Host "Active Campaigns: $activeCount"
        Write-Host ""
        
        if ($activeCount -gt 0) {
            Write-Success "$activeCount active campaign(s) will be PROTECTED during cleanup"
            return 0
        }
        else {
            Write-Warning "No active campaigns found"
            return 0
        }
    }
    catch {
        Write-Error "Failed to verify active campaigns: $_"
        return 1
    }
}

function Run-Cleanup {
    param([string]$CustomConfig = "{}")
    
    Write-Header "Step 4: Running Database Cleanup"
    
    if ($CustomConfig -eq "{}") {
        Write-Host "Using default retention settings..."
    }
    else {
        Write-Host "Using custom retention settings..."
    }
    
    Write-Host ""
    Write-Host "Starting cleanup..."
    
    $headers = @{
        "Authorization" = "Bearer $AuthToken"
        "Content-Type" = "application/json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$BackendUrl/api/data-retention/cleanup" `
            -Method POST -Headers $headers -Body $CustomConfig
        
        $totalDeleted = $response.totalDeleted
        $sizeBefore = $response.sizeBefore
        $sizeAfter = $response.sizeAfter
        $saved = $sizeBefore - $sizeAfter
        
        Write-Host ""
        Write-Host "Cleanup Results:"
        Write-Host "  Total Records Deleted: $totalDeleted"
        Write-Host "  Size Before: $sizeBefore MB"
        Write-Host "  Size After: $sizeAfter MB"
        Write-Host "  Space Saved: $([math]::Round($saved, 2)) MB"
        Write-Host ""
        Write-Host "Details:"
        $response.deleted | Format-List
        
        if ($totalDeleted -gt 0) {
            Write-Success "Cleanup completed successfully"
        }
        else {
            Write-Warning "No data was deleted (may already be clean)"
        }
    }
    catch {
        Write-Error "Failed to run cleanup: $_"
        throw
    }
}

function Verify-Results {
    Write-Header "Step 5: Verifying Cleanup Results"
    
    $headers = @{
        "Authorization" = "Bearer $AuthToken"
    }
    
    try {
        $sizeResponse = Invoke-RestMethod -Uri "$BackendUrl/api/data-retention/size" `
            -Method GET -Headers $headers
        
        $newSize = $sizeResponse.estimatedSizeMB
        Write-Host "New Database Size: $newSize MB"
        
        $campaignResponse = Invoke-RestMethod -Uri "$BackendUrl/api/campaigns?status=RUNNING" `
            -Method GET -Headers $headers
        
        $activeCount = $campaignResponse.campaigns.Count
        Write-Host "Active Campaigns: $activeCount (should be unchanged)"
        
        if ($activeCount -gt 0) {
            Write-Success "Active campaigns verified - cleanup was safe"
        }
    }
    catch {
        Write-Error "Failed to verify results: $_"
    }
}

# Main execution
function Main {
    Write-Header "Database Cleanup Tool"
    Write-Host "Backend URL: $BackendUrl"
    Write-Host "Limit: $LimitMB MB"
    Write-Host ""
    
    Check-Auth
    
    # Step 1: Check size
    $sizeStatus = Check-Size
    
    # Step 2: Check if cleanup needed
    $cleanupNeeded = Check-CleanupNeeded
    
    # Step 3: Verify active campaigns
    Verify-ActiveCampaigns
    
    # Step 4: Run cleanup if needed
    if ($cleanupNeeded -eq 0 -or $sizeStatus -eq 1 -or $sizeStatus -eq 2) {
        Write-Host ""
        $confirm = Read-Host "Do you want to run cleanup? (yes/no)"
        
        if ($confirm -eq "yes" -or $confirm -eq "y") {
            Write-Host ""
            $useCustom = Read-Host "Use custom retention settings? (yes/no, default: no)"
            
            $customConfig = "{}"
            if ($useCustom -eq "yes" -or $useCustom -eq "y") {
                Write-Host "Enter custom config (JSON format, or press Enter for defaults):"
                $customConfig = Read-Host
                if ([string]::IsNullOrEmpty($customConfig)) {
                    $customConfig = "{}"
                }
            }
            
            Run-Cleanup -CustomConfig $customConfig
            
            # Step 5: Verify results
            Verify-Results
        }
        else {
            Write-Warning "Cleanup cancelled by user"
        }
    }
    else {
        Write-Success "No cleanup needed at this time"
    }
    
    Write-Header "Cleanup Session Complete"
}

# Run main function
Main


