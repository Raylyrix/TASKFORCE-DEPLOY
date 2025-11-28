interface EmailBestPracticesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmailBestPracticesModal({ isOpen, onClose }: EmailBestPracticesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "56rem",
          maxHeight: "90vh",
          overflowY: "auto",
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "linear-gradient(to right, #2563eb, #1d4ed8)",
            color: "white",
            padding: "24px",
            borderRadius: "8px 8px 0 0",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: "24px", fontWeight: "bold", margin: 0 }}>
              Email Deliverability Best Practices
            </h2>
            <button
              onClick={onClose}
              style={{
                padding: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                border: "none",
                borderRadius: "50%",
                cursor: "pointer",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label="Close"
            >
              <span style={{ fontSize: "20px" }}>✕</span>
            </button>
          </div>
          <p style={{ marginTop: "8px", color: "#bfdbfe", fontSize: "14px" }}>
            Follow these guidelines to ensure your emails reach the inbox, not spam
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Account Warm-Up */}
          <section>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#1f2937",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "24px" }}>🚀</span>
              Account Warm-Up (Critical for New Accounts)
            </h3>
            <div
              style={{
                backgroundColor: "#eff6ff",
                borderLeft: "4px solid #3b82f6",
                padding: "16px",
                borderRadius: "4px",
              }}
            >
              <p style={{ color: "#1e40af", marginBottom: "12px" }}>
                <strong>Why it matters:</strong> Gmail builds trust gradually. Sending too many emails too quickly from a new account triggers spam filters.
              </p>
              <ul style={{ listStyle: "disc", paddingLeft: "20px", color: "#1e40af", display: "flex", flexDirection: "column", gap: "8px" }}>
                <li><strong>Week 1:</strong> Send 10-20 emails per day to engaged contacts</li>
                <li><strong>Week 2:</strong> Increase to 30-50 emails per day</li>
                <li><strong>Week 3:</strong> Increase to 50-100 emails per day</li>
                <li><strong>Week 4+:</strong> Gradually increase to your target volume</li>
              </ul>
              <p style={{ marginTop: "12px", fontSize: "14px", color: "#1e3a8a" }}>
                <strong>Tip:</strong> Start with people who know you and are likely to reply. Replies improve your sender reputation!
              </p>
            </div>
          </section>

          {/* Subject Line Guidelines */}
          <section>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#1f2937",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "24px" }}>✉️</span>
              Subject Line Best Practices
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div
                style={{
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #86efac",
                  padding: "16px",
                  borderRadius: "4px",
                }}
              >
                <h4 style={{ fontWeight: 600, color: "#166534", marginBottom: "8px" }}>✅ DO:</h4>
                <ul style={{ listStyle: "disc", paddingLeft: "20px", fontSize: "14px", color: "#15803d", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <li>Use recipient&apos;s name: &quot;Quick question about {`{{company}}`}&quot;</li>
                  <li>Keep it under 50 characters</li>
                  <li>Be specific and relevant</li>
                  <li>Use question format: &quot;Are you available for a call?&quot;</li>
                  <li>Personalize with merge fields</li>
                </ul>
              </div>
              <div
                style={{
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fca5a5",
                  padding: "16px",
                  borderRadius: "4px",
                }}
              >
                <h4 style={{ fontWeight: 600, color: "#991b1b", marginBottom: "8px" }}>❌ DON&apos;T:</h4>
                <ul style={{ listStyle: "disc", paddingLeft: "20px", fontSize: "14px", color: "#b91c1c", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <li>Use ALL CAPS</li>
                  <li>Excessive punctuation (!!!, ???)</li>
                  <li>Spam words: &quot;Free&quot;, &quot;Act Now&quot;, &quot;Limited Time&quot;</li>
                  <li>Special characters: $, !, %, etc.</li>
                  <li>Misleading or clickbait subjects</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Email Content */}
          <section>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#1f2937",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "24px" }}>📝</span>
              Email Content Guidelines
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div
                style={{
                  backgroundColor: "#f9fafb",
                  padding: "16px",
                  borderRadius: "4px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <h4 style={{ fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>Content Quality:</h4>
                <ul style={{ listStyle: "disc", paddingLeft: "20px", fontSize: "14px", color: "#374151", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <li><strong>Text-to-Image Ratio:</strong> Include actual text content, not just images</li>
                  <li><strong>Personalization:</strong> Use merge fields like {`{{firstName}}`}, {`{{company}}`} to personalize</li>
                  <li><strong>Link Quality:</strong> Use reputable domains, avoid URL shorteners</li>
                  <li><strong>Conversational Tone:</strong> Write like you&apos;re talking to a friend, not a sales pitch</li>
                  <li><strong>Clear Purpose:</strong> Make it clear why you&apos;re reaching out</li>
                </ul>
              </div>
              <div
                style={{
                  backgroundColor: "#fefce8",
                  borderLeft: "4px solid #eab308",
                  padding: "16px",
                  borderRadius: "4px",
                }}
              >
                <p style={{ fontSize: "14px", color: "#374151" }}>
                  <strong>💡 Pro Tip:</strong> Ask a question or provide value in your first email. This encourages replies, which significantly improves your sender reputation with Gmail.
                </p>
              </div>
            </div>
          </section>

          {/* Sending Patterns */}
          <section>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#1f2937",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "24px" }}>⏰</span>
              Sending Patterns & Timing
            </h3>
            <div
              style={{
                backgroundColor: "#faf5ff",
                border: "1px solid #c4b5fd",
                padding: "16px",
                borderRadius: "4px",
              }}
            >
              <ul style={{ listStyle: "disc", paddingLeft: "20px", color: "#6b21a8", display: "flex", flexDirection: "column", gap: "8px" }}>
                <li><strong>Rate Limiting:</strong> Our system automatically spaces out your emails to avoid triggering spam filters</li>
                <li><strong>Best Times:</strong> Tuesday-Thursday, 9 AM - 2 PM (recipient&apos;s timezone)</li>
                <li><strong>Avoid:</strong> Sending large batches all at once</li>
                <li><strong>Gradual Increase:</strong> Increase volume slowly over weeks, not days</li>
                <li><strong>Consistency:</strong> Regular sending activity is better than sporadic bursts</li>
              </ul>
            </div>
          </section>

          {/* Account Health */}
          <section>
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#1f2937",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "24px" }}>💚</span>
              Maintain Account Health
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div
                style={{
                  backgroundColor: "#f9fafb",
                  padding: "16px",
                  borderRadius: "4px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <h4 style={{ fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>Key Metrics to Monitor:</h4>
                <ul style={{ listStyle: "disc", paddingLeft: "20px", fontSize: "14px", color: "#374151", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <li><strong>Delivery Rate:</strong> Should be &gt;95%</li>
                  <li><strong>Open Rate:</strong> Should be &gt;20% (indicates inbox placement)</li>
                  <li><strong>Spam Rate:</strong> Should be &lt;0.1%</li>
                  <li><strong>Bounce Rate:</strong> Should be &lt;5%</li>
                  <li><strong>Reply Rate:</strong> Higher is better (indicates engagement)</li>
                </ul>
              </div>
              <div
                style={{
                  backgroundColor: "#f9fafb",
                  padding: "16px",
                  borderRadius: "4px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <h4 style={{ fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>Warning Signs:</h4>
                <ul style={{ listStyle: "disc", paddingLeft: "20px", fontSize: "14px", color: "#374151", display: "flex", flexDirection: "column", gap: "4px" }}>
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
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#1f2937",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "24px" }}>🤝</span>
              Encourage Engagement
            </h3>
            <div
              style={{
                backgroundColor: "#eff6ff",
                borderLeft: "4px solid #3b82f6",
                padding: "16px",
                borderRadius: "4px",
              }}
            >
              <p style={{ color: "#1e40af", marginBottom: "12px" }}>
                <strong>Why engagement matters:</strong> Gmail tracks how recipients interact with your emails. High engagement = better inbox placement.
              </p>
              <ul style={{ listStyle: "disc", paddingLeft: "20px", color: "#1e40af", display: "flex", flexDirection: "column", gap: "8px" }}>
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
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#1f2937",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "24px" }}>🔍</span>
              Testing & Monitoring
            </h3>
            <div
              style={{
                backgroundColor: "#eef2ff",
                border: "1px solid #a5b4fc",
                padding: "16px",
                borderRadius: "4px",
              }}
            >
              <h4 style={{ fontWeight: 600, color: "#1f2937", marginBottom: "8px" }}>Before Sending Campaigns:</h4>
              <ol style={{ listStyle: "decimal", paddingLeft: "20px", fontSize: "14px", color: "#374151", display: "flex", flexDirection: "column", gap: "8px" }}>
                <li>Send test emails to your own Gmail account</li>
                <li>Check if it lands in inbox (not spam)</li>
                <li>If it goes to spam, mark as &quot;Not Spam&quot; and reply to it</li>
                <li>Gradually increase sending volume</li>
                <li>Monitor your metrics in the dashboard</li>
              </ol>
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px",
                  backgroundColor: "white",
                  borderRadius: "4px",
                  border: "1px solid #a5b4fc",
                }}
              >
                <p style={{ fontSize: "14px", color: "#374151" }}>
                  <strong>📊 Gmail Postmaster Tools:</strong> Set up at{" "}
                  <a
                    href="https://postmaster.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#2563eb", textDecoration: "underline" }}
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
            <h3
              style={{
                fontSize: "20px",
                fontWeight: 600,
                color: "#1f2937",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "24px" }}>✅</span>
              Quick Checklist Before Sending
            </h3>
            <div
              style={{
                backgroundColor: "#f0fdf4",
                border: "1px solid #86efac",
                padding: "16px",
                borderRadius: "4px",
              }}
            >
              <ul style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                  <li key={index} style={{ display: "flex", alignItems: "start", gap: "8px", fontSize: "14px", color: "#15803d" }}>
                    <input type="checkbox" style={{ marginTop: "2px" }} id={`checklist-${index}`} />
                    <label htmlFor={`checklist-${index}`} style={{ cursor: "pointer" }}>
                      {item}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "16px", marginTop: "24px" }}>
            <p style={{ fontSize: "14px", color: "#6b7280", textAlign: "center" }}>
              Following these best practices will significantly improve your email deliverability and ensure your messages reach the inbox.
              <br />
              <strong>Remember:</strong> Building sender reputation takes time. Be patient and consistent!
            </p>
          </div>
        </div>

        {/* Footer Button */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            backgroundColor: "#f9fafb",
            borderTop: "1px solid #e5e7eb",
            padding: "16px",
            borderRadius: "0 0 8px 8px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              width: "100%",
              backgroundColor: "#2563eb",
              color: "white",
              fontWeight: 600,
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              fontSize: "16px",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#1d4ed8";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#2563eb";
            }}
          >
            Got it! Close
          </button>
        </div>
      </div>
    </div>
  );
}

