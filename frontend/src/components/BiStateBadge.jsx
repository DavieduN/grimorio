import React from 'react';

export function BiStateBadge({ label, isOmitted, onChange, color }) {
  const styles = {
    blue: 'bg-blue-100 text-blue-800 hover:bg-blue-200 border-transparent',
    purple: 'bg-purple-100 text-purple-800 hover:bg-purple-200 border-transparent',
  };

  const styleClass = isOmitted
    ? 'bg-gray-100 text-gray-400 border-gray-200 line-through opacity-70 hover:bg-gray-200'
    : styles[color];

  const tooltip = isOmitted ? 'Omitted from PDF (Click to include)' : 'Included in PDF (Click to omit)';

  return (
    <button
      onClick={() => onChange(!isOmitted)}
      title={tooltip}
      className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer ${styleClass}`}
    >
      {label}
    </button>
  );
}