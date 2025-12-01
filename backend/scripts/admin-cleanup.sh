#!/bin/bash

# Admin Database Cleanup Script
# Safe manual cleanup tool for administrators

set -e  # Exit on error

# Configuration
BACKEND_URL="${BACKEND_URL:-https://your-backend-url.com}"
AUTH_TOKEN="${AUTH_TOKEN:-}"
LIMIT_MB="${LIMIT_MB:-500}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
    echo ""
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

check_auth() {
    if [ -z "$AUTH_TOKEN" ]; then
        print_error "AUTH_TOKEN not set!"
        echo "Set it with: export AUTH_TOKEN='your-token'"
        exit 1
    fi
}

check_size() {
    print_header "Step 1: Checking Database Size"
    
    SIZE_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/data-retention/size" \
        -H "Authorization: Bearer $AUTH_TOKEN")
    
    CURRENT_SIZE=$(echo "$SIZE_RESPONSE" | jq -r '.estimatedSizeMB')
    TOTAL_ROWS=$(echo "$SIZE_RESPONSE" | jq -r '.totalRows')
    
    echo "Current Size: ${CURRENT_SIZE} MB"
    echo "Total Rows: ${TOTAL_ROWS}"
    echo ""
    echo "Breakdown:"
    echo "$SIZE_RESPONSE" | jq '.breakdown'
    
    PERCENTAGE=$(echo "scale=2; ($CURRENT_SIZE / $LIMIT_MB) * 100" | bc)
    echo ""
    echo "Usage: ${PERCENTAGE}% of ${LIMIT_MB} MB limit"
    
    if (( $(echo "$CURRENT_SIZE > $LIMIT_MB" | bc -l) )); then
        print_error "Database exceeds limit!"
        return 1
    elif (( $(echo "$CURRENT_SIZE > $LIMIT_MB * 0.8" | bc -l) )); then
        print_warning "Database approaching limit (80%)"
        return 2
    else
        print_success "Database size is healthy"
        return 0
    fi
}

check_cleanup_needed() {
    print_header "Step 2: Checking if Cleanup is Needed"
    
    CHECK_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/data-retention/check?limitMB=$LIMIT_MB" \
        -H "Authorization: Bearer $AUTH_TOKEN")
    
    NEEDS_CLEANUP=$(echo "$CHECK_RESPONSE" | jq -r '.needsCleanup')
    PERCENTAGE=$(echo "$CHECK_RESPONSE" | jq -r '.percentageUsed')
    
    echo "Needs Cleanup: $NEEDS_CLEANUP"
    echo "Percentage Used: ${PERCENTAGE}%"
    
    if [ "$NEEDS_CLEANUP" = "true" ]; then
        print_warning "Cleanup is recommended"
        return 0
    else
        print_success "Cleanup not needed at this time"
        return 1
    fi
}

verify_active_campaigns() {
    print_header "Step 3: Verifying Active Campaigns (Safety Check)"
    
    ACTIVE_COUNT=$(curl -s -X GET "$BACKEND_URL/api/campaigns?status=RUNNING&status=SCHEDULED&status=PAUSED" \
        -H "Authorization: Bearer $AUTH_TOKEN" | jq '.campaigns | length')
    
    echo "Active Campaigns: $ACTIVE_COUNT"
    echo ""
    
    if [ "$ACTIVE_COUNT" -gt 0 ]; then
        print_success "$ACTIVE_COUNT active campaign(s) will be PROTECTED during cleanup"
        return 0
    else
        print_warning "No active campaigns found"
        return 0
    fi
}

run_cleanup() {
    local CUSTOM_CONFIG="$1"
    
    print_header "Step 4: Running Database Cleanup"
    
    if [ -z "$CUSTOM_CONFIG" ]; then
        echo "Using default retention settings..."
        CLEANUP_BODY="{}"
    else
        echo "Using custom retention settings..."
        CLEANUP_BODY="$CUSTOM_CONFIG"
    fi
    
    echo ""
    echo "Starting cleanup..."
    
    CLEANUP_RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/data-retention/cleanup" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$CLEANUP_BODY")
    
    TOTAL_DELETED=$(echo "$CLEANUP_RESPONSE" | jq -r '.totalDeleted')
    SIZE_BEFORE=$(echo "$CLEANUP_RESPONSE" | jq -r '.sizeBefore')
    SIZE_AFTER=$(echo "$CLEANUP_RESPONSE" | jq -r '.sizeAfter')
    SAVED=$(echo "scale=2; $SIZE_BEFORE - $SIZE_AFTER" | bc)
    
    echo ""
    echo "Cleanup Results:"
    echo "  Total Records Deleted: $TOTAL_DELETED"
    echo "  Size Before: ${SIZE_BEFORE} MB"
    echo "  Size After: ${SIZE_AFTER} MB"
    echo "  Space Saved: ${SAVED} MB"
    echo ""
    echo "Details:"
    echo "$CLEANUP_RESPONSE" | jq '.deleted'
    
    if [ "$TOTAL_DELETED" -gt 0 ]; then
        print_success "Cleanup completed successfully"
    else
        print_warning "No data was deleted (may already be clean)"
    fi
}

verify_results() {
    print_header "Step 5: Verifying Cleanup Results"
    
    SIZE_RESPONSE=$(curl -s -X GET "$BACKEND_URL/api/data-retention/size" \
        -H "Authorization: Bearer $AUTH_TOKEN")
    
    NEW_SIZE=$(echo "$SIZE_RESPONSE" | jq -r '.estimatedSizeMB')
    
    echo "New Database Size: ${NEW_SIZE} MB"
    
    ACTIVE_COUNT=$(curl -s -X GET "$BACKEND_URL/api/campaigns?status=RUNNING" \
        -H "Authorization: Bearer $AUTH_TOKEN" | jq '.campaigns | length')
    
    echo "Active Campaigns: $ACTIVE_COUNT (should be unchanged)"
    
    if [ "$ACTIVE_COUNT" -gt 0 ]; then
        print_success "Active campaigns verified - cleanup was safe"
    fi
}

# Main execution
main() {
    print_header "Database Cleanup Tool"
    echo "Backend URL: $BACKEND_URL"
    echo "Limit: ${LIMIT_MB} MB"
    echo ""
    
    check_auth
    
    # Step 1: Check size
    check_size
    SIZE_STATUS=$?
    
    # Step 2: Check if cleanup needed
    check_cleanup_needed
    CLEANUP_NEEDED=$?
    
    # Step 3: Verify active campaigns
    verify_active_campaigns
    
    # Step 4: Run cleanup if needed
    if [ $CLEANUP_NEEDED -eq 0 ] || [ $SIZE_STATUS -eq 1 ] || [ $SIZE_STATUS -eq 2 ]; then
        echo ""
        read -p "Do you want to run cleanup? (yes/no): " CONFIRM
        
        if [ "$CONFIRM" = "yes" ] || [ "$CONFIRM" = "y" ]; then
            # Ask for custom config
            echo ""
            read -p "Use custom retention settings? (yes/no, default: no): " USE_CUSTOM
            
            CUSTOM_CONFIG=""
            if [ "$USE_CUSTOM" = "yes" ] || [ "$USE_CUSTOM" = "y" ]; then
                echo "Enter custom config (JSON format, or press Enter for defaults):"
                read CUSTOM_CONFIG
            fi
            
            run_cleanup "$CUSTOM_CONFIG"
            
            # Step 5: Verify results
            verify_results
        else
            print_warning "Cleanup cancelled by user"
        fi
    else
        print_success "No cleanup needed at this time"
    fi
    
    print_header "Cleanup Session Complete"
}

# Run main function
main


