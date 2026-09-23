import React from "react";

export default function Tabs({ tabs, active, onChange, counts = {} }) {
  return (
    <nav className="tabbar">
      <div className="tabbar-in" role="tablist" aria-label="Sections">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className="tab"
            role="tab"
            aria-selected={active === id}
            onClick={() => onChange(id)}
          >
            {label}
            {counts[id] > 0 && <span className="badge">{counts[id]}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}
