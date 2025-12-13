# How to Send Emails Using TaskForce External API

## ✅ Yes, You Can Send Emails!

The TaskForce External API allows you to send emails through **campaigns**. Here's how:

## Method 1: Create Campaign and Schedule Immediately

### Step 1: Create a Campaign

**Endpoint:** `POST /api/v1/campaigns`

**Request:**
```json
{
  "name": "My Email Campaign",
  "recipients": {
    "emailField": "email",
    "rows": [
      {
        "email": "recipient1@example.com",
        "name": "John Doe",
        "company": "Acme Corp"
      },
      {
        "email": "recipient2@example.com",
        "name": "Jane Smith",
        "company": "Tech Inc"
      }
    ]
  },
  "strategy": {
    "startAt": "2025-12-13T13:30:00.000Z",  // Set to current time for immediate send
    "delayMsBetweenEmails": 30000,  // 30 seconds between each email
    "trackOpens": true,
    "trackClicks": true,
    "template": {
      "subject": "Hello {{name}} from {{company}}",
      "html": "<h1>Hello {{name}}!</h1><p>This is a test email for {{company}}.</p>",
      "attachments": []  // Optional: base64 encoded attachments
    }
  }
}
```

**cURL Example:**
```bash
curl -X POST "https://taskforce-backend-production.up.railway.app/api/v1/campaigns" \
  -H "X-API-Key: tf_live_6b26d2a14e7f025fc40e323950005b58f969ed5030090ba3ca57aa6b7cd767e2" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Email Campaign",
    "recipients": {
      "emailField": "email",
      "rows": [
        {
          "email": "recipient1@example.com",
          "name": "John Doe",
          "company": "Acme Corp"
        }
      ]
    },
    "strategy": {
      "startAt": "2025-12-13T13:30:00.000Z",
      "delayMsBetweenEmails": 30000,
      "trackOpens": true,
      "trackClicks": true,
      "template": {
        "subject": "Hello {{name}}",
        "html": "<h1>Hello {{name}}!</h1><p>This is a test email.</p>"
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "campaign_id_here",
    "name": "My Email Campaign",
    "status": "DRAFT",
    "recipientCount": 2,
    "createdAt": "2025-12-13T13:30:00.000Z"
  },
  "meta": {
    "timestamp": "2025-12-13T13:30:00.000Z"
  }
}
```

### Step 2: Schedule the Campaign (to start sending)

**Endpoint:** `POST /api/v1/campaigns/:id/schedule`

**Request:**
```json
{
  "startAt": "2025-12-13T13:30:00.000Z"  // Current time or future time
}
```

**cURL Example:**
```bash
curl -X POST "https://taskforce-backend-production.up.railway.app/api/v1/campaigns/CAMPAIGN_ID/schedule" \
  -H "X-API-Key: tf_live_6b26d2a14e7f025fc40e323950005b58f969ed5030090ba3ca57aa6b7cd767e2" \
  -H "Content-Type: application/json" \
  -d '{
    "startAt": "2025-12-13T13:30:00.000Z"
  }'
```

## Method 2: Create Campaign with Immediate Start

You can also set `startAt` to the current time when creating the campaign, and it will start sending immediately after scheduling:

```json
{
  "name": "Immediate Campaign",
  "recipients": {
    "emailField": "email",
    "rows": [{"email": "test@example.com", "name": "Test"}]
  },
  "strategy": {
    "startAt": "2025-12-13T13:30:00.000Z",  // Current time
    "delayMsBetweenEmails": 30000,
    "template": {
      "subject": "Test Email",
      "html": "<p>Hello!</p>"
    }
  }
}
```

Then schedule it immediately:
```bash
POST /api/v1/campaigns/{campaignId}/schedule
{
  "startAt": "2025-12-13T13:30:00.000Z"  // Same time or slightly later
}
```

## Template Variables

You can use merge fields in your email template:
- `{{email}}` - Recipient email
- `{{name}}` - From recipient payload
- `{{company}}` - From recipient payload
- Any custom field from the `rows` data

**Example:**
```json
{
  "recipients": {
    "emailField": "email",
    "rows": [
      {
        "email": "john@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "company": "Acme Corp",
        "customField": "value"
      }
    ]
  },
  "strategy": {
    "template": {
      "subject": "Hello {{firstName}} {{lastName}}",
      "html": "<p>Hi {{firstName}},</p><p>Welcome to {{company}}!</p><p>Custom: {{customField}}</p>"
    }
  }
}
```

## Email Features

### Attachments (Optional)
```json
{
  "strategy": {
    "template": {
      "subject": "Email with attachment",
      "html": "<p>See attached file</p>",
      "attachments": [
        {
          "filename": "document.pdf",
          "content": "base64_encoded_file_content_here",
          "contentType": "application/pdf"
        }
      ]
    }
  }
}
```

### Tracking
- `trackOpens: true` - Track when emails are opened
- `trackClicks: true` - Track when links are clicked

### Delay Between Emails
- `delayMsBetweenEmails: 30000` - Wait 30 seconds between each email
- Prevents rate limiting and looks more natural

## Complete Example: Send Email Now

```bash
# 1. Create campaign
CAMPAIGN_RESPONSE=$(curl -X POST "https://taskforce-backend-production.up.railway.app/api/v1/campaigns" \
  -H "X-API-Key: tf_live_6b26d2a14e7f025fc40e323950005b58f969ed5030090ba3ca57aa6b7cd767e2" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Quick Test Email",
    "recipients": {
      "emailField": "email",
      "rows": [
        {
          "email": "test@example.com",
          "name": "Test User"
        }
      ]
    },
    "strategy": {
      "startAt": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
      "delayMsBetweenEmails": 10000,
      "trackOpens": true,
      "trackClicks": true,
      "template": {
        "subject": "Test Email from API",
        "html": "<h1>Hello {{name}}!</h1><p>This email was sent via TaskForce API.</p>"
      }
    }
  }')

# Extract campaign ID (you'll need to parse the JSON)
CAMPAIGN_ID="extracted_from_response"

# 2. Schedule campaign to start sending
curl -X POST "https://taskforce-backend-production.up.railway.app/api/v1/campaigns/$CAMPAIGN_ID/schedule" \
  -H "X-API-Key: tf_live_6b26d2a14e7f025fc40e323950005b58f969ed5030090ba3ca57aa6b7cd767e2" \
  -H "Content-Type: application/json" \
  -d "{
    \"startAt\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"
  }"
```

## JavaScript/TypeScript Example

```javascript
const API_KEY = 'tf_live_6b26d2a14e7f025fc40e323950005b58f969ed5030090ba3ca57aa6b7cd767e2';
const API_URL = 'https://taskforce-backend-production.up.railway.app/api/v1';

async function sendEmail(recipientEmail, recipientName) {
  // 1. Create campaign
  const campaignResponse = await fetch(`${API_URL}/campaigns`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `Email to ${recipientName}`,
      recipients: {
        emailField: 'email',
        rows: [{
          email: recipientEmail,
          name: recipientName,
        }],
      },
      strategy: {
        startAt: new Date().toISOString(),
        delayMsBetweenEmails: 10000,
        trackOpens: true,
        trackClicks: true,
        template: {
          subject: `Hello ${recipientName}!`,
          html: `<h1>Hello ${recipientName}!</h1><p>This is a test email.</p>`,
        },
      },
    }),
  });

  const campaign = await campaignResponse.json();
  const campaignId = campaign.data.id;

  // 2. Schedule campaign to start sending
  await fetch(`${API_URL}/campaigns/${campaignId}/schedule`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startAt: new Date().toISOString(),
    }),
  });

  return campaignId;
}

// Usage
sendEmail('test@example.com', 'John Doe')
  .then(campaignId => console.log('Campaign created:', campaignId))
  .catch(error => console.error('Error:', error));
```

## Python Example

```python
import requests
from datetime import datetime

API_KEY = 'tf_live_6b26d2a14e7f025fc40e323950005b58f969ed5030090ba3ca57aa6b7cd767e2'
API_URL = 'https://taskforce-backend-production.up.railway.app/api/v1'

def send_email(recipient_email, recipient_name):
    headers = {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
    }
    
    # 1. Create campaign
    campaign_data = {
        'name': f'Email to {recipient_name}',
        'recipients': {
            'emailField': 'email',
            'rows': [{
                'email': recipient_email,
                'name': recipient_name,
            }],
        },
        'strategy': {
            'startAt': datetime.utcnow().isoformat() + 'Z',
            'delayMsBetweenEmails': 10000,
            'trackOpens': True,
            'trackClicks': True,
            'template': {
                'subject': f'Hello {recipient_name}!',
                'html': f'<h1>Hello {recipient_name}!</h1><p>This is a test email.</p>',
            },
        },
    }
    
    response = requests.post(
        f'{API_URL}/campaigns',
        headers=headers,
        json=campaign_data,
    )
    campaign = response.json()
    campaign_id = campaign['data']['id']
    
    # 2. Schedule campaign
    schedule_data = {
        'startAt': datetime.utcnow().isoformat() + 'Z',
    }
    requests.post(
        f'{API_URL}/campaigns/{campaign_id}/schedule',
        headers=headers,
        json=schedule_data,
    )
    
    return campaign_id

# Usage
campaign_id = send_email('test@example.com', 'John Doe')
print(f'Campaign created: {campaign_id}')
```

## Important Notes

1. **Campaign-Based**: Emails are sent through campaigns, not as individual sends
2. **Scheduling Required**: After creating a campaign, you must schedule it to start sending
3. **Delay Between Emails**: Set `delayMsBetweenEmails` to avoid rate limiting (minimum 10-30 seconds recommended)
4. **Template Variables**: Use `{{variableName}}` syntax for personalization
5. **Gmail Account Required**: The backend uses Gmail API, so you need to authenticate a Gmail account first (via webapp or extension)
6. **Rate Limits**: Be mindful of Gmail's sending limits (500 emails/day for free accounts)

## Check Campaign Status

After scheduling, you can check the campaign status:

```bash
curl -X GET "https://taskforce-backend-production.up.railway.app/api/v1/campaigns/{campaignId}" \
  -H "X-API-Key: tf_live_6b26d2a14e7f025fc40e323950005b58f969ed5030090ba3ca57aa6b7cd767e2"
```

## Summary

✅ **Yes, you can send emails using the API!**

The process is:
1. Create a campaign with recipients and email template
2. Schedule the campaign to start sending
3. Emails will be sent automatically with the specified delay between each

This approach allows for:
- Bulk email sending
- Personalized emails with merge fields
- Tracking (opens, clicks)
- Scheduled sending
- Campaign management


