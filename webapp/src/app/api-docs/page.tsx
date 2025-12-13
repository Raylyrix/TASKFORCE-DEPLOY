"use client";

import Layout from "@/components/Layout";
import { Code, Key, Book, Zap, Shield, Globe } from "lucide-react";
import { useState } from "react";

export default function ApiDocsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  const codeExample = `// Example: Create a campaign
const response = await fetch('https://taskforce-backend-production.up.railway.app/api/v1/campaigns', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'tf_live_your_api_key_here'
  },
  body: JSON.stringify({
    name: 'Welcome Campaign',
    recipients: {
      emailField: 'email',
      rows: [
        { email: 'user@example.com', name: 'John Doe' }
      ]
    },
    strategy: {
      delayMsBetweenEmails: 30000,
      trackOpens: true,
      trackClicks: true,
      template: {
        subject: 'Welcome {{name}}!',
        html: '<h1>Hello {{name}}</h1><p>Welcome to our service!</p>'
      }
    }
  })
});

const data = await response.json();
console.log(data);`;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto py-12 px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            TaskForce API Documentation
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Integrate TaskForce email campaigns into your applications
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
          <nav className="flex space-x-8">
            {[
              { id: "overview", label: "Overview", icon: Book },
              { id: "authentication", label: "Authentication", icon: Key },
              { id: "endpoints", label: "Endpoints", icon: Code },
              { id: "examples", label: "Examples", icon: Zap },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? "border-primary-500 text-primary-600 dark:text-primary-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  What is the TaskForce API?
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  The TaskForce API allows you to programmatically manage email campaigns, contacts, and analytics
                  from your own applications. Perfect for integrations with CRM systems, marketing automation platforms,
                  e-commerce stores, and custom business applications.
                </p>
                <div className="grid md:grid-cols-3 gap-4 mt-6">
                  <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                    <Globe className="w-6 h6 text-primary-600 mb-2" />
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">RESTful API</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Standard HTTP methods and JSON responses
                    </p>
                  </div>
                  <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                    <Shield className="w-6 h-6 text-primary-600 mb-2" />
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Secure</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      API key authentication with scoped permissions
                    </p>
                  </div>
                  <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                    <Zap className="w-6 h-6 text-primary-600 mb-2" />
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Easy Integration</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Simple endpoints with comprehensive documentation
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  Base URL
                </h2>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <code className="text-primary-600 dark:text-primary-400 font-mono">
                    https://taskforce-backend-production.up.railway.app/api/v1
                  </code>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  All API requests should be made to this base URL with the appropriate endpoint path.
                </p>
              </section>

              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  Response Format
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  All API responses follow a consistent format:
                </p>
                <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <code className="text-sm text-gray-800 dark:text-gray-200">
{`{
  "success": true,
  "data": {
    // Response data here
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z"
  }
}`}
                  </code>
                </pre>
              </section>
            </div>
          )}

          {/* Authentication Tab */}
          {activeTab === "authentication" && (
            <div className="space-y-8">
              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  API Key Authentication
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  All API requests require an API key in the <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">X-API-Key</code> header.
                </p>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
                  <code className="text-sm text-gray-800 dark:text-gray-200">
                    X-API-Key: tf_live_your_api_key_here
                  </code>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Important:</strong> Keep your API keys secure. Never commit them to version control or expose them in client-side code.
                  </p>
                </div>
              </section>

              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  Creating API Keys
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  You can create API keys from your account settings. Each key can have specific scopes and permissions:
                </p>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4">
                  <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">campaigns:read</code> - View campaigns</li>
                  <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">campaigns:write</code> - Create/update campaigns</li>
                  <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">contacts:read</code> - View contacts</li>
                  <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">analytics:read</code> - View analytics</li>
                  <li><code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">*</code> - All permissions</li>
                </ul>
              </section>

              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  Rate Limits
                </h2>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Rate limits vary by tier:
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tier</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Limit</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">Free</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">1,000 requests/day</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">Starter</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">10,000 requests/day</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">Professional</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">100,000 requests/day</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">Enterprise</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">Custom limits</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* Endpoints Tab */}
          {activeTab === "endpoints" && (
            <div className="space-y-8">
              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  Campaigns
                </h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold rounded">GET</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/campaigns</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">List all campaigns</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold rounded">GET</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/campaigns/:id</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Get campaign details</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold rounded">POST</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/campaigns</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Create a new campaign</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold rounded">POST</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/campaigns/:id/schedule</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Schedule a campaign</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold rounded">POST</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/campaigns/:id/pause</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Pause a running campaign</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold rounded">POST</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/campaigns/:id/resume</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Resume a paused campaign</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs font-semibold rounded">POST</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/campaigns/:id/cancel</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Cancel a campaign</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold rounded">GET</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/campaigns/:id/analytics</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Get campaign analytics</p>
                  </div>
                </div>
              </section>

              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  Contacts
                </h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold rounded">GET</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/contacts</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">List all contacts</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold rounded">GET</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/contacts/:email</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Get contact details and activity</p>
                  </div>
                </div>
              </section>

              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  Analytics
                </h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold rounded">GET</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/analytics</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Get user analytics and metrics</p>
                  </div>
                </div>
              </section>

              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  API Keys
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  API key management endpoints require user authentication (X-User-Id header) rather than API key authentication.
                </p>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold rounded">GET</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/api-keys</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">List all API keys for the authenticated user</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold rounded">GET</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/api-keys/:id</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Get API key details</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold rounded">POST</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/api-keys</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Create a new API key</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs font-semibold rounded">PUT</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/api-keys/:id</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Update an API key</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs font-semibold rounded">DELETE</span>
                      <code className="text-sm text-gray-800 dark:text-gray-200">/v1/api-keys/:id</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Revoke an API key</p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* Examples Tab */}
          {activeTab === "examples" && (
            <div className="space-y-8">
              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  JavaScript Example
                </h2>
                <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <code className="text-sm text-gray-800 dark:text-gray-200">{codeExample}</code>
                </pre>
              </section>

              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  cURL Example
                </h2>
                <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <code className="text-sm text-gray-800 dark:text-gray-200">
{`curl -X POST https://taskforce-backend-production.up.railway.app/api/v1/campaigns \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: tf_live_your_api_key_here" \\
  -d '{
    "name": "Welcome Campaign",
    "recipients": {
      "emailField": "email",
      "rows": [
        {"email": "user@example.com", "name": "John Doe"}
      ]
    },
    "strategy": {
      "template": {
        "subject": "Welcome {{name}}!",
        "html": "<h1>Hello {{name}}</h1>"
      }
    }
  }'`}
                  </code>
                </pre>
              </section>

              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
                  Python Example
                </h2>
                <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
                  <code className="text-sm text-gray-800 dark:text-gray-200">
{`import requests

url = "https://taskforce-backend-production.up.railway.app/api/v1/campaigns"
headers = {
    "Content-Type": "application/json",
    "X-API-Key": "tf_live_your_api_key_here"
}
data = {
    "name": "Welcome Campaign",
    "recipients": {
        "emailField": "email",
        "rows": [
            {"email": "user@example.com", "name": "John Doe"}
        ]
    },
    "strategy": {
        "template": {
            "subject": "Welcome {{name}}!",
            "html": "<h1>Hello {{name}}</h1>"
        }
    }
}

response = requests.post(url, json=data, headers=headers)
print(response.json())`}
                  </code>
                </pre>
              </section>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 bg-primary-50 dark:bg-primary-900/20 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Ready to get started?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create your first API key and start integrating TaskForce into your applications.
          </p>
          <a
            href="/settings"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            <Key className="w-5 h-5" />
            Go to Settings
          </a>
        </div>
      </div>
    </Layout>
  );
}





