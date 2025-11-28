import { useState, useMemo } from "react";
import { Button } from "./Button";
import { useExtensionStore } from "../shared/store";

type EmailIssue = {
  type: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
};

const checkEmail = (subject: string, body: string): EmailIssue[] => {
  const issues: EmailIssue[] = [];
  const subjectLower = subject.toLowerCase();
  const bodyLower = body.toLowerCase();
  const bodyText = body.replace(/<[^>]*>/g, ""); // Strip HTML tags for text analysis

  // Spam words in subject
  const spamWords = [
    "free", "win", "winner", "congratulations", "urgent", "act now", "limited time",
    "click here", "buy now", "discount", "offer expires", "guaranteed", "no risk",
    "make money", "cash", "$$$", "!!!", "asap", "limited offer"
  ];
  const foundSpamWords = spamWords.filter(word => subjectLower.includes(word));
  if (foundSpamWords.length > 0) {
    issues.push({
      type: "error",
      message: `Subject contains spam trigger words: ${foundSpamWords.join(", ")}`,
      suggestion: "Remove these words or replace them with more natural language"
    });
  }

  // Subject length
  if (subject.length > 50) {
    issues.push({
      type: "warning",
      message: `Subject line is ${subject.length} characters (recommended: under 50)`,
      suggestion: "Shorter subject lines have better open rates"
    });
  }

  // All caps in subject
  if (subject === subject.toUpperCase() && subject.length > 5) {
    issues.push({
      type: "error",
      message: "Subject line is in all caps",
      suggestion: "Use normal capitalization for better deliverability"
    });
  }

  // Excessive punctuation
  const excessivePunct = /[!?]{2,}/.test(subject);
  if (excessivePunct) {
    issues.push({
      type: "warning",
      message: "Subject has excessive punctuation (!!, ???)",
      suggestion: "Use single punctuation marks"
    });
  }

  // Personalization check
  const hasMergeFields = /{{[^}]+}}/.test(subject) || /{{[^}]+}}/.test(body);
  if (!hasMergeFields) {
    issues.push({
      type: "warning",
      message: "No merge fields found (e.g., {{firstName}}, {{company}})",
      suggestion: "Add personalization to improve engagement"
    });
  }

  // Body length check
  if (bodyText.trim().length < 50) {
    issues.push({
      type: "warning",
      message: "Email body is very short (less than 50 characters)",
      suggestion: "Add more content to avoid spam filters"
    });
  }

  // Check for images without text
  const imageCount = (body.match(/<img[^>]*>/gi) || []).length;
  const textLength = bodyText.trim().length;
  if (imageCount > 0 && textLength < 100) {
    issues.push({
      type: "warning",
      message: "Email has images but very little text",
      suggestion: "Add more text content alongside images"
    });
  }

  // Check for questions (engagement)
  const hasQuestion = /[?]/.test(subject) || /[?]/.test(bodyText);
  if (!hasQuestion) {
    issues.push({
      type: "info",
      message: "Consider asking a question to encourage replies",
      suggestion: "Questions improve engagement and sender reputation"
    });
  }

  // URL shorteners check
  const urlShorteners = /(bit\.ly|tinyurl|goo\.gl|t\.co|ow\.ly|is\.gd)/i.test(body);
  if (urlShorteners) {
    issues.push({
      type: "warning",
      message: "Email contains URL shorteners",
      suggestion: "Use full URLs from reputable domains instead"
    });
  }

  // Check for clear call-to-action
  const ctaWords = ["reply", "respond", "let me know", "get in touch", "schedule", "call"];
  const hasCTA = ctaWords.some(word => bodyLower.includes(word));
  if (!hasCTA) {
    issues.push({
      type: "info",
      message: "Consider adding a clear call-to-action",
      suggestion: "Make it easy for recipients to respond"
    });
  }

  return issues;
};

export const BestPracticesPanel = () => {
  const composerDraft = useExtensionStore((state) => state.composerDraft);
  const [showChecker, setShowChecker] = useState(false);

  const issues = useMemo(() => {
    if (!composerDraft.subjectTemplate && !composerDraft.bodyTemplate) {
      return [];
    }
    return checkEmail(
      composerDraft.subjectTemplate || "",
      composerDraft.bodyTemplate || ""
    );
  }, [composerDraft.subjectTemplate, composerDraft.bodyTemplate]);

  const hasContent = composerDraft.subjectTemplate || composerDraft.bodyTemplate;
  const errorCount = issues.filter(i => i.type === "error").length;
  const warningCount = issues.filter(i => i.type === "warning").length;
  const infoCount = issues.filter(i => i.type === "info").length;
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

      {/* Email Checker */}
      {hasContent && (
        <section>
          <div
            style={{
              backgroundColor: "#f8f9fa",
              border: "1px solid #e8eaed",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#1a73e8" }}>
                Check Your Email
              </h2>
              <Button
                variant="secondary"
                onClick={() => setShowChecker(!showChecker)}
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                {showChecker ? "Hide" : "Check"}
              </Button>
            </div>

            {showChecker && (
              <div style={{ marginTop: "12px" }}>
                {issues.length === 0 ? (
                  <div
                    style={{
                      backgroundColor: "#e8f5e9",
                      border: "1px solid #c8e6c9",
                      borderRadius: "8px",
                      padding: "12px",
                      fontSize: "13px",
                      color: "#2e7d32",
                    }}
                  >
                    ✅ Your email looks good! No major issues found.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {(errorCount > 0 || warningCount > 0 || infoCount > 0) && (
                      <div style={{ display: "flex", gap: "12px", fontSize: "12px", marginBottom: "8px" }}>
                        {errorCount > 0 && (
                          <span style={{ color: "#c62828", fontWeight: "600" }}>
                            {errorCount} Error{errorCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {warningCount > 0 && (
                          <span style={{ color: "#f57c00", fontWeight: "600" }}>
                            {warningCount} Warning{warningCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {infoCount > 0 && (
                          <span style={{ color: "#1976d2", fontWeight: "600" }}>
                            {infoCount} Suggestion{infoCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    )}

                    {issues.map((issue, index) => (
                      <div
                        key={index}
                        style={{
                          backgroundColor:
                            issue.type === "error"
                              ? "#ffebee"
                              : issue.type === "warning"
                                ? "#fff3e0"
                                : "#e3f2fd",
                          border:
                            issue.type === "error"
                              ? "1px solid #ffcdd2"
                              : issue.type === "warning"
                                ? "1px solid #ffe0b2"
                                : "1px solid #bbdefb",
                          borderRadius: "8px",
                          padding: "12px",
                          fontSize: "13px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "start",
                            gap: "8px",
                          }}
                        >
                          <span style={{ fontSize: "16px" }}>
                            {issue.type === "error" ? "❌" : issue.type === "warning" ? "⚠️" : "💡"}
                          </span>
                          <div style={{ flex: 1 }}>
                            <p
                              style={{
                                margin: 0,
                                fontWeight: "600",
                                color:
                                  issue.type === "error"
                                    ? "#c62828"
                                    : issue.type === "warning"
                                      ? "#e65100"
                                      : "#1565c0",
                              }}
                            >
                              {issue.message}
                            </p>
                            {issue.suggestion && (
                              <p
                                style={{
                                  margin: "4px 0 0",
                                  fontSize: "12px",
                                  color: "#5f6368",
                                }}
                              >
                                💡 {issue.suggestion}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

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

