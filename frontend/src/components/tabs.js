// The five tabs, in order. Keys 1-5 switch them (for the live pitch); see App.jsx.
export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "sdp", label: "For SDP" },
  { id: "solar", label: "Solar" },
  { id: "demand", label: "Demand" },
  { id: "about", label: "About the data" },
];

/** The tab id a number key opens ("2" -> "sdp"), or null for any other key. */
export function tabForKey(key) {
  const index = Number(key) - 1;
  return Number.isInteger(index) && index >= 0 && index < TABS.length ? TABS[index].id : null;
}
