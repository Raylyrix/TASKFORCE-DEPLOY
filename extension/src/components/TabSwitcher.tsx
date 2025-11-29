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
      marginBottom: "20px",
      backgroundColor: "#f8f9fa",
      padding: "4px",
      borderRadius: "10px",
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
            padding: "10px 16px",
            borderRadius: "8px",
            border: "none",
            fontWeight: 500,
            cursor: "pointer",
            backgroundColor: isActive ? "#ffffff" : "transparent",
            color: isActive ? "#1a73e8" : "#5f6368",
            transition: "all 0.2s ease",
            boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
          }}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);


