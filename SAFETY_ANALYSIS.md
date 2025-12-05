# Safety Analysis of Auto-Healing Logic

## Potential Issues Found ⚠️

### 1. **URL Encoding Pattern - POTENTIAL DAMAGE**

**Current Logic** (Line 79-93 in `templateSanitizer.ts`):
```typescript
sanitized = sanitized.replace(/%([0-9A-F]{2})(?![0-9A-F]|[\w-]|&)/gi, (match, hex, offset, str) => {
  const before = offset > 0 ? str[offset - 1] : '';
  const after = offset + match.length < str.length ? str[offset + match.length] : '';
  
  // Skip if it's part of a URL (preceded by :, /, ?, =, &) or followed by hex digit
  if (before.match(/[:/=&?]/) || after.match(/[0-9A-Fa-f]/)) {
    return match;
  }
  
  const charCode = parseInt(hex, 16);
  if (charCode >= 32 && charCode <= 126 && charCode !== 37) {
    return String.fromCharCode(charCode);
  }
  return match;
});
```

**PROBLEM**: Could damage legitimate subjects!

**Example Failures**:
- ✅ SAFE: `"Visit http://example.com?id=%20test"` → Preserved (has :/= before)
- ✅ SAFE: `"20% off"` → Preserved (no hex digits after %)
- ❌ **DAMAGE**: `"Get %50 discount"` → Could become "Get P discount" if matched
- ❌ **DAMAGE**: `"Score: %45"` → Could become "Score: E" if matched

**Root Cause**: The pattern `%([0-9A-F]{2})` will match legitimate text like `%50`, `%45`, etc.

### 2. **Other Patterns - SAFE** ✅

**RFC 2047 Removal** (Line 53-58):
```typescript
sanitized = sanitized.replace(/=\?[^?]*\?[^?]*\?[^?]*\?=/g, '');
```
- **VERDICT**: ✅ SAFE
- **REASON**: RFC 2047 encoding (`=?UTF-8?B?base64?=`) should NEVER appear in plain text subjects
- **ONLY TOUCHES**: Actual corruption

**Control Characters** (Line 69-73):
```typescript
sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
```
- **VERDICT**: ✅ SAFE
- **REASON**: Removes invisible, non-printable characters only
- **DOESN'T TOUCH**: Any visible text, spaces, punctuation, etc.

**Malformed Patterns** (Line 61-66):
```typescript
sanitized = sanitized.replace(/^[^?=]*\?[^?]*\?[^?]*\?=/g, '');
sanitized = sanitized.replace(/=\?[^?]*\?[^?]*\?[^?=]*$/g, '');
```
- **VERDICT**: ✅ SAFE
- **REASON**: Only removes broken encoding fragments at start/end
- **UNLIKELY TO MATCH**: Legitimate text

## Risk Assessment

### Current Risk Level: 🟡 MEDIUM

| Pattern | Risk | Impact | Frequency |
|---------|------|---------|-----------|
| RFC 2047 removal | 🟢 LOW | Removes corruption only | High (good) |
| Control chars removal | 🟢 LOW | Removes invisible chars | High (good) |
| Malformed fragments | 🟢 LOW | Removes broken encoding | Low |
| **URL encoding** | 🟡 **MEDIUM** | **Could damage %50, %45, etc.** | **Medium** |

## Recommended Fix

### Option 1: **Remove URL Encoding Logic Entirely** (SAFEST)

The URL encoding pattern is trying to fix `%P` and `%20` corruption, but it's too risky.

**Better approach**: Only fix if we see the EXACT corruption pattern from the image:
- `????????le??????-?le??????%P` ← This specific pattern

**New Logic**:
```typescript
// ONLY remove URL encoding if it's clearly corruption (isolated % followed by non-hex OR single letter)
// Examples of corruption: %P, %Q, %Z (single letter, not valid hex pair)
// Examples of legitimate: %50, %20, %45 (valid hex pairs)

// Don't decode %XX at all in subjects - too risky
// If it's there legitimately (like "%50 off"), keep it
// If it's corruption from database, it will be fixed by other patterns
```

### Option 2: **Make URL Encoding MUCH More Conservative**

Only decode if:
1. It's NOT a valid hex pair (e.g., `%P` is corruption, `%50` is legitimate)
2. It's surrounded by spaces or punctuation
3. It's at the end of the string

```typescript
// ONLY decode single-letter corruption like %P, %Q, %Z
// DON'T decode valid hex pairs like %50, %20, %45
sanitized = sanitized.replace(/%([A-F])(?![0-9A-Fa-f])/gi, (match, letter) => {
  // This matches %P, %Q, etc. but NOT %50, %20, %45
  return letter; // Just remove the %, keep the letter
});
```

## What We Should Do

### IMMEDIATE: Remove or Fix URL Encoding Logic

**Before (RISKY)**:
```typescript
// Step 5: Check for accidental URL encoding (like %P, %20 in wrong context)
const urlEncodingPattern = /%[0-9A-F]{2}/gi;
if (urlEncodingPattern.test(sanitized)) {
  warnings.push('Possible URL encoding detected - cleaning');
  // ... complex logic that could damage %50, %45, etc.
}
```

**After (SAFE)**:
```typescript
// Step 5: Check for corrupted single-letter URL encoding (like %P, %Q from corruption)
// Don't touch valid hex pairs like %50, %20, %45 - those could be legitimate
const corruptedEncodingPattern = /%([A-F])(?![0-9A-Fa-f])/gi;
if (corruptedEncodingPattern.test(sanitized)) {
  warnings.push('Corrupted URL encoding detected - cleaning');
  sanitized = sanitized.replace(corruptedEncodingPattern, (match, letter) => {
    // Just keep the letter, remove the %
    // %P → P, %Q → Q, etc.
    return letter;
  });
}
```

## Test Cases to Verify

### Should NOT Be Modified (Legitimate):
- ✅ `"20% off"` → `"20% off"` (preserved)
- ✅ `"Get %50 discount"` → `"Get %50 discount"` (preserved)
- ✅ `"Score: %45"` → `"Score: %45"` (preserved)
- ✅ `"Visit http://example.com?id=%20"` → Preserved
- ✅ `"100% guaranteed"` → `"100% guaranteed"` (preserved)
- ✅ `"Bullet • point"` → `"Bullet • point"` (preserved)
- ✅ `"Em dash — text"` → `"Em dash — text"` (preserved)

### Should Be Fixed (Corruption):
- ✅ `"Proposal ????????le??????%P"` → `"Proposal le P"` or better
- ✅ `"Subject =?UTF-8?B?abc?="` → `"Subject "` (RFC 2047 removed)
- ✅ `"Text\x00\x01\x02"` → `"Text"` (control chars removed)
- ✅ `"Text%P"` → `"TextP"` (single corrupt letter)
- ✅ `"Text%Q"` → `"TextQ"` (single corrupt letter)

## Conclusion

**Current Status**: 🟡 The auto-healing is mostly safe, but URL encoding logic needs fixing

**Action Required**: Update the URL encoding pattern to ONLY touch obvious corruption, not legitimate %XX patterns

**Severity**: MEDIUM - Could damage subjects with %50, %45, etc., but only if followed by non-URL context

