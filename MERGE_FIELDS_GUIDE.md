# Merge Fields Guide

## What are Merge Fields?

Merge fields are placeholders in your email templates that get replaced with actual data from your recipient list when emails are sent. They allow you to personalize each email with recipient-specific information.

## How Merge Fields Work

### Syntax

Merge fields use double curly braces: `{{fieldName}}`

**Examples:**
- `{{firstName}}` - Replaced with the recipient's first name
- `{{company}}` - Replaced with the recipient's company name
- `{{email}}` - Replaced with the recipient's email address
- `{{customField}}` - Replaced with any custom field from your Google Sheet

### How It Works

1. **Import Data**: When you import a Google Sheet, all column headers become available merge fields
2. **Create Template**: Write your email template using `{{columnName}}` placeholders
3. **Automatic Replacement**: When sending, each `{{fieldName}}` is replaced with the actual value from that recipient's row

## Example

### Your Google Sheet Data

| Email | First Name | Company | Role |
|-------|------------|---------|------|
| john@example.com | John | Acme Corp | CEO |
| jane@example.com | Jane | Tech Inc | CTO |

### Your Email Template

**Subject:**
```
Quick question about {{company}}
```

**Body:**
```html
<p>Hi {{firstName}},</p>
<p>I noticed you're the {{role}} at {{company}}. I'd love to connect!</p>
<p>Best regards,<br/>Your Name</p>
```

### What Each Recipient Receives

**Email 1 (John):**
- **Subject:** `Quick question about Acme Corp`
- **Body:** 
  ```html
  <p>Hi John,</p>
  <p>I noticed you're the CEO at Acme Corp. I'd love to connect!</p>
  <p>Best regards,<br/>Your Name</p>
  ```

**Email 2 (Jane):**
- **Subject:** `Quick question about Tech Inc`
- **Body:**
  ```html
  <p>Hi Jane,</p>
  <p>I noticed you're the CTO at Tech Inc. I'd love to connect!</p>
  <p>Best regards,<br/>Your Name</p>
  ```

## Available Merge Fields

### From Your Google Sheet

All column headers from your imported Google Sheet become merge fields. For example:
- If your sheet has a column named "First Name", use `{{First Name}}`
- If your sheet has a column named "Company Name", use `{{Company Name}}`
- Column names are case-sensitive and must match exactly (including spaces)

### Common Merge Fields

Based on typical Google Sheets, you might have:
- `{{firstName}}` or `{{First Name}}`
- `{{lastName}}` or `{{Last Name}}`
- `{{company}}` or `{{Company}}`
- `{{email}}` or `{{Email}}`
- `{{title}}` or `{{Title}}`
- `{{phone}}` or `{{Phone}}`
- Any other column from your sheet

## How to Use Merge Fields

### In the Extension

1. **Import your Google Sheet** - All column headers become available merge fields
2. **Type `{{` in the subject or body** - You'll see autocomplete suggestions
3. **Select a merge field** - Or type the column name manually
4. **Preview** - Use the preview feature to see how it looks for different recipients

### In the Webapp

1. **Import your Google Sheet** - Available merge fields appear as clickable buttons
2. **Click a merge field button** - It inserts `{{fieldName}}` into your template
3. **Or type manually** - Type `{{fieldName}}` directly
4. **Preview** - Preview shows how the email looks for each recipient

## Best Practices

### 1. Use Descriptive Column Names

**Good:**
- `First Name`
- `Company Name`
- `Job Title`

**Bad:**
- `col1`
- `data`
- `field1`

### 2. Match Column Names Exactly

Merge fields are case-sensitive and must match column headers exactly:
- ✅ `{{First Name}}` matches column "First Name"
- ❌ `{{firstname}}` does NOT match "First Name"
- ❌ `{{FirstName}}` does NOT match "First Name"

### 3. Handle Missing Data

If a merge field doesn't exist in a recipient's data:
- The placeholder is replaced with an empty string
- Example: `{{customField}}` → `""` (nothing)

**Tip:** Always test with a few recipients to ensure merge fields work correctly.

### 4. Use Merge Fields in Both Subject and Body

Personalize both the subject line and email body for better engagement:

**Subject:**
```
{{firstName}}, quick question about {{company}}
```

**Body:**
```html
<p>Hi {{firstName}},</p>
<p>I saw that {{company}} is looking for solutions in your industry.</p>
```

### 5. Combine with HTML

Merge fields work with HTML formatting:

```html
<p>Hi <strong>{{firstName}}</strong>,</p>
<p>Welcome to <em>{{company}}</em>!</p>
<a href="https://example.com/{{company}}">Visit {{company}}'s page</a>
```

## Technical Details

### How Replacement Works

1. **Pattern Matching**: The system finds all `{{fieldName}}` patterns in your template
2. **Data Lookup**: For each recipient, it looks up the value in their row data
3. **Replacement**: The placeholder is replaced with the actual value (or empty string if not found)
4. **Cleaning**: Values are trimmed of whitespace

### Code Implementation

**Backend (`campaignEngine.ts`):**
```typescript
const renderTemplate = (template: string, data: RecipientRecord) => {
  return template.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key: string) => {
    const value = data[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    return "";
  });
};
```

**Pattern:** `/{{\s*([\w.-]+)\s*}}/g`
- `{{` - Opening braces
- `\s*` - Optional whitespace
- `([\w.-]+)` - Field name (letters, numbers, dots, hyphens)
- `\s*` - Optional whitespace
- `}}` - Closing braces
- `g` - Global flag (replace all occurrences)

### Supported Characters

Merge field names can contain:
- Letters (a-z, A-Z)
- Numbers (0-9)
- Dots (.)
- Hyphens (-)
- Underscores (_)
- Spaces (but must match column header exactly)

## Common Issues and Solutions

### Issue: Merge field not replacing

**Possible causes:**
1. Column name doesn't match exactly (case-sensitive)
2. Column has extra spaces
3. Column name has special characters not supported

**Solution:**
- Check the exact column name in your Google Sheet
- Use the merge field buttons/autocomplete to ensure exact match
- Preview the email to verify replacement

### Issue: Empty values

**Possible causes:**
1. Cell is empty in Google Sheet
2. Column name mismatch

**Solution:**
- Ensure all cells have data
- Use conditional text: `{{firstName}}` or "there" if firstName is empty (requires template logic)

### Issue: Special characters in column names

**Solution:**
- Use simple column names: `FirstName` instead of `First Name (Required)`
- Or match exactly: `{{First Name (Required)}}` if that's your column name

## Examples

### Example 1: Basic Personalization

**Sheet Columns:** `Email`, `Name`, `Company`

**Template:**
```
Subject: Hi {{Name}}, quick question

Body:
<p>Hi {{Name}},</p>
<p>I wanted to reach out about {{Company}}.</p>
```

### Example 2: Advanced Personalization

**Sheet Columns:** `Email`, `First Name`, `Last Name`, `Company`, `Industry`, `LinkedIn`

**Template:**
```
Subject: {{First Name}}, let's connect about {{Industry}}

Body:
<p>Hi {{First Name}},</p>
<p>I noticed {{Company}} is in the {{Industry}} space.</p>
<p>I'd love to connect! Here's my LinkedIn: <a href="{{LinkedIn}}">Connect</a></p>
```

### Example 3: With HTML Formatting

**Template:**
```html
<div style="font-family: Arial, sans-serif;">
  <h2>Welcome, {{firstName}}!</h2>
  <p>Your company <strong>{{company}}</strong> has been selected.</p>
  <p>Contact us at: <a href="mailto:{{email}}">{{email}}</a></p>
</div>
```

## Tips for Better Personalization

1. **Use recipient's name** - Always include `{{firstName}}` or `{{name}}` in the greeting
2. **Reference their company** - Mention `{{company}}` to show you researched them
3. **Use their title/role** - Reference `{{title}}` or `{{role}}` for relevance
4. **Keep it natural** - Don't overuse merge fields; make it sound conversational
5. **Test thoroughly** - Preview with multiple recipients to catch issues

## Summary

- **Merge fields** = `{{columnName}}` placeholders that get replaced with actual data
- **Source**: Column headers from your imported Google Sheet
- **Usage**: Works in both subject lines and email body (HTML)
- **Replacement**: Happens automatically when emails are sent
- **Case-sensitive**: Must match column names exactly
- **Empty values**: Replaced with empty string if data is missing

Merge fields are the key to personalizing your email campaigns at scale!

