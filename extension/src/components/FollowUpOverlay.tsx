import { useMemo, type ChangeEvent } from "react";
import { createPortal } from "react-dom";

import { useExtensionStore } from "../shared/store";
import { Button } from "./Button";
import { RichTextEditor } from "./RichTextEditor";

const defaultStep = () => ({
  delayMs: 48 * 60 * 60 * 1000,
  subject: "Gentle nudge",
  html: `<p>Hi {{firstName}},</p>
<p>Just wanted to bump this to the top of your inbox.</p>
<p>Thanks!<br/>{{senderName}}</p>`,
});

export const FollowUpOverlay = () => {
  const followUpOverlay = useExtensionStore((state) => state.followUpOverlay);
  const updateFollowUpDraft = useExtensionStore((state) => state.updateFollowUpDraft);
  const closeFollowUpOverlay = useExtensionStore((state) => state.closeFollowUpOverlay);
  const updateComposerDraft = useExtensionStore((state) => state.updateComposerDraft);
  const composerDraft = useExtensionStore((state) => state.composerDraft);

  const draft = followUpOverlay.draft;
  const autocompleteEnabled = composerDraft.autocompleteEnabled ?? true;
  const mergeFields = useMemo(() => {
    if (!composerDraft.importResult) return [] as string[];
    const unique = new Set(
      composerDraft.importResult.headers
        .map((header) => header.trim())
        .filter((header) => header.length > 0),
    );
    return Array.from(unique);
  }, [composerDraft.importResult]);

  if (!followUpOverlay.isOpen || !draft) {
    return null;
  }

  const updateDraft = (nextDraft: typeof draft) => {
    updateFollowUpDraft(nextDraft);
  };

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateDraft({ ...draft, name: event.target.value });
  };

  const handleStepChange = (index: number, partial: Partial<typeof draft.steps[number]>) => {
    const nextSteps = draft.steps.map((step, stepIndex) =>
      stepIndex === index
        ? {
            ...step,
            ...partial,
          }
        : step,
    );
    updateDraft({ ...draft, steps: nextSteps });
  };

  const handleStepHtmlChange = (index: number, html: string) => {
    handleStepChange(index, { html });
  };

  const handleAddStep = () => {
    updateDraft({ ...draft, steps: [...draft.steps, defaultStep()] });
  };

  const handleAddNestedStep = (parentIndex: number) => {
    const parentStep = draft.steps[parentIndex];
    if (!parentStep) return;
    // Generate a unique ID for the parent step if it doesn't have one
    const parentStepId = `step-${parentIndex}`;
    const newStep = defaultStep(parentStepId);
    // Insert after the parent step
    const nextSteps = [...draft.steps];
    nextSteps.splice(parentIndex + 1, 0, newStep);
    updateDraft({ ...draft, steps: nextSteps });
  };

  const handleRemoveStep = (index: number) => {
    const nextSteps = draft.steps.filter((_, stepIndex) => stepIndex !== index);
    updateDraft({ ...draft, steps: nextSteps });
  };

  const handleSave = () => {
    if (draft.steps.length === 0) {
      updateComposerDraft({ followUpSequence: null });
    } else {
      updateComposerDraft({ followUpSequence: draft });
    }
    closeFollowUpOverlay();
  };

  const handleCancel = () => {
    closeFollowUpOverlay();
    updateFollowUpDraft(null);
  };

  const overlayContent = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.45)",
        zIndex: 2147483646,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <div
        style={{
          width: "min(860px, 100%)",
          maxHeight: "90vh",
          backgroundColor: "#ffffff",
          borderRadius: "18px",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px",
            borderBottom: "1px solid #e0e3e7",
            background: "linear-gradient(135deg, #1a73e8, #4285f4)",
            color: "#ffffff",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "18px" }}>Follow-up sequence</h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", opacity: 0.85 }}>
              Build automated nudges for recipients who haven’t replied yet.
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            style={{
              border: "none",
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              borderRadius: "8px",
              padding: "6px 10px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            ✕
          </button>
        </header>

        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600 }}>Sequence name</span>
            <input
              type="text"
              value={draft.name}
              onChange={handleNameChange}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #dadce0",
              }}
              placeholder="Q4 follow-up cadence"
            />
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {draft.steps.map((step, index) => (
              <div
                key={`follow-up-editor-${index}`}
                style={{
                  border: "1px solid #e0e3e7",
                  borderRadius: "14px",
                  padding: "16px",
                  backgroundColor: "#f8f9fa",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "14px" }}>Step {index + 1}</strong>
                  <Button variant="ghost" onClick={() => handleRemoveStep(index)}>
                    Remove
                  </Button>
                </div>

                {/* Scheduling Mode Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name={`schedule-mode-${index}`}
                      checked={!step.useDateTime}
                      onChange={() => handleStepChange(index, { useDateTime: false })}
                      style={{ cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>Delay (hours/days)</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                    <input
                      type="radio"
                      name={`schedule-mode-${index}`}
                      checked={step.useDateTime ?? false}
                      onChange={() => handleStepChange(index, { useDateTime: true })}
                      style={{ cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>Specific Date & Time</span>
                  </label>
                </div>

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {step.useDateTime ? (
                    <label style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600 }}>Send at (Date & Time)</span>
                      <input
                        type="datetime-local"
                        value={
                          step.scheduledAt
                            ? new Date(step.scheduledAt).toISOString().slice(0, 16)
                            : new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 16)
                        }
                        onChange={(event) => {
                          const dateTime = event.target.value;
                          if (dateTime) {
                            const scheduledAt = new Date(dateTime).toISOString();
                            handleStepChange(index, { scheduledAt });
                          }
                        }}
                        min={new Date().toISOString().slice(0, 16)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #dadce0",
                        }}
                      />
                      <span style={{ fontSize: "11px", color: "#5f6368" }}>
                        Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                      </span>
                    </label>
                  ) : (
                    <>
                      <label style={{ width: "120px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600 }}>Delay (hours)</span>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={step.delayMs ? Math.round((step.delayMs / 3600000) * 10) / 10 : 48}
                          onChange={(event) => {
                            const hours = Number(event.target.value);
                            const delayMs = hours * 3600000;
                            handleStepChange(index, { delayMs });
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: "1px solid #dadce0",
                          }}
                          placeholder="48"
                        />
                      </label>
                      <label style={{ width: "120px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 600 }}>Or (days)</span>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={step.delayMs ? Math.round((step.delayMs / (24 * 3600000)) * 10) / 10 : 2}
                          onChange={(event) => {
                            const days = Number(event.target.value);
                            const delayMs = days * 24 * 3600000;
                            handleStepChange(index, { delayMs });
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: "1px solid #dadce0",
                          }}
                          placeholder="2"
                        />
                      </label>
                    </>
                  )}

                  <label style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>Subject</span>
                    <input
                      type="text"
                      value={step.subject}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => handleStepChange(index, { subject: event.target.value })}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #dadce0",
                      }}
                      placeholder="Following up on {{company}}"
                    />
                  </label>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>Email body</span>
                  <RichTextEditor
                    value={step.html}
                    onChange={(html) => handleStepHtmlChange(index, html)}
                    mergeFields={mergeFields}
                    autocompleteEnabled={autocompleteEnabled}
                    placeholder="Remind them why the conversation matters and include a clear CTA."
                  />
                </div>

                {/* Reply vs Separate Email */}
                <div style={{ borderTop: "1px solid #e0e3e7", paddingTop: "12px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={step.sendAsReply ?? false}
                      onChange={(e) => handleStepChange(index, { sendAsReply: e.target.checked })}
                      style={{
                        width: "16px",
                        height: "16px",
                        cursor: "pointer",
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#3c4043" }}>
                        Send as Reply (to original email thread)
                      </span>
                      <span style={{ fontSize: "12px", color: "#5f6368" }}>
                        {step.sendAsReply
                          ? "This follow-up will be sent as a reply to the original email, keeping the conversation thread together."
                          : "This follow-up will be sent as a separate new email."}
                      </span>
                    </div>
                  </label>
                </div>

                {/* Add Nested Follow-up Button */}
                {!step.isNested && (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Button
                      variant="ghost"
                      onClick={() => handleAddNestedStep(index)}
                      style={{
                        fontSize: "12px",
                        padding: "6px 12px",
                      }}
                    >
                      + Add nested follow-up
                    </Button>
                  </div>
                )}

                {/* Visual indicator for nested steps */}
                {step.isNested && (
                  <div
                    style={{
                      padding: "8px 12px",
                      backgroundColor: "#e8f0fe",
                      borderRadius: "8px",
                      border: "1px solid #d2e3fc",
                      fontSize: "12px",
                      color: "#1a73e8",
                    }}
                  >
                    ↳ Nested follow-up (child of previous step)
                  </div>
                )}
              </div>
            ))}

            <Button variant="ghost" onClick={handleAddStep} style={{ alignSelf: "flex-start" }}>
              Add another follow-up
            </Button>
          </div>
        </div>

        <footer
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderTop: "1px solid #e0e3e7",
            backgroundColor: "#ffffff",
          }}
        >
          <div style={{ fontSize: "12px", color: "#5f6368" }}>
            {draft.steps.length === 0
              ? "Sequence disabled — add at least one step to activate."
              : `${draft.steps.length} step${draft.steps.length === 1 ? "" : "s"} configured.`}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Button variant="secondary" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save follow-ups
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );

  return createPortal(overlayContent, document.body);
};
