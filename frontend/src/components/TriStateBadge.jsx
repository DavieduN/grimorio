import React from 'react';

export function TriStateBadge({ label, state, onChange, defaultColor, globalDefault }) {
  const handleClick = () => {
    if (state === null) onChange(true);
    else if (state === true) onChange(false);
    else onChange(null);
  };

  const baseStyle = "px-2.5 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer";
  let dynamicStyle = "";
  let tooltip = "";

  if (state === null) {
    if (globalDefault) {
      dynamicStyle = defaultColor === 'gray' 
        ? "bg-gray-200 text-gray-800 border-transparent"
        : "bg-purple-100 text-purple-800 border-transparent";
      tooltip = "Default ON: Follows global setting";
    } else {
      // Estado Natural: OFF (Riscado, cinza claro)
      dynamicStyle = "bg-gray-50 text-gray-400 border-transparent line-through opacity-60";
      tooltip = "Default OFF: Follows global setting";
    }
  } else if (state === true) {
    dynamicStyle = defaultColor === 'gray'
      ? "bg-gray-300 text-gray-900 border-gray-500 ring-2 ring-gray-400"
      : "bg-purple-200 text-purple-900 border-purple-500 ring-2 ring-purple-300";
    tooltip = "Forced ON: Always included";
  } else if (state === false) {
    dynamicStyle = "bg-gray-100 text-gray-500 border-gray-400 ring-2 ring-gray-200 line-through opacity-80";
    tooltip = "Forced OFF: Always excluded";
  }

  return (
    <button
      onClick={handleClick}
      title={tooltip}
      className={`${baseStyle} ${dynamicStyle}`}
    >
      {label}
    </button>
  );
}