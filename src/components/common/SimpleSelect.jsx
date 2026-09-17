import React, { useEffect, useRef, useState } from "react";
import "./SimpleSelect.css";

// Minimal hand-rolled dropdown - not react-select, not a native <select>.
// Built because react-select's JS-driven `styles` prop kept failing to
// produce a box that pixel-matches a plain <input> when placed in a tight
// inline row next to real <input> elements (ManageResorts' room category
// row). A native <select> would match height reliably (same browser form-
// control box model as <input>), but its open option list is OS-rendered
// and can't be color-themed at all - the reason dropdowns got migrated off
// native <select> in the first place. This is a plain button + absolutely
// positioned list: a normal HTML element (matches input height exactly,
// like a native select would) while still being 100% CSS-styleable (like
// react-select).
const SimpleSelect = ({ options, value, onChange, placeholder = "Select...", className = "" }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`simple-select ${className}`} ref={rootRef}>
      <button
        type="button"
        className="simple-select-control"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={selected ? "simple-select-value" : "simple-select-placeholder"}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`simple-select-chevron ${open ? "simple-select-chevron--open" : ""}`}>▾</span>
      </button>
      {open && (
        <ul className="simple-select-menu">
          {options.map((opt) => (
            <li
              key={opt.value}
              className={`simple-select-option ${opt.value === value ? "simple-select-option--selected" : ""}`}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SimpleSelect;
