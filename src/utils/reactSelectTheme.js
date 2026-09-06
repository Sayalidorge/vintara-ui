// src/utils/reactSelectTheme.js
//
// react-select's menu defaults to position:absolute with a low z-index and
// renders inline as a DOM child of its control. Any page that puts a Select
// inside a flex row which collapses to a stacked column on mobile (a common
// filter-bar pattern in this app - see UserInventory.css/DailyEntryDashboard's
// filter rows) risks a sibling element painting over the open menu once
// stacked, and any scrollable ancestor (e.g. .content-viewport's
// overflow-y:auto in UserLayout.css, the app shell's main scroll container)
// can clip/truncate the option list. Portaling the menu to <body> escapes
// both problems - but once portaled, the menu is no longer a DOM descendant
// of whatever page wrapper had scoped CSS (e.g.
// ".user-inventory-wrapper .filter-item .react-select__option--is-focused")
// theming it purple, so it silently falls back to react-select's default
// blue. These two exports fix both issues together for every Select in the
// app: pass `menuPortalTarget` and spread `themedSelectStyles(...)` into
// `styles`.
export const menuPortalTarget = typeof document !== "undefined" ? document.body : null;

// Returns a react-select `styles` object using the app's only two theme
// colors (var(--primary-purple), var(--primary-teal)) - never the library's
// default blue. Pass `overrides` to layer per-page sizing/behavior (e.g.
// control height, a custom valueContainer) on top of these color defaults -
// each overrides[key] is a normal react-select style function `(base, state)
// => {...}` and, for a key also defined below, receives the themed result
// (not react-select's raw default) as its `base` so it can extend rather
// than clobber the color logic; a key with no themed default is used as-is.
export function themedSelectStyles(overrides = {}) {
  const themed = {
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    control: (base, state) => ({
      ...base,
      borderColor: state.isFocused ? "var(--primary-purple)" : base.borderColor,
      boxShadow: "none",
      ":hover": { borderColor: "var(--primary-purple)" },
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected
        ? "var(--primary-purple)"
        : state.isFocused
        ? "#f3e6f5"
        : "#fff",
      color: state.isSelected ? "#fff" : "#333",
      cursor: "pointer",
    }),
  };

  const merged = { ...themed };
  for (const [key, overrideFn] of Object.entries(overrides)) {
    const themedFn = themed[key];
    merged[key] = themedFn
      ? (base, state) => overrideFn(themedFn(base, state), state)
      : overrideFn;
  }
  return merged;
}
