"use client";

import { X } from "lucide-react";
import { useState } from "react";

interface EmailBestPracticesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmailBestPracticesModal({ isOpen, onClose }: EmailBestPracticesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-lg shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Email Deliverability Best Practices</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="mt-2 text-blue-100">
            Follow these guidelines to ensure your emails reach the inbox, not spam
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Account Warm-Up */}
          <section>
            <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-2xl">🚀</span>
              Account Warm-Up (Critical for New Accounts)
            </h3>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-gray-700 mb-3">
                <strong>Why it matters:</strong> Gmail builds trust gradually. Sending too many emails too quickly from a new account triggers spam filters.
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li><strong>Week 1:</strong> Send 10-20 emails per day to engaged contacts</li>
                <li><strong>Week 2:</strong> Increase to 30-50 emails per day</li>
                <li><strong>Week 3:</strong> Increase to 50-100 emails per day</li>
                <li><strong>Week 4+:</strong> Gradually increase to your target volume</li>
              </ul>
              <p className="mt-3 text-sm text-gray-600">
                <strong>Tip:</strong> Start with people who know you and are likely to reply. Replies improve your sender reputation!
              </p>
            </div>
          </section>

          {/* Subject Line Guidelines */}
          <section>
            <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-2xl">✉️</span>
              Subject Line Best Practices
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-200 p-4 rounded">
                <h4 className="font-semibold text-green-800 mb-2">✅ DO:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                  <li>Use recipient&apos;s name: &quot;Quick question about {`{{company}}`}&quot;</li>
                  <li>Keep it under 50 characters</li>
                  <li>Be specific and relevant</li>
                  <li>Use question format: "Are you available for a call?"</li>
                  <li>Personalize with merge fields</li>
                </ul>
              </div>
              <div className="bg-red-50 border border-red-200 p-4 rounded">
                <h4 className="font-semibold text-red-800 mb-2">❌ DON'T:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                  <li>Use ALL CAPS</li>
                  <li>Excessive punctuation (!!!, ???)</li>
                  <li>Spam words: "Free", "Act Now", "Limited Time"</li>
                  <li>Special characters: $, !, %, etc.</li>
                  <li>Misleading or clickbait subjects</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Email Content */}
          <section>
            <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-2xl">📝</span>
              Email Content Guidelines
            </h3>
            <div className="space-y-3">
              <div className="bg-gray-50 p-4 rounded border">
                <h4 className="font-semibold text-gray-800 mb-2">Content Quality:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  <li><strong>Text-to-Image Ratio:</strong> Include actual text content, not just images</li>
                  <li><strong>Personalization:</strong> Use merge fields like {`{{firstName}}`}, {`{{company}}`} to personalize</li>
                  <li><strong>Link Quality:</strong> Use reputable domains, avoid URL shorteners</li>
                  <li><strong>Conversational Tone:</strong> Write like you're talking to a friend, not a sales pitch</li>
                  <li><strong>Clear Purpose:</strong> Make it clear why you're reaching out</li>
                </ul>
              </div>
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <p className="text-sm text-gray-700">
                  <strong>💡 Pro Tip:</strong> Ask a question or provide value in your first email. This encourages replies, which significantly improves your sender reputation with Gmail.
                </p>
              </div>
            </div>
          </section>

          {/* Sending Patterns */}
          <section>
            <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-2xl">⏰</span>
              Sending Patterns & Timing
            </h3>
            <div className="bg-purple-50 border border-purple-200 p-4 rounded">
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li><strong>Rate Limiting:</strong> Our system automatically spaces out your emails to avoid triggering spam filters</li>
                <li><strong>Best Times:</strong> Tuesday-Thursday, 9 AM - 2 PM (recipient's timezone)</li>
                <li><strong>Avoid:</strong> Sending large batches all at once</li>
                <li><strong>Gradual Increase:</strong> Increase volume slowly over weeks, not days</li>
                <li><strong>Consistency:</strong> Regular sending activity is better than sporadic bursts</li>
              </ul>
            </div>
          </section>

          {/* Account Health */}
          <section>
            <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-2xl">💚</span>
              Maintain Account Health
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded border">
                <h4 className="font-semibold text-gray-800 mb-2">Key Metrics to Monitor:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  <li><strong>Delivery Rate:</strong> Should be &gt;95%</li>
                  <li><strong>Open Rate:</strong> Should be &gt;20% (indicates inbox placement)</li>
                  <li><strong>Spam Rate:</strong> Should be &lt;0.1%</li>
                  <li><strong>Bounce Rate:</strong> Should be &lt;5%</li>
                  <li><strong>Reply Rate:</strong> Higher is better (indicates engagement)</li>
                </ul>
              </div>
              <div className="bg-gray-50 p-4 rounded border">
                <h4 className="font-semibold text-gray-800 mb-2">Warning Signs:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  <li>High bounce rate (&gt;5%)</li>
                  <li>Low open rate (&lt;10%)</li>
                  <li>High spam complaints</li>
                  <li>Gmail account warnings</li>
                  <li>Emails consistently going to spam</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Engagement Tips */}
          <section>
            <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-2xl">🤝</span>
              Encourage Engagement
            </h3>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-gray-700 mb-3">
                <strong>Why engagement matters:</strong> Gmail tracks how recipients interact with your emails. High engagement = better inbox placement.
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Ask questions that encourage replies</li>
                <li>Make it easy to respond (clear call-to-action)</li>
                <li>Follow up on conversations, not just send one-way messages</li>
                <li>Provide value in every email</li>
                <li>Keep emails conversational and personal</li>
              </ul>
            </div>
          </section>

          {/* Testing & Monitoring */}
          <section>
            <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-2xl">🔍</span>
              Testing & Monitoring
            </h3>
            <div className="bg-indigo-50 border border-indigo-200 p-4 rounded">
              <h4 className="font-semibold text-gray-800 mb-2">Before Sending Campaigns:</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Send test emails to your own Gmail account</li>
                <li>Check if it lands in inbox (not spam)</li>
                <li>If it goes to spam, mark as "Not Spam" and reply to it</li>
                <li>Gradually increase sending volume</li>
                <li>Monitor your metrics in the dashboard</li>
              </ol>
              <div className="mt-4 p-3 bg-white rounded border border-indigo-200">
                <p className="text-sm text-gray-700">
                  <strong>📊 Gmail Postmaster Tools:</strong> Set up at{" "}
                  <a
                    href="https://postmaster.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    postmaster.google.com
                  </a>{" "}
                  to monitor sender reputation, spam rate, and delivery statistics.
                </p>
              </div>
            </div>
          </section>

          {/* Quick Checklist */}
          <section>
            <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <span className="text-2xl">✅</span>
              Quick Checklist Before Sending
            </h3>
            <div className="bg-green-50 border border-green-200 p-4 rounded">
              <ul className="space-y-2">
                {[
                  "Subject line is personalized and under 50 characters",
                  "No spam trigger words in subject or body",
                  "Email includes actual text content (not just images)",
                  `Personalized with merge fields (${`{{firstName}}`}, ${`{{company}}`})`,
                  "Clear, conversational tone",
                  "Asks a question or provides value",
                  "Sending volume is appropriate for account age",
                  "Recipients are valid email addresses",
                  "Test email landed in inbox (not spam)",
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="mt-1"
                      id={`checklist-${index}`}
                    />
                    <label htmlFor={`checklist-${index}`}>{item}</label>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Footer */}
          <div className="border-t pt-4 mt-6">
            <p className="text-sm text-gray-600 text-center">
              Following these best practices will significantly improve your email deliverability and ensure your messages reach the inbox.
              <br />
              <strong>Remember:</strong> Building sender reputation takes time. Be patient and consistent!
            </p>
          </div>
        </div>

        {/* Footer Button */}
        <div className="sticky bottom-0 bg-gray-50 border-t p-4 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Got it! Close
          </button>
        </div>
      </div>
    </div>
  );
}

