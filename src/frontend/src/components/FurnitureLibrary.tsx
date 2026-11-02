import { useEffect, useRef, useState, type ComponentProps } from "react";
import HomePropsPanel from "./HomePropsPanel";

export default function FurnitureLibrary(props: Omit<ComponentProps<typeof HomePropsPanel>, "library">) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus({ preventScroll: true });
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); close(); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);
  return <div className="furniture-library">
    <button ref={trigger} type="button" className="secondary-button furniture-library-trigger" aria-expanded={open} aria-controls="furniture-library-drawer" aria-haspopup="dialog" onClick={() => open ? close() : setOpen(true)}>Furniture Library</button>
    {open && <aside id="furniture-library-drawer" className="furniture-library-drawer" role="dialog" aria-modal="false" aria-labelledby="furniture-library-title">
      <header className="furniture-library-header"><div><p className="eyebrow">Design Studio</p><h2 id="furniture-library-title">Furniture Library</h2></div><button ref={closeButton} type="button" className="secondary-button" onClick={close} aria-label="Close Furniture Library">Close <span aria-hidden="true">×</span></button></header>
      <div className="furniture-library-scroll"><HomePropsPanel {...props} library /></div>
    </aside>}
  </div>;
}
