import { useState, useEffect, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useLibrary } from './hooks/useLibrary';
import { ModuleCard } from './components/ModuleCard';
import { api } from './services/api';

function App() {
  const { library, isLoading, error } = useLibrary();
  
  const [modules, setModules] = useState({});
  const [showConfig, setShowConfig] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [showInvalid, setShowInvalid] = useState(false);
  
  const [isBuilding, setIsBuilding] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [buildError, setBuildError] = useState(null);
  
  const [globalConfig, setGlobalConfig] = useState({
    code_before_theory: true,
    print_headers: true,
    keep_theory_with_code: false,
    fallback_code_section_name: "Other Code",
    fallback_theory_section_name: "Other Theory",
    code_notebook_title: "Code Reference",
    theory_notebook_title: "Theoretical Appendix"
  });

  const [codeSections, setCodeSections] = useState([]);
  const [theorySections, setTheorySections] = useState([]);
  const [newCodeSec, setNewCodeSec] = useState("");
  const [newTheorySec, setNewTheorySec] = useState("");

  useEffect(() => {
    if (library) {
      const initMods = {};
      Object.keys(library).forEach(k => {
        initMods[k] = { ...library[k], codeSection: null, theorySection: null, isRemoved: false };
      });
      setModules(initMods);
    }
  }, [library]);

  const handleOverrideChange = (moduleId, field, value) => {
    setModules(prev => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        overrides: { ...prev[moduleId].overrides, [field]: value }
      }
    }));
  };

  const handleGlobalChange = (field, value) => setGlobalConfig(prev => ({ ...prev, [field]: value }));

  const handleToggleRemove = (moduleId, state) => {
    setModules(prev => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], isRemoved: state }
    }));
  };

  const handleRemoveAll = () => {
    setModules(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (next[k].valid) next[k].isRemoved = true;
      });
      return next;
    });
  };

  const addSection = (type) => {
    if (type === 'code' && newCodeSec.trim() && !codeSections.includes(newCodeSec.trim())) {
      setCodeSections(prev => [...prev, newCodeSec.trim()].sort());
      setNewCodeSec("");
    } else if (type === 'theory' && newTheorySec.trim() && !theorySections.includes(newTheorySec.trim())) {
      setTheorySections(prev => [...prev, newTheorySec.trim()].sort());
      setNewTheorySec("");
    }
  };

  const removedModulesList = useMemo(() => {
    return Object.values(modules)
      .filter(m => m.valid && m.isRemoved)
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [modules]);

  const invalidModulesList = useMemo(() => {
    return Object.values(modules)
      .filter(m => !m.valid)
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [modules]);

  const { groupedCode, groupedTheory } = useMemo(() => {
    const gCode = { DEFAULT: [] };
    const gTheory = { DEFAULT: [] };
    
    codeSections.forEach(sec => gCode[sec] = []);
    theorySections.forEach(sec => gTheory[sec] = []);

    Object.values(modules).forEach(mod => {
      if (!mod.valid || mod.isRemoved) return; 

      const hasCode = !!mod.files.code;
      const hasTheory = !!mod.files.theory;
      const keepTheory = mod.overrides.keep_theory_with_code !== null 
        ? mod.overrides.keep_theory_with_code 
        : globalConfig.keep_theory_with_code;

      const cSec = codeSections.includes(mod.codeSection) ? mod.codeSection : 'DEFAULT';
      const tSec = theorySections.includes(mod.theorySection) ? mod.theorySection : 'DEFAULT';

      if (hasCode && hasTheory) {
        if (keepTheory) {
          gCode[cSec].push({ ...mod, _renderContext: 'full' });
        } else {
          gCode[cSec].push({ ...mod, _renderContext: 'code' });
          gTheory[tSec].push({ ...mod, _renderContext: 'theory' });
        }
      } else if (hasCode) {
        gCode[cSec].push({ ...mod, _renderContext: 'code' });
      } else if (hasTheory) {
        gTheory[tSec].push({ ...mod, _renderContext: 'theory' });
      }
    });

    Object.values(gCode).forEach(list => list.sort((a, b) => a.id.localeCompare(b.id)));
    Object.values(gTheory).forEach(list => list.sort((a, b) => a.id.localeCompare(b.id)));

    return { groupedCode: gCode, groupedTheory: gTheory };
  }, [modules, globalConfig.keep_theory_with_code, codeSections, theorySections]);

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return; 

    const [context, moduleId] = draggableId.split('-');
    const destSection = destination.droppableId.replace(/(code|theory)-sec-/, '');
    
    setModules(prev => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId],
        [context === 'code' ? 'codeSection' : 'theorySection']: destSection === 'DEFAULT' ? null : destSection
      }
    }));
  };

  const handleCompile = async () => {
    setIsBuilding(true);
    setBuildError(null);
    
    try {
      const layoutPayload = { code_sections: {}, theory_sections: {} };
      
      codeSections.forEach(sec => {
        layoutPayload.code_sections[sec] = groupedCode[sec].map(m => m.id);
      });
      theorySections.forEach(sec => {
        layoutPayload.theory_sections[sec] = groupedTheory[sec].map(m => m.id);
      });

      const modulesPayload = {};
      Object.values(modules).forEach(mod => {
        if (mod.valid && !mod.isRemoved) {
          modulesPayload[mod.id] = mod;
        }
      });

      const payload = {
        global_config: globalConfig,
        layout: layoutPayload,
        modules: modulesPayload
      };

      const pdfBlob = await api.buildNotebook(payload);
      
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
      
    } catch (err) {
      setBuildError(err.message || "Compilation failed. Check backend logs.");
    } finally {
      setIsBuilding(false);
    }
  };

  const RenderDroppableSection = ({ context, sectionName, modulesList, isDefault, willPrintHeaders }) => {
    const droppableId = `${context}-sec-${isDefault ? 'DEFAULT' : sectionName}`;
    const isEmpty = modulesList.length === 0;
    const isOmitted = modulesList.every(m => context === 'code' ? m.overrides.omit_code : m.overrides.omit_theory);
    
    let headerStatus = "";
    if (isEmpty) headerStatus = "Empty - Won't be printed";
    else if (!willPrintHeaders && isDefault) headerStatus = "Fallback - Header is hidden";
    else if (isOmitted && !isEmpty) headerStatus = "All omitted - Won't be printed";

    return (
      <Droppable droppableId={droppableId}>
        {(provided, snapshot) => (
          <div 
            ref={provided.innerRef} 
            {...provided.droppableProps}
            className={`mb-6 p-4 rounded-xl border-2 border-dashed transition-colors ${
              snapshot.isDraggingOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50/50'
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <h3 className={`text-lg font-bold ${isEmpty || (isDefault && !willPrintHeaders) ? 'text-gray-400' : 'text-gray-800'}`}>
                {isDefault ? (context === 'code' ? globalConfig.fallback_code_section_name : globalConfig.fallback_theory_section_name) : sectionName}
              </h3>
              {headerStatus && (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-gray-200 text-gray-600 rounded">
                  {headerStatus}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-h-[100px]">
              {modulesList.map((mod, index) => (
                <Draggable key={`${context}-${mod.id}`} draggableId={`${context}-${mod.id}`} index={index}>
                  {(prov) => (
                    <ModuleCard 
                      module={mod} 
                      renderContext={mod._renderContext}
                      globalKeepTheory={globalConfig.keep_theory_with_code}
                      globalPrintHeaders={globalConfig.print_headers}
                      onOverrideChange={handleOverrideChange}
                      onRemove={(id) => handleToggleRemove(id, true)}
                      innerRef={prov.innerRef}
                      draggableProps={prov.draggableProps}
                      dragHandleProps={prov.dragHandleProps}
                    />
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              {isEmpty && !snapshot.isDraggingOver && (
                <div className="col-span-full flex items-center justify-center text-sm text-gray-400 border-2 border-dashed border-transparent h-full">
                  Drag algorithms here
                </div>
              )}
            </div>
          </div>
        )}
      </Droppable>
    );
  };

  const renderCodeNotebook = () => {
    const totalModules = Object.values(groupedCode).flat();
    if (totalModules.length === 0) return null;
    
    const isCompletelyOmitted = totalModules.every(mod => mod.overrides.omit_code);
    const hasPopulatedCustomSections = codeSections.some(sec => groupedCode[sec].length > 0);
    
    return (
      <section className={`mb-12 transition-opacity duration-300 ${isCompletelyOmitted ? 'opacity-50 grayscale' : ''}`}>
        <div className="flex flex-wrap items-center justify-between mb-4 border-b-2 border-gray-200 pb-2 gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-extrabold text-gray-900">{globalConfig.code_notebook_title}</h2>
            {isCompletelyOmitted && <span className="px-3 py-1 text-xs font-bold text-red-800 bg-red-100 rounded-full uppercase">Will not be printed</span>}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" value={newCodeSec} onChange={e => setNewCodeSec(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && addSection('code')}
              placeholder="New Code Section..." className="px-3 py-1.5 text-sm border rounded-md w-40 xl:w-auto"
            />
            <button onClick={() => addSection('code')} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md text-sm font-semibold text-gray-700">Add</button>
          </div>
        </div>

        {!hasPopulatedCustomSections && codeSections.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-800 text-sm rounded-md border border-blue-200">
            ℹ️ No custom sections have modules. The PDF will be generated <b>without</b> section headers.
          </div>
        )}

        {codeSections.map(sec => (
          <RenderDroppableSection key={`code-sec-${sec}`} context="code" sectionName={sec} modulesList={groupedCode[sec]} isDefault={false} willPrintHeaders={hasPopulatedCustomSections} />
        ))}
        <RenderDroppableSection context="code" sectionName="DEFAULT" modulesList={groupedCode['DEFAULT']} isDefault={true} willPrintHeaders={hasPopulatedCustomSections} />
      </section>
    );
  };

  const renderTheoryNotebook = () => {
    const totalModules = Object.values(groupedTheory).flat();
    if (totalModules.length === 0) return null;
    
    const isCompletelyOmitted = totalModules.every(mod => mod.overrides.omit_theory);
    const hasPopulatedCustomSections = theorySections.some(sec => groupedTheory[sec].length > 0);

    return (
      <section className={`mb-12 transition-opacity duration-300 ${isCompletelyOmitted ? 'opacity-50 grayscale' : ''}`}>
        <div className="flex flex-wrap items-center justify-between mb-4 border-b-2 border-gray-200 pb-2 gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-extrabold text-gray-900">{globalConfig.theory_notebook_title}</h2>
            {isCompletelyOmitted && <span className="px-3 py-1 text-xs font-bold text-red-800 bg-red-100 rounded-full uppercase">Will not be printed</span>}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" value={newTheorySec} onChange={e => setNewTheorySec(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && addSection('theory')}
              placeholder="New Theory Section..." className="px-3 py-1.5 text-sm border rounded-md w-40 xl:w-auto"
            />
            <button onClick={() => addSection('theory')} className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md text-sm font-semibold text-gray-700">Add</button>
          </div>
        </div>

        {!hasPopulatedCustomSections && theorySections.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-800 text-sm rounded-md border border-blue-200">
            ℹ️ No custom sections have modules. The PDF will be generated <b>without</b> section headers.
          </div>
        )}

        {theorySections.map(sec => (
          <RenderDroppableSection key={`theory-sec-${sec}`} context="theory" sectionName={sec} modulesList={groupedTheory[sec]} isDefault={false} willPrintHeaders={hasPopulatedCustomSections} />
        ))}
        <RenderDroppableSection context="theory" sectionName="DEFAULT" modulesList={groupedTheory['DEFAULT']} isDefault={true} willPrintHeaders={hasPopulatedCustomSections} />
      </section>
    );
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading library...</div>;
  if (error) return <div className="p-8 text-red-600 bg-red-50">{error}</div>;

  const activeModulesCount = Object.values(modules).filter(m => m.valid && !m.isRemoved).length;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
        
        <div className="w-full lg:w-1/2 flex-shrink-0 overflow-y-auto p-6 lg:p-8 border-r border-gray-200 custom-scrollbar">
          
          <header className="mb-8 flex justify-between items-end border-b pb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Grimoire Builder</h1>
              <p className="text-gray-600 mt-1">Select and arrange your ICPC algorithms</p>
            </div>
            <button 
              onClick={() => setShowConfig(!showConfig)}
              className="px-4 py-2 bg-gray-800 text-white text-sm font-semibold rounded-md shadow hover:bg-gray-700 transition-colors"
            >
              {showConfig ? 'Hide Settings' : 'Global Settings'}
            </button>
          </header>

          <div className="mb-8 space-y-4">
            {invalidModulesList.length > 0 && (
              <div>
                <button 
                  onClick={() => setShowInvalid(!showInvalid)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-800 text-sm font-semibold rounded-md hover:bg-red-100 transition-colors border border-red-200"
                >
                  Invalid Modules ({invalidModulesList.length})
                  <span>{showInvalid ? '▲' : '▼'}</span>
                </button>
                {showInvalid && (
                  <div className="mt-2 p-4 bg-red-50 border border-red-200 rounded-xl grid grid-cols-1 xl:grid-cols-2 gap-4 shadow-inner">
                    {invalidModulesList.map(mod => (
                      <div key={mod.id} className="p-3 bg-white border border-red-200 rounded-lg shadow-sm">
                        <span className="text-sm font-bold text-red-800">{mod.id}</span>
                        <ul className="list-disc pl-4 mt-2 text-xs text-red-600">
                          {mod.validation_errors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowRemoved(!showRemoved)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-md hover:bg-gray-200 transition-colors"
              >
                Removed Modules ({removedModulesList.length})
                <span>{showRemoved ? '▲' : '▼'}</span>
              </button>
              
              {activeModulesCount > 0 && (
                <button 
                  onClick={handleRemoveAll}
                  className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 text-sm font-semibold rounded-md hover:bg-red-100 transition-colors"
                >
                  Remove All
                </button>
              )}
            </div>

            {showRemoved && removedModulesList.length > 0 && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 shadow-inner">
                {removedModulesList.map(mod => (
                  <div key={mod.id} className="flex flex-col p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-gray-700 truncate">{mod.id}</span>
                      <button 
                        onClick={() => handleToggleRemove(mod.id, false)}
                        className="ml-2 text-blue-600 hover:text-blue-800 text-xs font-bold uppercase"
                        title="Restore module"
                      >
                        ➕
                      </button>
                    </div>
                    <div className="flex gap-1">
                      {mod.files.code && <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-blue-100 text-blue-800 rounded">C</span>}
                      {mod.files.theory && <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-purple-100 text-purple-800 rounded">T</span>}
                      {mod.files.header && <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-gray-200 text-gray-800 rounded">H</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showConfig && (
            <div className="mb-8 p-5 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col gap-5">
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="code_before_theory" checked={globalConfig.code_before_theory} onChange={(e) => handleGlobalChange('code_before_theory', e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                  <label htmlFor="code_before_theory" className="text-sm font-medium text-gray-700">Code Before Theory</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="print_headers" checked={globalConfig.print_headers} onChange={(e) => handleGlobalChange('print_headers', e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                  <label htmlFor="print_headers" className="text-sm font-medium text-gray-700">Print Headers Default</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="keep_theory_with_code" checked={globalConfig.keep_theory_with_code} onChange={(e) => handleGlobalChange('keep_theory_with_code', e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                  <label htmlFor="keep_theory_with_code" className="text-sm font-medium text-gray-700">Keep Theory With Code Default</label>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <label htmlFor="code_notebook_title" className="text-sm font-medium text-gray-700 w-24">Code Title:</label>
                    <input type="text" id="code_notebook_title" value={globalConfig.code_notebook_title} onChange={(e) => handleGlobalChange('code_notebook_title', e.target.value)} className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div className="flex items-center gap-3">
                    <label htmlFor="fallback_code_name" className="text-sm font-medium text-gray-700 w-24">Section Default:</label>
                    <input type="text" id="fallback_code_name" value={globalConfig.fallback_code_section_name} onChange={(e) => handleGlobalChange('fallback_code_section_name', e.target.value)} className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <label htmlFor="theory_notebook_title" className="text-sm font-medium text-gray-700 w-28">Theory Title:</label>
                    <input type="text" id="theory_notebook_title" value={globalConfig.theory_notebook_title} onChange={(e) => handleGlobalChange('theory_notebook_title', e.target.value)} className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                  <div className="flex items-center gap-3">
                    <label htmlFor="fallback_theory_name" className="text-sm font-medium text-gray-700 w-28">Section Default:</label>
                    <input type="text" id="fallback_theory_name" value={globalConfig.fallback_theory_section_name} onChange={(e) => handleGlobalChange('fallback_theory_section_name', e.target.value)} className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <main>
            {globalConfig.code_before_theory ? (
              <>
                {renderCodeNotebook()}
                {renderTheoryNotebook()}
              </>
            ) : (
              <>
                {renderTheoryNotebook()}
                {renderCodeNotebook()}
              </>
            )}
          </main>
        </div>

        <div className="w-full lg:w-1/2 flex flex-col bg-gray-800 shadow-inner z-10">
          <div className="h-16 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-6 flex-shrink-0">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2.5L17.5 9H13V4.5zM6 20V4h6v6h6v10H6z"/>
              </svg>
              PDF Preview
            </h2>
            
            <button 
              onClick={handleCompile} 
              disabled={isBuilding}
              className={`px-5 py-2 rounded-md font-bold text-sm shadow transition-all ${
                isBuilding 
                  ? 'bg-blue-600/50 text-white cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-500 text-white shadow-green-900/50'
              }`}
            >
              {isBuilding ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Compiling...
                </span>
              ) : (
                'Compile Notebook'
              )}
            </button>
          </div>

          <div className="flex-1 relative overflow-hidden bg-gray-800 flex items-center justify-center p-4">
            {buildError && (
              <div className="absolute top-4 left-4 right-4 z-20 p-4 bg-red-100 border border-red-300 text-red-800 rounded-lg shadow-lg">
                <h3 className="font-bold mb-1">Compilation Error</h3>
                <p className="text-sm">{buildError}</p>
              </div>
            )}

            {!pdfUrl && !isBuilding && !buildError && (
              <div className="text-center text-gray-500 flex flex-col items-center gap-4">
                <svg className="w-16 h-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="font-medium">Click "Compile Notebook" to generate the PDF.</p>
              </div>
            )}

            {isBuilding && (
              <div className="absolute inset-0 bg-gray-800/80 z-10 flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-blue-400 font-semibold animate-pulse">Running pdflatex (2 passes)...</p>
              </div>
            )}

            {pdfUrl && (
              <iframe 
                src={pdfUrl} 
                className={`w-full h-full rounded shadow-lg border border-gray-700 bg-white transition-opacity duration-300 ${isBuilding ? 'opacity-30' : 'opacity-100'}`}
                title="PDF Preview"
              />
            )}
          </div>
        </div>

      </div>
    </DragDropContext>
  );
}

export default App;