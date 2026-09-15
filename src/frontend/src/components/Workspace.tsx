import { useEffect, useMemo, useRef, useState } from "react";
import { artifactUrl, createDesign, deleteDesign, duplicateDesign, listDesigns, loadStructure, loadSystemStatus, runVastuAnalysis, saveDesign, saveStructure, sendSystemTelemetry, uploadPlan } from "../api";
import type { AdaptationEvent, Design, DesignConfiguration, Selection, Structure, SystemMetrics, SystemState, UploadResult, VastuAnalysis } from "../types";
import { cloneStructure, commitHistory, initialHistory, redoHistory, undoHistory } from "../utils/editState";
import { cloneConfiguration, reconcileDesignConfiguration } from "../utils/designState";
import { confirmDiscardForNewFile, newFileResetState } from "../utils/sessionState";
import { readSnapshotHistory, writeWorkingSnapshot, type WorkingSnapshot } from "../utils/autosave";
import ComparePanel from "./ComparePanel";
import ControlCenter from "./ControlCenter";
import DesignManager from "./DesignManager";
import PlanSvg from "./PlanSvg";
import RendererBoundary from "./RendererBoundary";
import RoomAssignments from "./RoomAssignments";
import StructureInspector from "./StructureInspector";
import ThreeViewer from "./ThreeViewer";
import VastuPanel from "./VastuPanel";

type Tab = "Original" | "Processed" | "Reconstruction" | "3D View";
type Mode = "view" | "edit";
type StudioSection = "Structure" | "Design Studio" | "Vastu" | "Compare" | "Control Center";
const STORAGE_KEY = "resiliospace:last-plan";

export default function Workspace() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null); const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null); const [history, setHistory] = useState(() => initialHistory()); const [savedSnapshot, setSavedSnapshot] = useState("");
  const [status, setStatus] = useState<"idle" | "selected" | "processing" | "complete" | "saving" | "error">("idle"); const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Original"); const [mode, setMode] = useState<Mode>("view"); const [section, setSection] = useState<StudioSection>("Structure"); const [selection, setSelection] = useState<Selection>(null);
  const [sourceCollapsed, setSourceCollapsed] = useState(false); const [inspectorCollapsed, setInspectorCollapsed] = useState(false); const [fullscreen3D, setFullscreen3D] = useState(false);
  const [designs, setDesigns] = useState<Design[]>([]); const [activeDesign, setActiveDesign] = useState<Design | null>(null); const [designConfiguration, setDesignConfiguration] = useState<DesignConfiguration | null>(null);
  const [designSnapshot, setDesignSnapshot] = useState(""); const [designBusy, setDesignBusy] = useState(false); const [designError, setDesignError] = useState<string | null>(null);
  const [vastuAnalysis, setVastuAnalysis] = useState<VastuAnalysis | null>(null); const [showZones, setShowZones] = useState(false);
  const [compareAId, setCompareAId] = useState(""); const [compareBId, setCompareBId] = useState(""); const [compareVisualId, setCompareVisualId] = useState("");
  const [systemState, setSystemState] = useState<SystemState | null>(null); const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null); const [adaptations, setAdaptations] = useState<AdaptationEvent[]>([]); const [systemError, setSystemError] = useState<string | null>(null);
  const [rendererUnavailable, setRendererUnavailable] = useState(false); const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null); const restorationAttempted = useRef(false); const structure = history.present;
  const dirty = useMemo(() => Boolean(structure && savedSnapshot && JSON.stringify(structure) !== savedSnapshot), [structure, savedSnapshot]);
  const designDirty = useMemo(() => Boolean(activeDesign && designConfiguration && JSON.stringify({ name: activeDesign.name, configuration: designConfiguration }) !== designSnapshot), [activeDesign, designConfiguration, designSnapshot]);

  const activateDesign = (design: Design, currentStructure = structure) => {
    const configuration = currentStructure ? reconcileDesignConfiguration(design.configuration, currentStructure) : design.configuration;
    const next = { ...design, configuration };
    setActiveDesign(next); setDesignConfiguration(configuration); setDesignSnapshot(JSON.stringify({ name: design.name, configuration: design.configuration })); setVastuAnalysis(design.latest_analysis); setSelection(null);
  };
  const loadDesignState = async (planId: string, currentStructure: Structure, recoveredConfiguration?: DesignConfiguration) => {
    setDesignBusy(true); setDesignError(null);
    try {
      let available = await listDesigns(planId); if (!available.length) available = [await createDesign(planId)];
      setDesigns(available); activateDesign(available[0], currentStructure); if (recoveredConfiguration) setDesignConfiguration(reconcileDesignConfiguration(recoveredConfiguration, currentStructure)); setCompareAId(available[0].id); setCompareBId(available[1]?.id ?? available[0].id); setCompareVisualId(available[0].id);
    } catch (reason) { setDesignError(reason instanceof Error ? reason.message : "Design versions could not be loaded."); }
    finally { setDesignBusy(false); }
  };

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty || designDirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty, designDirty]);
  useEffect(() => {
    if (restorationAttempted.current) return; restorationAttempted.current = true;
    const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return;
    try { const plan = JSON.parse(raw) as UploadResult["plan"]; const recovery = readSnapshotHistory(plan.id); loadStructure(plan.id).then((loaded) => { const restored = recovery.snapshot?.payload.structure ?? loaded; setResult({ plan, structure: restored }); setHistory(initialHistory(restored)); setSavedSnapshot(JSON.stringify(loaded)); setStatus("complete"); setTab("Reconstruction"); void loadDesignState(plan.id, restored, recovery.snapshot?.payload.design_configuration); if (recovery.recoveredPrevious) setRecoveryMessage("The latest working snapshot could not be restored. ResilioSpace recovered the previous valid design state."); if (recovery.corrupted) void sendSystemTelemetry({ session_corrupted: true, autosave_health: recovery.snapshot ? "HEALTHY" : "FAILED" }).then(setSystemState).catch(() => undefined); }).catch(() => localStorage.removeItem(STORAGE_KEY)); }
    catch { localStorage.removeItem(STORAGE_KEY); }
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = () => loadSystemStatus().then((value) => { if (!active) return; setSystemState(value.state); setSystemMetrics(value.metrics); setAdaptations(value.adaptations); setSystemError(null); }).catch((reason) => { if (active) setSystemError(reason instanceof Error ? reason.message : "Unknown status error"); });
    void refresh(); const timer = window.setInterval(refresh, 5000); return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!result || !structure || !designConfiguration) return;
    const timer = window.setTimeout(() => {
      const snapshot: WorkingSnapshot = { schema_version: 1, metadata: { created_at: new Date().toISOString(), plan_id: result.plan.id, design_id: activeDesign?.id ?? null, design_name: activeDesign?.name ?? null }, payload: { plan: result.plan, structure, design_configuration: designConfiguration } };
      try { writeWorkingSnapshot(snapshot); void sendSystemTelemetry({ autosave_health: "HEALTHY", session_corrupted: false }).then(setSystemState).catch(() => undefined); }
      catch { void sendSystemTelemetry({ autosave_health: "FAILED" }).then(setSystemState).catch(() => undefined); }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [result, structure, designConfiguration, activeDesign?.id, activeDesign?.name]);
  useEffect(() => { if (systemState?.use_2d_fallback) { setRendererUnavailable(true); setSection("Structure"); setTab("Reconstruction"); setFullscreen3D(false); } }, [systemState?.use_2d_fallback]);
  useEffect(() => { const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setFullscreen3D(false); }; window.addEventListener("keydown", handleEscape); return () => window.removeEventListener("keydown", handleEscape); }, []);
  useEffect(() => { if (section !== "Design Studio" && section !== "Compare" && !(section === "Structure" && tab === "3D View")) setFullscreen3D(false); }, [section, tab]);
  useEffect(() => {
    if (!structure || !designConfiguration) return;
    const reconciled = reconcileDesignConfiguration(designConfiguration, structure);
    if (JSON.stringify(reconciled) !== JSON.stringify(designConfiguration)) setDesignConfiguration(reconciled);
  }, [structure, activeDesign?.id]);

  const chooseFile = (file?: File) => {
    if (!file) return;
    if (!confirmDiscardForNewFile(dirty, designDirty, window.confirm)) { if (inputRef.current) inputRef.current.value = ""; return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    localStorage.removeItem(STORAGE_KEY); const reset = newFileResetState();
    setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file)); setResult(reset.result); setHistory(reset.history); setSavedSnapshot(reset.savedSnapshot); setSelection(reset.selection); setError(null); setStatus("selected"); setTab(reset.tab); setMode("view"); setSection(reset.section); setDesigns(reset.designs); setActiveDesign(reset.activeDesign); setDesignConfiguration(reset.designConfiguration); setDesignSnapshot(reset.designSnapshot); setVastuAnalysis(reset.vastuAnalysis); setShowZones(reset.showZones); setCompareAId(reset.compareAId); setCompareBId(reset.compareBId); setCompareVisualId(reset.compareVisualId); setFullscreen3D(reset.fullscreen3D); setInspectorCollapsed(reset.inspectorCollapsed); setSourceCollapsed(false); setDesignError(null); if (inputRef.current) inputRef.current.value = "";
  };
  const process = async () => {
    if (!selectedFile) return; setStatus("processing"); setError(null);
    try { const payload = await uploadPlan(selectedFile); setResult(payload); setHistory(initialHistory(payload.structure)); setSavedSnapshot(JSON.stringify(payload.structure)); setStatus("complete"); setTab("Reconstruction"); localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.plan)); await loadDesignState(payload.plan.id, payload.structure); }
    catch (reason) { setStatus("error"); setError(reason instanceof Error ? reason.message : "Unexpected processing error."); }
  };
  const commit = (next: Structure) => setHistory((current) => commitHistory(current, next));
  const save = async () => { if (!result || !structure || !dirty) return; setStatus("saving"); setError(null); try { const stored = await saveStructure(result.plan.id, structure); setHistory((current) => ({ ...current, present: cloneStructure(stored) })); setSavedSnapshot(JSON.stringify(stored)); setStatus("complete"); } catch (reason) { setStatus("error"); setError(reason instanceof Error ? reason.message : "The structure could not be saved."); } };
  const updateHeight = (height: number) => {
    if (!structure || !Number.isFinite(height) || height < .5 || height > 10) return;
    if (designConfiguration) { const next = cloneConfiguration(designConfiguration); next.wall_height = height; updateDesignConfiguration(next); return; }
    const next = cloneStructure(structure); next.wall_height = height; commit(next);
  };

  const saveActiveDesign = async (): Promise<Design | null> => {
    if (!activeDesign || !designConfiguration) return null; setDesignBusy(true); setDesignError(null);
    try { const saved = await saveDesign(activeDesign.id, activeDesign.name.trim() || "Untitled Design", designConfiguration); setDesigns((items) => items.map((item) => item.id === saved.id ? saved : item)); activateDesign(saved); return saved; }
    catch (reason) { setDesignError(reason instanceof Error ? reason.message : "The design could not be saved."); return null; }
    finally { setDesignBusy(false); }
  };
  const createNewDesign = async () => {
    if (!result || (designDirty && !window.confirm("Discard unsaved design changes and create a new design?"))) return; setDesignBusy(true);
    try { const created = await createDesign(result.plan.id); setDesigns((items) => [...items, created]); activateDesign(created); setCompareBId(created.id); }
    catch (reason) { setDesignError(reason instanceof Error ? reason.message : "The design could not be created."); } finally { setDesignBusy(false); }
  };
  const duplicateActiveDesign = async () => {
    if (!activeDesign) return; let source = activeDesign; if (designDirty) { const saved = await saveActiveDesign(); if (!saved) return; source = saved; }
    setDesignBusy(true); try { const duplicated = await duplicateDesign(source.id); setDesigns((items) => [...items, duplicated]); activateDesign(duplicated); setCompareBId(duplicated.id); }
    catch (reason) { setDesignError(reason instanceof Error ? reason.message : "The design could not be duplicated."); } finally { setDesignBusy(false); }
  };
  const removeActiveDesign = async () => {
    if (!activeDesign || !window.confirm(`Delete “${activeDesign.name}”? This cannot be undone.`)) return; setDesignBusy(true);
    try { await deleteDesign(activeDesign.id); let remaining = designs.filter((item) => item.id !== activeDesign.id); if (!remaining.length && result) remaining = [await createDesign(result.plan.id)]; setDesigns(remaining); activateDesign(remaining[0]); setCompareAId(remaining[0].id); setCompareBId(remaining[1]?.id ?? remaining[0].id); setCompareVisualId(remaining[0].id); }
    catch (reason) { setDesignError(reason instanceof Error ? reason.message : "The design could not be deleted."); } finally { setDesignBusy(false); }
  };
  const loadDesign = (id: string) => { const target = designs.find((item) => item.id === id); if (!target || (designDirty && !window.confirm("Switch designs and discard unsaved design changes?"))) return; activateDesign(target); };
  const updateDesignConfiguration = (configuration: DesignConfiguration) => {
    setDesignConfiguration(configuration); setVastuAnalysis(null);
    setActiveDesign((current) => current ? { ...current, latest_analysis: null } : current);
    setDesigns((items) => items.map((item) => item.id === activeDesign?.id ? { ...item, latest_analysis: null } : item));
  };
  const analyze = async () => { if (!activeDesign || !designConfiguration?.orientation && designConfiguration?.orientation !== 0) return; const saved = designDirty ? await saveActiveDesign() : activeDesign; if (!saved) return; setDesignBusy(true); try { const analysis = await runVastuAnalysis(saved.id); setVastuAnalysis(analysis); setActiveDesign((current) => current ? { ...current, latest_analysis: analysis } : current); setDesigns((items) => items.map((item) => item.id === saved.id ? { ...item, latest_analysis: analysis } : item)); } catch (reason) { setDesignError(reason instanceof Error ? reason.message : "Analysis failed."); } finally { setDesignBusy(false); } };
  const reportRenderer = (fps: number, frameTime: number) => { void sendSystemTelemetry({ fps, frame_time_ms: frameTime, renderer_health: fps < 24 ? "SLOW" : "HEALTHY" }).then(setSystemState).catch(() => undefined); };
  const rendererFailed = () => { setRendererUnavailable(true); setSection("Structure"); setTab("Reconstruction"); setFullscreen3D(false); void sendSystemTelemetry({ renderer_health: "FAILED" }).then(setSystemState).catch(() => undefined); };
  const retryRenderer = () => { setRendererUnavailable(false); setSection("Structure"); setTab("3D View"); void sendSystemTelemetry({ renderer_health: "UNKNOWN" }).then(setSystemState).catch(() => undefined); };

  const is3D = Boolean(structure) && (section === "Design Studio" || section === "Compare" || (section === "Structure" && tab === "3D View"));
  const showInspector = Boolean(structure) && (section === "Design Studio" || (section === "Structure" && (tab === "Reconstruction" || tab === "3D View")));
  const currentAnalysis = vastuAnalysis;
  const effectiveWallHeight = designConfiguration?.wall_height ?? structure?.wall_height;

  return <section id="workspace" className={`workspace ${is3D ? "is-3d-workspace" : ""} ${fullscreen3D ? "fullscreen-3d" : ""}`} aria-labelledby="workspace-title">
    <div className="workspace-heading"><div><p className="eyebrow">Spatial design workspace</p><h2 id="workspace-title">Correct. Design. Compare. Understand.</h2></div>{structure && <div className="confidence-card"><span>Overall confidence</span><strong>{Math.round(structure.overall_confidence * 100)}%</strong><small>Heuristic estimate</small></div>}</div>
    <div className={`workspace-grid ${is3D ? "is-3d" : ""} ${is3D && sourceCollapsed ? "source-collapsed" : ""}`}>
      <aside className={`control-panel ${is3D && sourceCollapsed ? "is-collapsed" : ""}`}>
        {is3D && <button className="panel-collapse source-collapse" type="button" aria-expanded={!sourceCollapsed} onClick={() => setSourceCollapsed((value) => !value)} title={sourceCollapsed ? "Expand source panel" : "Collapse source panel"}>{sourceCollapsed ? "›" : "‹"}<span>{sourceCollapsed ? "Expand source panel" : "Collapse source panel"}</span></button>}
        <div className="control-panel-content"><h3>Source plan</h3><div className={`drop-zone ${selectedFile || result ? "has-file" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]); }}><span className="upload-icon" aria-hidden="true">↥</span><strong>{selectedFile?.name ?? result?.plan.original_name ?? "Drop a floor plan here"}</strong><span>{selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : result ? "Saved plan restored" : "PNG or JPG · up to 10 MB"}</span><button className="file-button" type="button" onClick={() => inputRef.current?.click()}>{selectedFile || result ? "Choose another" : "Choose file"}</button><input ref={inputRef} className="visually-hidden" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" onChange={(event) => chooseFile(event.target.files?.[0])} /></div>
        <button className="primary-button process-button" disabled={!selectedFile || status === "processing"} onClick={process}>{status === "processing" ? <><span className="spinner" /> Processing plan…</> : "Detect structure"}</button>
        <div className={`status-box ${status}`} role="status" aria-live="polite"><span className="status-dot" /><div><strong>{status === "idle" ? "Ready" : status === "selected" ? "New plan selected" : status === "processing" ? "Processing" : status === "saving" ? "Saving" : status === "complete" ? dirty ? "Unsaved structure" : "Structure saved" : "Needs attention"}</strong><p>{status === "idle" ? "Select a supported clean floor plan." : status === "selected" ? "Click Detect Structure to process this plan." : status === "processing" ? "Running the floor-plan processing pipeline." : status === "saving" ? "Validating and persisting the structural model." : status === "complete" ? dirty ? "Save to persist corrected geometry." : "Structural model is persisted." : error}</p></div></div>
        {structure && <><div className="candidate-counts"><div><strong>{structure.walls.length}</strong><span>Walls</span></div><div><strong>{structure.rooms.length}</strong><span>Rooms</span></div><div><strong>{structure.openings.length}</strong><span>Openings</span></div></div><div className="history-actions"><button disabled={!history.past.length} onClick={() => setHistory(undoHistory)}>Undo</button><button disabled={!history.future.length} onClick={() => setHistory(redoHistory)}>Redo</button><button className="save-button" disabled={!dirty || status === "saving"} onClick={save}>Save structure</button></div>{effectiveWallHeight !== undefined && <label className="height-control"><span>Structural wall height <strong>{effectiveWallHeight.toFixed(1)} m</strong></span><input type="range" min="2" max="5" step="0.1" value={effectiveWallHeight} onChange={(event) => updateHeight(Number(event.target.value))} /></label>}</>}
        {structure && section !== "Structure" && <DesignManager designs={designs} active={activeDesign} configuration={designConfiguration} dirty={designDirty} busy={designBusy} onLoad={loadDesign} onNameChange={(name) => setActiveDesign((current) => current ? { ...current, name } : current)} onConfigurationChange={updateDesignConfiguration} onCreate={createNewDesign} onSave={() => { void saveActiveDesign(); }} onDuplicate={duplicateActiveDesign} onDelete={removeActiveDesign} />}
        {designError && <p className="design-error" role="alert">{designError}</p>}</div>
      </aside>
      <div className="canvas-panel">
        {structure && <div className="studio-tabs" role="tablist" aria-label="Workspace sections">{(["Structure", "Design Studio", "Vastu", "Compare", "Control Center"] as StudioSection[]).map((item) => <button key={item} role="tab" aria-selected={section === item} onClick={() => setSection(item)}>{item}</button>)}</div>}
        {section === "Structure" && <><div className="tabs" role="tablist" aria-label="Plan views">{(["Original", "Processed", "Reconstruction", "3D View"] as Tab[]).map((item) => <button key={item} role="tab" aria-selected={tab === item} disabled={item !== "Original" && !structure} onClick={() => setTab(item)}>{item}</button>)}</div>{tab === "Reconstruction" && structure && <div className="mode-toolbar"><div className="segmented-control"><button aria-pressed={mode === "view"} onClick={() => setMode("view")}>View</button><button aria-pressed={mode === "edit"} onClick={() => setMode("edit")}>Edit Structure</button></div>{mode === "edit" && <span>Drag selected wall endpoints or openings. Numeric controls are in the inspector.</span>}</div>}<div className={`editor-layout ${showInspector ? "with-inspector" : ""} ${is3D ? "three-layout" : ""} ${is3D && inspectorCollapsed ? "inspector-collapsed" : ""}`}><div className={`plan-canvas ${tab === "3D View" ? "three-host" : ""}`} role="tabpanel">{!previewUrl && !structure ? <div className="empty-canvas"><span aria-hidden="true">⌗</span><strong>Your floor plan will appear here</strong><p>Use a clear, top-down, single-floor residential plan.</p></div> : tab === "Original" ? previewUrl ? <img src={previewUrl} alt="Uploaded original floor plan" /> : <div className="empty-canvas"><strong>Original preview is unavailable after reload.</strong><p>The saved structural model remains available.</p></div> : tab === "Processed" && result ? <img className="processed-image" src={artifactUrl(result.plan.id, "threshold")} alt="Backend threshold processing result" /> : tab === "Reconstruction" && structure ? <PlanSvg structure={structure} editable={mode === "edit"} selection={selection} onSelect={setSelection} onChange={commit} orientation={designConfiguration?.orientation} design={designConfiguration} /> : tab === "3D View" && structure ? <RendererBoundary onFailure={rendererFailed} onReturnTo2D={() => setTab("Reconstruction")}><ThreeViewer structure={structure} design={designConfiguration ?? undefined} selection={selection} onSelect={setSelection} fullscreen={fullscreen3D} onToggleFullscreen={() => setFullscreen3D((value) => !value)} renderingQuality={systemState?.rendering_quality} onTelemetry={reportRenderer} /></RendererBoundary> : null}</div>{showInspector && structure && <StructureInspector structure={structure} selection={selection} onSelect={setSelection} onChange={commit} editable={mode === "edit" && tab === "Reconstruction"} collapsed={is3D && inspectorCollapsed} onToggle={is3D ? () => setInspectorCollapsed((value) => !value) : undefined} />}</div></>}
        {section === "Design Studio" && structure && designConfiguration && <div className="design-studio-content"><div className={`editor-layout with-inspector three-layout ${inspectorCollapsed ? "inspector-collapsed" : ""}`}><div className="plan-canvas three-host" role="tabpanel"><RendererBoundary onFailure={rendererFailed} onReturnTo2D={() => { setSection("Structure"); setTab("Reconstruction"); }}><ThreeViewer structure={structure} design={designConfiguration} selection={selection} onSelect={setSelection} fullscreen={fullscreen3D} onToggleFullscreen={() => setFullscreen3D((value) => !value)} renderingQuality={systemState?.rendering_quality} onTelemetry={reportRenderer} /></RendererBoundary></div><StructureInspector structure={structure} selection={selection} onSelect={setSelection} onChange={commit} editable={false} collapsed={inspectorCollapsed} onToggle={() => setInspectorCollapsed((value) => !value)} design={designConfiguration} onDesignChange={updateDesignConfiguration} designMode /></div><RoomAssignments structure={structure} configuration={designConfiguration} selection={selection} onSelect={setSelection} onChange={updateDesignConfiguration} /></div>}
        {section === "Vastu" && structure && activeDesign && designConfiguration && <VastuPanel structure={structure} design={activeDesign} configuration={designConfiguration} analysis={currentAnalysis} busy={designBusy} showZones={showZones} onShowZones={setShowZones} onConfigurationChange={updateDesignConfiguration} onRun={analyze} />}
        {section === "Compare" && structure && <ComparePanel structure={structure} designs={designs} designAId={compareAId} designBId={compareBId} visualId={compareVisualId} selection={selection} fullscreen={fullscreen3D} renderingQuality={systemState?.rendering_quality} onTelemetry={reportRenderer} onFailure={rendererFailed} onDesignA={(id) => { setCompareAId(id); setCompareVisualId(id); }} onDesignB={setCompareBId} onVisual={setCompareVisualId} onSelect={setSelection} onToggleFullscreen={() => setFullscreen3D((value) => !value)} onReturnTo2D={() => { setSection("Structure"); setTab("Reconstruction"); }} />}
        {section === "Control Center" && <ControlCenter state={systemState} metrics={systemMetrics} history={adaptations} error={systemError} rendererUnavailable={rendererUnavailable} onRetryRenderer={retryRenderer} />}
        {recoveryMessage && <div className="recovery-message" role="status"><span>{recoveryMessage}</span><button onClick={() => setRecoveryMessage(null)} aria-label="Dismiss recovery message">×</button></div>}
        {section === "Structure" && <><div className="legend"><span><i className="wall-swatch" /> Wall</span><span><i className="room-swatch" /> Room</span><span><i className="opening-swatch" /> Opening</span><span>Low confidence uses a dashed/faded marker.</span></div>{structure?.processing_metadata.warnings.length ? <div className="warnings" aria-label="Detection warnings"><strong>Detection notes</strong>{structure.processing_metadata.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}</>}
      </div>
    </div>
  </section>;
}
