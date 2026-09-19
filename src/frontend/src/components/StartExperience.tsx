import type { StarterKind } from "../utils/startPlans";
import { SAMPLE_PLANS, STARTER_PLANS } from "../utils/startPlans";

type Choice = "home" | "samples" | "starters";
type Props = { choice: Choice; busy: boolean; error: string | null; onUpload: () => void; onChoice: (choice: Choice) => void; onSample: (name: string) => void; onStarter: (kind: StarterKind) => void };

export default function StartExperience({ choice, busy, error, onUpload, onChoice, onSample, onStarter }: Props) {
  return <section className="start-experience" aria-labelledby="start-title">
    <p className="eyebrow">A space to begin</p>
    <h1 id="start-title">{choice === "home" ? "Start your home design" : choice === "samples" ? "Use a sample plan" : "Editable starter templates"}</h1>
    <p className="start-intro">{choice === "home" ? "Choose a starting point. Every path leads to the same Structure workspace." : choice === "samples" ? "Try an included floor plan through the usual reconstruction workflow." : "Choose a simple layout, then explore and adjust it in the workspace."}</p>
    {choice !== "home" && <button className="start-back" type="button" disabled={busy} onClick={() => onChoice("home")}>← Back</button>}
    <div className="start-cards">
      {choice === "home" ? <>
        <button type="button" onClick={onUpload}><span aria-hidden="true">↥</span><strong>Upload Floor Plan</strong><small>Already have a plan? Upload PNG/JPG</small></button>
        <button type="button" onClick={() => onChoice("starters")}><span aria-hidden="true">⌗</span><strong>Create From Scratch</strong><small>Create a simple editable residential plan</small></button>
        <button type="button" onClick={() => onChoice("samples")}><span aria-hidden="true">▤</span><strong>Use Sample Plan</strong><small>Explore ResilioSpace with a demo house</small></button>
      </> : choice === "samples" ? SAMPLE_PLANS.map((sample) => <button key={sample.name} type="button" disabled={busy} onClick={() => onSample(sample.name)}><span aria-hidden="true">▤</span><strong>{sample.label}</strong><small>Open included PNG floor plan</small></button>)
        : STARTER_PLANS.map((starter) => <button key={starter.kind} type="button" disabled={busy} onClick={() => onStarter(starter.kind)}><span aria-hidden="true">⌗</span><strong>{starter.label}</strong><small>Editable starter layout</small></button>)}
    </div>
    {busy && <p role="status">Preparing your plan…</p>}
    {error && <p className="design-error" role="alert">{error}</p>}
  </section>;
}
