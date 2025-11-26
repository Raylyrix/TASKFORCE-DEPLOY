import type { PropsWithChildren } from "react";

type TabOption = {
  id: string;
  label: string;
};

type TabSwitcherProps = PropsWithChildren<{
  tabs: TabOption[];
  activeId: string;
  onChange: (id: string) => void;
}>;

export const TabSwitcher = ({ tabs, activeId, onChange }: TabSwitcherProps) => (
  <div
    style={{
      display: "flex",
      gap: "8px",
      marginBottom: "16px",
    }}
  >
    {tabs.map((tab) => {
      const isActive = tab.id === activeId;
      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: "999px",
            border: "none",
            fontWeight: 600,
            cursor: "pointer",
            backgroundColor: isActive ? "#0b57d0" : "#f1f3f4",
            color: isActive ? "#ffffff" : "#1f1f1f",
            transition: "background-color 0.15s ease",
          }}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);


