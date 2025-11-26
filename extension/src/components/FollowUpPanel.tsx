import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { apiClient } from "../shared/apiClient";
import type {
  FollowUpAction,
  FollowUpAutomationPayload,
  FollowUpAutomationRule,
  FollowUpCondition,
  FollowUpSchedule,
  FollowUpStopConditions,
  GmailLabel,
} from "../shared/types";
import { Button } from "./Button";
import { Card } from "./Card";
import { RichTextEditor } from "./RichTextEditor";
import { useGmailLabels } from "../hooks/useGmailLabels";
import { useFollowUpAutomations } from "../hooks/useFollowUpAutomations";

const generateId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const createDefaultCondition = (): FollowUpCondition => ({
  id: generateId(),
  field: "noReplySince",
  operator: "gt",
  value: "3",
  unit: "days",
});

const createDefaultAction = (): FollowUpAction => ({
  id: generateId(),
  type: "sendEmail",
  subject: "Just checking in",
  bodyHtml: `<p>Hi {{firstName}},</p>
<p>Just checking whether you had a chance to review my earlier note.</p>
<p>Thanks!<br/>{{senderName}}</p>`,
});

const createRelativeSchedule = (timezone: string): FollowUpSchedule => ({
  mode: "relative",
  sendAfterDays: 3,
  timezone,
});

const createAbsoluteSchedule = (timezone: string): FollowUpSchedule => ({
  mode: "absolute",
  sendAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  timezone,
});

const createWeeklySchedule = (timezone: string): FollowUpSchedule => ({
  mode: "weekly",
  daysOfWeek: ["monday"],
  sendTime: "09:00",
  timezone,
});

const createDefaultRule = (timezone: string): FollowUpAutomationRule => ({
  id: generateId(),
  name: "Follow-up after 3 days",
  schedule: createRelativeSchedule(timezone),
  conditions: [createDefaultCondition()],
  actions: [createDefaultAction()],
  stopConditions: {
    onReply: true,
    onOpen: false,
    onClick: false,
  },
  maxFollowUps: 3,
  isActive: true,
});

type TargetMode = "label" | "query" | "folder";

type ConditionFieldConfig = {
  label: string;
  operators: Array<{ value: FollowUpCondition["operator"]; label: string }>;
  valueType: "duration" | "label" | "status" | "text";
};

const conditionFieldConfig: Record<FollowUpCondition["field"], ConditionFieldConfig> = {
  noReplySince: {
    label: "No reply for",
    operators: [
      { value: "gt", label: "greater than" },
      { value: "lt", label: "less than" },
    ],
    valueType: "duration",
  },
  hasLabel: {
    label: "Thread has label",
    operators: [
      { value: "includes", label: "includes" },
      { value: "excludes", label: "does not include" },
    ],
    valueType: "label",
  },
  threadStatus: {
    label: "Thread status",
    operators: [{ value: "equals", label: "is" }],
    valueType: "status",
  },
  manualTag: {
    label: "Custom tag",
    operators: [{ value: "equals", label: "equals" }],
    valueType: "text",
  },
};

const actionTypeLabels: Record<FollowUpAction["type"], string> = {
  sendEmail: "Send follow-up email",
  applyLabel: "Apply Gmail label",
  stopSequence: "Stop remaining follow-ups",
};

const ruleNamePlaceholder = [
  "Re-engage after 3 days",
  "Second touch in a week",
  "Final reminder",
];

const createRuleName = () =>
  ruleNamePlaceholder[Math.floor(Math.random() * ruleNamePlaceholder.length)] ?? "Follow-up rule";

const WEEKDAY_OPTIONS: Array<{ value: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"; label: string }> =
  [
    { value: "monday", label: "Mon" },
    { value: "tuesday", label: "Tue" },
    { value: "wednesday", label: "Wed" },
    { value: "thursday", label: "Thu" },
    { value: "friday", label: "Fri" },
    { value: "saturday", label: "Sat" },
    { value: "sunday", label: "Sun" },
  ];
const WEEKDAY_INDEX = WEEKDAY_OPTIONS.reduce<
  Record<"monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday", number>
>((acc, option, index) => {
  acc[option.value] = index;
  return acc;
}, {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
});

export const FollowUpPanel = () => {
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const labelsQuery = useGmailLabels();
  const automationsQuery = useFollowUpAutomations();

  const [targetMode, setTargetMode] = useState<TargetMode>("label");
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [folderName, setFolderName] = useState("");
  const [rules, setRules] = useState<FollowUpAutomationRule[]>([createDefaultRule(timezone)]);
  const [formError, setFormError] = useState<string | null>(null);

  const addRule = () => {
    setRules((prev) => [...prev, { ...createDefaultRule(timezone), name: createRuleName() }]);
  };

  const updateRule = (ruleId: string, partial: Partial<FollowUpAutomationRule>) => {
    setRules((prev) => prev.map((rule) => (rule.id === ruleId ? { ...rule, ...partial } : rule)));
  };

  const changeScheduleMode = (ruleId: string, mode: FollowUpSchedule["mode"]) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id !== ruleId) {
          return rule;
        }
        const preservedTimezone = rule.schedule.timezone;
        const nextSchedule =
          mode === "relative"
            ? createRelativeSchedule(timezone)
            : mode === "absolute"
              ? createAbsoluteSchedule(timezone)
              : createWeeklySchedule(timezone);
        return {
          ...rule,
          schedule: { ...nextSchedule, timezone: preservedTimezone },
        };
      }),
    );
  };

  const updateSchedule = (ruleId: string, partial: Partial<FollowUpSchedule>) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              schedule: { ...rule.schedule, ...partial } as FollowUpSchedule,
            }
          : rule,
      ),
    );
  };

  const toggleWeeklyDay = (
    ruleId: string,
    day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
  ) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id !== ruleId || rule.schedule.mode !== "weekly") {
          return rule;
        }
        const exists = rule.schedule.daysOfWeek.includes(day);
        const next = exists
          ? rule.schedule.daysOfWeek.filter((entry) => entry !== day)
          : [...rule.schedule.daysOfWeek, day];
        const normalized = Array.from(new Set(next)).sort((a, b) => WEEKDAY_INDEX[a] - WEEKDAY_INDEX[b]);
        return {
          ...rule,
          schedule: {
            ...rule.schedule,
            daysOfWeek: normalized.length === 0 ? [day] : normalized,
          },
        };
      }),
    );
  };

  const updateStopConditions = (ruleId: string, partial: Partial<FollowUpStopConditions>) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              stopConditions: {
                ...rule.stopConditions,
                ...partial,
              },
            }
          : rule,
      ),
    );
  };

  const addCondition = (ruleId: string) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              conditions: [...rule.conditions, createDefaultCondition()],
            }
          : rule,
      ),
    );
  };

  const updateCondition = (ruleId: string, conditionId: string, partial: Partial<FollowUpCondition>) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              conditions: rule.conditions.map((condition) =>
                condition.id === conditionId ? { ...condition, ...partial } : condition,
              ),
            }
          : rule,
      ),
    );
  };

  const removeCondition = (ruleId: string, conditionId: string) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              conditions: rule.conditions.filter((condition) => condition.id !== conditionId),
            }
          : rule,
      ),
    );
  };

  const addAction = (ruleId: string, type: FollowUpAction["type"]) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              actions: [
                ...rule.actions,
                type === "sendEmail"
                  ? createDefaultAction()
                  : { id: generateId(), type, labelId: undefined, subject: undefined, bodyHtml: undefined },
              ],
            }
          : rule,
      ),
    );
  };

  const updateAction = (ruleId: string, actionId: string, partial: Partial<FollowUpAction>) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              actions: rule.actions.map((action) => (action.id === actionId ? { ...action, ...partial } : action)),
            }
          : rule,
      ),
    );
  };

  const removeAction = (ruleId: string, actionId: string) => {
    setRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              actions: rule.actions.filter((action) => action.id !== actionId),
            }
          : rule,
      ),
    );
  };

  const resetBuilder = () => {
    setSelectedLabels([]);
    setSearchQuery("");
    setFolderName("");
    setRules([createDefaultRule(timezone)]);
  };

  const createAutomationMutation = useMutation({
    mutationFn: async () => {
      if (targetMode === "label" && selectedLabels.length === 0) {
        throw new Error("Select at least one Gmail label to target.");
      }
      if (targetMode === "query" && searchQuery.trim().length === 0) {
        throw new Error("Provide a Gmail search query.");
      }
      if (targetMode === "folder" && folderName.trim().length === 0) {
        throw new Error("Provide a folder or label to watch.");
      }
      if (rules.some((rule) => rule.actions.length === 0)) {
        throw new Error("Each automation rule needs at least one action.");
      }
      for (const rule of rules) {
        if (rule.schedule.mode === "absolute" && !(rule.schedule.sendAt ?? "").trim()) {
          throw new Error(`Rule "${rule.name}" needs a send date and time.`);
        }
        if (rule.schedule.mode === "weekly") {
          if (!(rule.schedule.sendTime ?? "").trim()) {
            throw new Error(`Rule "${rule.name}" needs a weekly send time.`);
          }
          if (rule.schedule.daysOfWeek.length === 0) {
            throw new Error(`Rule "${rule.name}" needs at least one weekday selected.`);
          }
        }
      }

      const rulesPayload = rules.map(({ id, conditions, actions, ...ruleRest }) => {
        void id;
        const schedule =
          ruleRest.schedule.mode === "weekly"
            ? {
                ...ruleRest.schedule,
                daysOfWeek: [...ruleRest.schedule.daysOfWeek].sort(
                  (a, b) => WEEKDAY_INDEX[a] - WEEKDAY_INDEX[b],
                ),
              }
            : ruleRest.schedule;
        return {
          ...ruleRest,
          schedule,
          conditions: conditions.map(({ id, ...conditionRest }) => {
            void id;
            return conditionRest;
          }),
          actions: actions.map(({ id, ...actionRest }) => {
            void id;
            return actionRest;
          }),
        };
      });

      const payload: FollowUpAutomationPayload = {
        target:
          targetMode === "label"
            ? { type: "label", labelIds: selectedLabels }
            : targetMode === "query"
              ? { type: "query", query: searchQuery.trim() }
              : { type: "folder", folderId: folderName.trim() },
        timezone,
        rules: rulesPayload,
      };

      await apiClient.request("/api/follow-ups/automations", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setFormError(null);
      resetBuilder();
      void automationsQuery.refetchAutomations();
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError("Failed to save automation. Try again in a moment.");
      }
    },
  });

  const renderConditionValueInput = (
    ruleId: string,
    condition: FollowUpCondition,
    labels: GmailLabel[] | undefined,
  ) => {
    const config = conditionFieldConfig[condition.field];
    switch (config.valueType) {
      case "duration":
        return (
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="number"
              min={1}
              value={condition.value}
              onChange={(event) => updateCondition(ruleId, condition.id, { value: event.target.value })}
              style={{
                width: "80px",
                padding: "6px 8px",
                borderRadius: "6px",
                border: "1px solid #dadce0",
              }}
            />
            <select
              value={condition.unit ?? "days"}
              onChange={(event) => updateCondition(ruleId, condition.id, { unit: event.target.value as "hours" | "days" })}
              style={{
                padding: "6px 8px",
                borderRadius: "6px",
                border: "1px solid #dadce0",
              }}
            >
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        );
      case "label":
        if (!labels || labels.length === 0) {
          return <span style={{ fontSize: "12px", color: "#5f6368" }}>No labels available.</span>;
        }
        return (
          <select
            value={condition.value}
            onChange={(event) => updateCondition(ruleId, condition.id, { value: event.target.value })}
            style={{
              padding: "6px 8px",
              borderRadius: "6px",
              border: "1px solid #dadce0",
            }}
          >
            <option value="">Select label</option>
            {labels.map((label) => (
              <option key={label.id} value={label.id}>
                {label.name}
              </option>
            ))}
          </select>
        );
      case "status":
        return (
          <select
            value={condition.value}
            onChange={(event) => updateCondition(ruleId, condition.id, { value: event.target.value })}
            style={{
              padding: "6px 8px",
              borderRadius: "6px",
              border: "1px solid #dadce0",
            }}
          >
            <option value="open">Open</option>
            <option value="archived">Archived</option>
            <option value="replied">Replied</option>
            <option value="muted">Muted</option>
          </select>
        );
      case "text":
      default:
        return (
          <input
            type="text"
            value={condition.value}
            onChange={(event) => updateCondition(ruleId, condition.id, { value: event.target.value })}
            style={{
              padding: "6px 8px",
              borderRadius: "6px",
              border: "1px solid #dadce0",
            }}
            placeholder="Custom tag value"
          />
        );
    }
  };

  const labels = labelsQuery.data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <header>
            <h2 style={{ margin: 0 }}>Target audience</h2>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#5f6368" }}>
              Choose which Gmail conversations should receive automated follow-ups.
            </p>
          </header>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="radio"
                name="follow-up-target"
                value="label"
                checked={targetMode === "label"}
                onChange={() => setTargetMode("label")}
              />
              Gmail labels
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="radio"
                name="follow-up-target"
                value="query"
                checked={targetMode === "query"}
                onChange={() => setTargetMode("query")}
              />
              Gmail search query
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                type="radio"
                name="follow-up-target"
                value="folder"
                checked={targetMode === "folder"}
                onChange={() => setTargetMode("folder")}
              />
              Folder / label path
            </label>
          </div>

          {targetMode === "label" ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "220px",
                overflowY: "auto",
                border: "1px solid #e0e3e7",
                borderRadius: "12px",
                padding: "12px",
                backgroundColor: "#f8f9fa",
              }}
            >
              {labelsQuery.isLoading && <span style={{ fontSize: "13px" }}>Loading labels…</span>}
              {labelsQuery.isError && (
                <span style={{ fontSize: "13px", color: "#b3261e" }}>
                  Failed to fetch Gmail labels. Make sure the Gmail permissions are granted.
                </span>
              )}
              {labels.length === 0 && !labelsQuery.isLoading ? (
                <span style={{ fontSize: "13px", color: "#5f6368" }}>No labels detected.</span>
              ) : null}
              {labels.map((label) => (
                <label key={label.id} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="checkbox"
                    checked={selectedLabels.includes(label.id)}
                    onChange={(event) => {
                      setSelectedLabels((prev) =>
                        event.target.checked ? [...prev, label.id] : prev.filter((id) => id !== label.id),
                      );
                    }}
                  />
                  <span style={{ fontSize: "13px" }}>{label.name}</span>
                </label>
              ))}
            </div>
          ) : null}

          {targetMode === "query" ? (
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #dadce0",
              }}
              placeholder="e.g. label:Prospects newer_than:14d"
            />
          ) : null}

          {targetMode === "folder" ? (
            <input
              type="text"
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #dadce0",
              }}
              placeholder="e.g. Prospects/Outbound"
            />
          ) : null}
        </div>
      </Card>

      {rules.map((rule) => (
        <Card key={rule.id}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <label style={{ flex: "1", display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600 }}>Rule name</span>
                <input
                  type="text"
                  value={rule.name}
                  onChange={(event) => updateRule(rule.id, { name: event.target.value })}
                  style={{
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #dadce0",
                  }}
                  placeholder={createRuleName()}
                />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="checkbox"
                  checked={rule.isActive}
                  onChange={(event) => updateRule(rule.id, { isActive: event.target.checked })}
                />
                <span style={{ fontSize: "13px" }}>Active</span>
              </label>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                border: "1px solid #e0e3e7",
                borderRadius: "12px",
                padding: "12px",
                backgroundColor: "#f8f9fa",
              }}
            >
              <strong style={{ fontSize: "14px" }}>Schedule</strong>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="radio"
                    name={`schedule-mode-${rule.id}`}
                    value="relative"
                    checked={rule.schedule.mode === "relative"}
                    onChange={() => changeScheduleMode(rule.id, "relative")}
                  />
                  Relative delay
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="radio"
                    name={`schedule-mode-${rule.id}`}
                    value="absolute"
                    checked={rule.schedule.mode === "absolute"}
                    onChange={() => changeScheduleMode(rule.id, "absolute")}
                  />
                  Specific date
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    type="radio"
                    name={`schedule-mode-${rule.id}`}
                    value="weekly"
                    checked={rule.schedule.mode === "weekly"}
                    onChange={() => changeScheduleMode(rule.id, "weekly")}
                  />
                  Weekly cadence
                </label>
              </div>

              {rule.schedule.mode === "relative" && (
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "#5f6368" }}>Days after previous send</span>
                    <input
                      type="number"
                      min={0}
                      value={rule.schedule.sendAfterDays ?? 0}
                      onChange={(event) =>
                        updateSchedule(rule.id, { sendAfterDays: Number(event.target.value) })
                      }
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #dadce0",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "#5f6368" }}>Additional hours</span>
                    <input
                      type="number"
                      min={0}
                      value={rule.schedule.sendAfterHours ?? 0}
                      onChange={(event) =>
                        updateSchedule(rule.id, { sendAfterHours: Number(event.target.value) })
                      }
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #dadce0",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "#5f6368" }}>Timezone</span>
                    <input
                      type="text"
                      value={rule.schedule.timezone}
                      onChange={(event) => updateSchedule(rule.id, { timezone: event.target.value })}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #dadce0",
                        minWidth: "200px",
                      }}
                    />
                  </label>
                </div>
              )}

              {rule.schedule.mode === "absolute" && (
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "#5f6368" }}>Send at</span>
                    <input
                      type="datetime-local"
                      value={rule.schedule.sendAt ?? ""}
                      onChange={(event) => updateSchedule(rule.id, { sendAt: event.target.value })}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #dadce0",
                      }}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "#5f6368" }}>Timezone</span>
                    <input
                      type="text"
                      value={rule.schedule.timezone}
                      onChange={(event) => updateSchedule(rule.id, { timezone: event.target.value })}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #dadce0",
                        minWidth: "200px",
                      }}
                    />
                  </label>
                </div>
              )}

              {rule.schedule.mode === "weekly" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {WEEKDAY_OPTIONS.map(({ value, label }) => {
                      const selected = rule.schedule.mode === "weekly" && rule.schedule.daysOfWeek.includes(value);
                      return (
                        <label
                          key={value}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "6px 10px",
                            borderRadius: "999px",
                            border: `1px solid ${selected ? "#1a73e8" : "#dadce0"}`,
                            backgroundColor: selected ? "#e8f0fe" : "#fff",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleWeeklyDay(rule.id, value)}
                          />
                          <span style={{ fontSize: "12px" }}>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span style={{ fontSize: "12px", color: "#5f6368" }}>Send at</span>
                      <input
                        type="time"
                        value={rule.schedule.mode === "weekly" ? rule.schedule.sendTime : ""}
                        onChange={(event) => updateSchedule(rule.id, { sendTime: event.target.value })}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #dadce0",
                          minWidth: "140px",
                        }}
                      />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span style={{ fontSize: "12px", color: "#5f6368" }}>Timezone</span>
                      <input
                        type="text"
                        value={rule.schedule.timezone}
                        onChange={(event) => updateSchedule(rule.id, { timezone: event.target.value })}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #dadce0",
                          minWidth: "200px",
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                border: "1px solid #e0e3e7",
                borderRadius: "12px",
                padding: "12px",
              }}
            >
              <strong style={{ fontSize: "14px" }}>Conditions</strong>
              {rule.conditions.length === 0 ? (
                <span style={{ fontSize: "12px", color: "#5f6368" }}>No conditions. Rule will always run.</span>
              ) : null}
              {rule.conditions.map((condition) => {
                const config = conditionFieldConfig[condition.field];
                return (
                  <div
                    key={condition.id}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      alignItems: "center",
                      backgroundColor: "#fff",
                      border: "1px solid #e0e3e7",
                      borderRadius: "10px",
                      padding: "10px",
                    }}
                  >
                    <select
                      value={condition.field}
                      onChange={(event) => {
                        const field = event.target.value as FollowUpCondition["field"];
                        const defaultConfig = conditionFieldConfig[field];
                        updateCondition(rule.id, condition.id, {
                          field,
                          operator: defaultConfig.operators[0]?.value ?? "equals",
                          value: defaultConfig.valueType === "duration" ? "3" : "",
                          unit: defaultConfig.valueType === "duration" ? "days" : undefined,
                        });
                      }}
                      style={{
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #dadce0",
                      }}
                    >
                      {Object.entries(conditionFieldConfig).map(([value, cfg]) => (
                        <option key={value} value={value}>
                          {cfg.label}
                        </option>
                      ))}
                    </select>

                    <select
                      value={condition.operator}
                      onChange={(event) =>
                        updateCondition(rule.id, condition.id, {
                          operator: event.target.value as FollowUpCondition["operator"],
                        })
                      }
                      style={{
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #dadce0",
                      }}
                    >
                      {config.operators.map((operator) => (
                        <option key={operator.value} value={operator.value}>
                          {operator.label}
                        </option>
                      ))}
                    </select>

                    {renderConditionValueInput(rule.id, condition, labels)}

                    <Button variant="ghost" onClick={() => removeCondition(rule.id, condition.id)}>
                      Remove
                    </Button>
                  </div>
                );
              })}
              <Button variant="ghost" onClick={() => addCondition(rule.id)}>
                Add condition
              </Button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                border: "1px solid #e0e3e7",
                borderRadius: "12px",
                padding: "12px",
              }}
            >
              <strong style={{ fontSize: "14px" }}>Actions</strong>
              {rule.actions.map((action) => (
                <div
                  key={action.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    backgroundColor: "#fff",
                    border: "1px solid #e0e3e7",
                    borderRadius: "10px",
                    padding: "12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <select
                      value={action.type}
                      onChange={(event) =>
                        updateAction(rule.id, action.id, {
                          type: event.target.value as FollowUpAction["type"],
                          subject: undefined,
                          bodyHtml: undefined,
                          labelId: undefined,
                        })
                      }
                      style={{
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #dadce0",
                      }}
                    >
                      {Object.entries(actionTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <Button variant="ghost" onClick={() => removeAction(rule.id, action.id)}>
                      Remove
                    </Button>
                  </div>

                  {action.type === "sendEmail" ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={{ fontSize: "12px", color: "#5f6368" }}>Subject</span>
                        <input
                          type="text"
                          value={action.subject ?? ""}
                          onChange={(event) => updateAction(rule.id, action.id, { subject: event.target.value })}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: "1px solid #dadce0",
                          }}
                          placeholder="Re: Checking back in"
                        />
                      </label>
                      <RichTextEditor
                        value={action.bodyHtml ?? ""}
                        onChange={(html) => updateAction(rule.id, action.id, { bodyHtml: html })}
                        mergeFields={[]}
                        placeholder="Write your follow-up email contents…"
                      />
                    </div>
                  ) : null}

                  {action.type === "applyLabel" ? (
                    <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span style={{ fontSize: "12px", color: "#5f6368" }}>Label to apply</span>
                      <select
                        value={action.labelId ?? ""}
                        onChange={(event) => updateAction(rule.id, action.id, { labelId: event.target.value })}
                        style={{
                          padding: "6px 8px",
                          borderRadius: "6px",
                          border: "1px solid #dadce0",
                        }}
                      >
                        <option value="">Select label</option>
                        {labels.map((label) => (
                          <option key={label.id} value={label.id}>
                            {label.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {action.type === "stopSequence" ? (
                    <p style={{ fontSize: "12px", color: "#5f6368", margin: 0 }}>
                      Stops any remaining follow-up actions in this automation once the condition is met.
                    </p>
                  ) : null}
                </div>
              ))}

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={() => addAction(rule.id, "sendEmail")}>Add send email</Button>
                <Button variant="ghost" onClick={() => addAction(rule.id, "applyLabel")}>Add apply label</Button>
                <Button variant="ghost" onClick={() => addAction(rule.id, "stopSequence")}>
                  Add stop sequence
                </Button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "20px",
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <strong style={{ fontSize: "13px" }}>Stop when…</strong>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                  <input
                    type="checkbox"
                    checked={rule.stopConditions.onReply}
                    onChange={(event) => updateStopConditions(rule.id, { onReply: event.target.checked })}
                  />
                  Recipient replies
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                  <input
                    type="checkbox"
                    checked={rule.stopConditions.onOpen}
                    onChange={(event) => updateStopConditions(rule.id, { onOpen: event.target.checked })}
                  />
                  Email is opened
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                  <input
                    type="checkbox"
                    checked={rule.stopConditions.onClick}
                    onChange={(event) => updateStopConditions(rule.id, { onClick: event.target.checked })}
                  />
                  Link is clicked
                </label>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "#5f6368" }}>Max follow-ups</span>
                <input
                  type="number"
                  min={1}
                  value={rule.maxFollowUps ?? 3}
                  onChange={(event) => updateRule(rule.id, { maxFollowUps: Number(event.target.value) })}
                  style={{
                    width: "70px",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid #dadce0",
                  }}
                />
              </label>
            </div>
          </div>
        </Card>
      ))}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <Button variant="ghost" onClick={addRule}>
          Add another rule
        </Button>
      </div>

      {formError ? (
        <div
          style={{
            border: "1px solid #f6c3c3",
            borderRadius: "10px",
            backgroundColor: "#fef3f2",
            padding: "12px",
            color: "#b3261e",
            fontSize: "13px",
          }}
        >
          {formError}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Button
          onClick={() => createAutomationMutation.mutate()}
          disabled={createAutomationMutation.isPending}
        >
          {createAutomationMutation.isPending ? "Saving automations…" : "Save automations"}
        </Button>
        <Button
          variant="secondary"
          onClick={resetBuilder}
          disabled={createAutomationMutation.isPending}
        >
          Reset builder
        </Button>
      </div>

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <header>
            <h3 style={{ margin: 0 }}>Existing automations</h3>
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#5f6368" }}>
              Review the automated follow-up schedules currently active for historical Gmail conversations.
            </p>
          </header>

          {automationsQuery.isLoading ? <span style={{ fontSize: "13px" }}>Loading…</span> : null}
          {automationsQuery.isError ? (
            <span style={{ fontSize: "13px", color: "#b3261e" }}>
              Unable to load automations. Try refreshing the Gmail tab.
            </span>
          ) : null}

          {!automationsQuery.isLoading && (automationsQuery.data?.length ?? 0) === 0 ? (
            <span style={{ fontSize: "13px", color: "#5f6368" }}>
              No automations yet. Create one above to kickstart follow-ups on existing conversations.
            </span>
          ) : null}

          {automationsQuery.data?.map((automation) => (
            <div
              key={automation.id}
              style={{
                border: "1px solid #e0e3e7",
                borderRadius: "12px",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "14px" }}>
                  {automation.target.type === "label"
                    ? `Labels: ${(automation.target.labelIds ?? [])
                        .map((labelId) => labels.find((label) => label.id === labelId)?.name ?? labelId)
                        .join(", ")}`
                    : automation.target.type === "query"
                      ? `Query: ${automation.target.query}`
                      : `Folder: ${automation.target.folderId}`}
                </strong>
                <span style={{ fontSize: "12px", color: "#5f6368" }}>
                  Next run: {automation.nextRunAt ?? "pending"}
                </span>
              </div>

              <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "12px", lineHeight: 1.5 }}>
                {automation.rules.map((rule) => {
                  let scheduleSummary = "";
                  if (rule.schedule.mode === "relative") {
                    const days = rule.schedule.sendAfterDays ?? 0;
                    const hours = rule.schedule.sendAfterHours ?? 0;
                    scheduleSummary = `after ${days} day${days === 1 ? "" : "s"}${hours > 0 ? ` ${hours}h` : ""}`;
                  } else if (rule.schedule.mode === "absolute") {
                    scheduleSummary = `on ${rule.schedule.sendAt ?? "unspecified"}`;
                  } else {
                    const dayLabels = rule.schedule.daysOfWeek
                      .map(
                        (day) =>
                          WEEKDAY_OPTIONS.find((option) => option.value === day)?.label ?? day.slice(0, 3),
                      )
                      .join(", ");
                    scheduleSummary = `weekly on ${dayLabels} at ${rule.schedule.sendTime}`;
                  }

                  const stops: string[] = [];
                  if (rule.stopConditions?.onReply ?? true) {
                    stops.push("reply");
                  }
                  if (rule.stopConditions?.onOpen) {
                    stops.push("open");
                  }
                  if (rule.stopConditions?.onClick) {
                    stops.push("click");
                  }

                  return (
                    <li key={rule.id}>
                      <strong>{rule.name}</strong> · {scheduleSummary}
                      {stops.length > 0 ? ` · stops on ${stops.join(", ")}` : ""}
                    </li>
                  );
                })}
              </ul>

              <span style={{ fontSize: "11px", color: "#9aa0a6" }}>
                Updated {new Date(automation.updatedAt).toLocaleString()} • Timezone {automation.timezone}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};


