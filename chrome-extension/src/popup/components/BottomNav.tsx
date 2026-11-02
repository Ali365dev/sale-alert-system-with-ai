import type { TabId } from "../../types";

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { id: "brands",    label: "Brands",    icon: "🏪" },
  { id: "selectors", label: "Selectors", icon: "🎯" },
  { id: "history",   label: "History",   icon: "📋" },
  { id: "settings",  label: "Settings",  icon: "⚙" },
];

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function BottomNav({ activeTab, onTabChange }: Props) {
  return (
    <div className="flex border-t border-gray-200 bg-white flex-shrink-0">
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition relative ${
              active ? "text-primary" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {active && (
              <span className="absolute top-0 left-3 right-3 h-0.5 bg-primary rounded-b-full" />
            )}
            <span className="text-sm leading-tight">{tab.icon}</span>
            <span className="text-[9px] font-bold leading-tight">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
