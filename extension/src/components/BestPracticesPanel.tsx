import { Button } from "./Button";

export const BestPracticesPanel = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        padding: "20px",
        height: "100%",
        overflowY: "auto",
        fontSize: "14px",
        lineHeight: "1.6",
        color: "#202124",
      }}
    >
      <div>
        <h1 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: "600", color: "#202124" }}>
          Email Best Practices
        </h1>
        <p style={{ margin: 0, fontSize: "13px", color: "#5f6368" }}>
          Tips to improve deliverability and avoid spam filters
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Account Warm-Up */}
        <section>
          <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: "600", color: "#1a73e8" }}>
            Account Warm-Up
          </h2>
          <div
            style={{
              backgroundColor: "#f8f9fa",
              border: "1px solid #e8eaed",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: "13px" }}>
              Start slow and gradually increase volume. Gmail builds trust over time.
            </p>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
              <li style={{ marginBottom: "6px" }}>
                <strong>Week 1:</strong> 10-20 emails per day
              </li>
              <li style={{ marginBottom: "6px" }}>
                <strong>Week 2:</strong> 30-50 emails per day
              </li>
              <li style={{ marginBottom: "6px" }}>
                <strong>Week 3:</strong> 50-100 emails per day
              </li>
              <li>
                <strong>Week 4+:</strong> Gradually increase to target volume
              </li>
            </ul>
          </div>
        </section>

        {/* Subject Lines */}
        <section>
          <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: "600", color: "#1a73e8" }}>
            Subject Lines
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                backgroundColor: "#e8f5e9",
                border: "1px solid #c8e6c9",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "600", color: "#2e7d32" }}>
                Do:
              </p>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#2e7d32" }}>
                <li>Use recipient&apos;s name or company</li>
                <li>Keep it under 50 characters</li>
                <li>Be specific and relevant</li>
                <li>Ask a question</li>
              </ul>
            </div>
            <div
              style={{
                backgroundColor: "#ffebee",
                border: "1px solid #ffcdd2",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "600", color: "#c62828" }}>
                Don&apos;t:
              </p>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#c62828" }}>
                <li>Use all caps or excessive punctuation</li>
                <li>Include spammy words (free, win, urgent)</li>
                <li>Be misleading or vague</li>
                <li>Use too many emojis</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Email Content */}
        <section>
          <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: "600", color: "#1a73e8" }}>
            Email Content
          </h2>
          <div
            style={{
              backgroundColor: "#f8f9fa",
              border: "1px solid #e8eaed",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
              <li style={{ marginBottom: "8px" }}>
                Include actual text content, not just images
              </li>
              <li style={{ marginBottom: "8px" }}>
                Use merge fields like {`{{firstName}}`} and {`{{company}}`} to personalize
              </li>
              <li style={{ marginBottom: "8px" }}>
                Use reputable domains for links, avoid URL shorteners
              </li>
              <li style={{ marginBottom: "8px" }}>
                Write conversationally, not like a sales pitch
              </li>
              <li>Make your purpose clear</li>
            </ul>
          </div>
        </section>

        {/* Sending Patterns */}
        <section>
          <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: "600", color: "#1a73e8" }}>
            Sending Patterns
          </h2>
          <div
            style={{
              backgroundColor: "#f8f9fa",
              border: "1px solid #e8eaed",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
              <li style={{ marginBottom: "8px" }}>
                System automatically spaces out emails to avoid spam filters
              </li>
              <li style={{ marginBottom: "8px" }}>
                Best times: Tuesday-Thursday, 9 AM - 2 PM (recipient&apos;s timezone)
              </li>
              <li style={{ marginBottom: "8px" }}>
                Avoid sending large batches all at once
              </li>
              <li>Increase volume slowly over weeks, not days</li>
            </ul>
          </div>
        </section>

        {/* Account Health */}
        <section>
          <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: "600", color: "#1a73e8" }}>
            Monitor Account Health
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div
              style={{
                backgroundColor: "#f8f9fa",
                border: "1px solid #e8eaed",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "600" }}>
                Good Metrics:
              </p>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px" }}>
                <li>Delivery rate &gt;95%</li>
                <li>Open rate &gt;20%</li>
                <li>Spam rate &lt;0.1%</li>
                <li>Bounce rate &lt;5%</li>
              </ul>
            </div>
            <div
              style={{
                backgroundColor: "#fff3e0",
                border: "1px solid #ffe0b2",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "600" }}>
                Warning Signs:
              </p>
              <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px" }}>
                <li>High bounce rate</li>
                <li>Low open rate</li>
                <li>Spam complaints</li>
                <li>Gmail warnings</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Engagement */}
        <section>
          <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: "600", color: "#1a73e8" }}>
            Encourage Engagement
          </h2>
          <div
            style={{
              backgroundColor: "#e8f0fe",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <p style={{ margin: "0 0 12px", fontSize: "13px" }}>
              Gmail tracks how recipients interact with your emails. High engagement improves inbox placement.
            </p>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
              <li>Ask questions that encourage replies</li>
              <li>Make it easy to respond</li>
              <li>Follow up on conversations</li>
              <li>Provide value in every email</li>
            </ul>
          </div>
        </section>

        {/* Testing */}
        <section>
          <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: "600", color: "#1a73e8" }}>
            Before Launching
          </h2>
          <div
            style={{
              backgroundColor: "#f8f9fa",
              border: "1px solid #e8eaed",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <ol style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
              <li style={{ marginBottom: "6px" }}>
                Send test emails to your own Gmail account
              </li>
              <li style={{ marginBottom: "6px" }}>
                Check if it lands in inbox (not spam)
              </li>
              <li style={{ marginBottom: "6px" }}>
                If it goes to spam, mark as &quot;Not Spam&quot; and reply
              </li>
              <li style={{ marginBottom: "6px" }}>
                Gradually increase sending volume
              </li>
              <li>Monitor metrics in the dashboard</li>
            </ol>
          </div>
        </section>

        {/* Quick Checklist */}
        <section>
          <h2 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: "600", color: "#1a73e8" }}>
            Quick Checklist
          </h2>
          <div
            style={{
              backgroundColor: "#e8f5e9",
              border: "1px solid #c8e6c9",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px" }}>
              <li style={{ marginBottom: "6px" }}>Recipients imported and email column selected</li>
              <li style={{ marginBottom: "6px" }}>Subject line is compelling and not spammy</li>
              <li style={{ marginBottom: "6px" }}>
                Email body is personalized with merge fields
              </li>
              <li style={{ marginBottom: "6px" }}>Start time is set correctly</li>
              <li style={{ marginBottom: "6px" }}>Delay between emails is appropriate (10-30 seconds)</li>
              <li>Test email sent and landed in primary tab</li>
            </ul>
          </div>
        </section>
      </div>

      <div
        style={{
          marginTop: "auto",
          paddingTop: "20px",
          borderTop: "1px solid #e8eaed",
          fontSize: "12px",
          color: "#5f6368",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0 }}>
          Building sender reputation takes time. Be patient and consistent!
        </p>
      </div>
    </div>
  );
};

