import React from 'react';
import { TriStateBadge } from './TriStateBadge';
import { BiStateBadge } from './BiStateBadge';

const LinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const UnlinkIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1M9 15l6-6" />
  </svg>
);

const GripIcon = () => (
  <svg className="w-5 h-5 text-gray-400 hover:text-gray-600 cursor-grab" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9h2v2H8V9zm0 4h2v2H8v-2zm6-4h2v2h-2V9zm0 4h2v2h-2v-2z" />
  </svg>
);

export function ModuleCard({ 
  module, onOverrideChange, onRemove, renderContext = 'full', 
  globalKeepTheory, globalPrintHeaders,
  innerRef, draggableProps, dragHandleProps
}) {
  const { id, files, overrides, valid, validation_errors } = module;

  const isTheoryContext = renderContext === 'theory';
  const isCodeContext = renderContext === 'code';
  const isFullContext = renderContext === 'full';
  const isSplit = files.code && files.theory && !isFullContext;

  let isCardOmitted = false;
  if (isCodeContext && overrides.omit_code) isCardOmitted = true;
  if (isTheoryContext && overrides.omit_theory) isCardOmitted = true;
  if (isFullContext && overrides.omit_code && overrides.omit_theory) isCardOmitted = true;

  const theoryLocationState = overrides.keep_theory_with_code ?? null;
  const isEffectivelyKept = theoryLocationState !== null ? theoryLocationState : globalKeepTheory;

  const handleTheoryLocationChange = () => {
    let nextState = null;
    if (theoryLocationState === null) nextState = true;
    else if (theoryLocationState === true) nextState = false;
    else nextState = null;
    onOverrideChange(id, 'keep_theory_with_code', nextState);
  };

  let locationBtnClass = "";
  let locationTooltip = "";
  let LocationIcon = isEffectivelyKept ? LinkIcon : UnlinkIcon;

  if (theoryLocationState === null) {
    locationBtnClass = "text-gray-400 hover:text-gray-600 bg-gray-50 border-gray-200";
    locationTooltip = `Default: ${globalKeepTheory ? 'Joined with Code' : 'Split to Theory Appendix'}`;
  } else if (theoryLocationState === true) {
    locationBtnClass = "text-purple-700 bg-purple-100 border-purple-300 ring-2 ring-purple-200";
    locationTooltip = "Forced ON: Joined with Code";
  } else if (theoryLocationState === false) {
    locationBtnClass = "text-gray-500 bg-gray-200 border-gray-300 ring-2 ring-gray-300";
    locationTooltip = "Forced OFF: Split to Theory Appendix";
  }

  let cardBgStyle = valid ? 'bg-white border-gray-200 hover:border-gray-300 shadow-sm' : 'bg-red-50 border-red-200';
  if (isCardOmitted) cardBgStyle = 'bg-gray-50 border-gray-200 opacity-50 grayscale hover:opacity-75';

  return (
    <div ref={innerRef} {...draggableProps} className={`p-5 rounded-xl border transition-all relative ${cardBgStyle}`}>
      {isSplit && (
        <span className={`absolute top-0 right-0 text-[10px] uppercase font-bold px-2 py-1 rounded-bl-lg rounded-tr-xl ${isCardOmitted ? 'bg-gray-400 text-white' : 'bg-amber-500 text-white shadow-sm'}`}>
          Split: {isCodeContext ? 'Code' : 'Theory'}
        </span>
      )}

      <div className="flex items-center gap-2 mb-3">
        <div {...dragHandleProps} className="p-1 -ml-2 rounded hover:bg-gray-100 transition-colors">
          <GripIcon />
        </div>
        <h2 className={`text-lg font-bold truncate ${isCardOmitted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
          {id}
        </h2>
        
        {/* BOTÃO REMOVER */}
        <button 
          onClick={() => onRemove(id)}
          title="Remove module from notebook"
          className="ml-auto p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {!isTheoryContext && files.code && (
          <BiStateBadge
            label="Code"
            isOmitted={overrides.omit_code}
            onChange={(val) => onOverrideChange(id, 'omit_code', val)}
            color="blue"
          />
        )}
        
        {!isCodeContext && files.theory && (
          <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-md border border-gray-100 transition-colors">
            <BiStateBadge
              label="Theory"
              isOmitted={overrides.omit_theory}
              onChange={(val) => onOverrideChange(id, 'omit_theory', val)}
              color="purple"
            />
            
            <button 
              onClick={handleTheoryLocationChange}
              title={locationTooltip}
              className={`p-1 rounded flex items-center justify-center transition-all ${locationBtnClass}`}
            >
              <LocationIcon />
            </button>
          </div>
        )}
        
        {!isTheoryContext && files.header && files.code && !overrides.omit_code && (
          <TriStateBadge 
            label="Header" 
            state={overrides.print_header ?? null} 
            onChange={(val) => onOverrideChange(id, 'print_header', val)}
            defaultColor="gray"
            globalDefault={globalPrintHeaders} 
          />
        )}
      </div>

      {!valid && (
        <div className="mt-4 p-3 bg-red-100 rounded-md grayscale-0 opacity-100">
          <span className="text-xs font-bold text-red-800 uppercase tracking-wider">Issues detected</span>
          <ul className="list-disc pl-4 mt-2 text-sm text-red-700">
            {validation_errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}