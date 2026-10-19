import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAccuracy, fetchPlan } from "./api.js";
import TopBar, { TABS } from "./components/TopBar.jsx";
import AboutTab from "./tabs/AboutTab.jsx";
import DemandTab from "./tabs/DemandTab.jsx";
import OverviewTab from "./tabs/OverviewTab.jsx";
import SdpTab from "./tabs/SdpTab.jsx";
import SolarTab from "./tabs/SolarTab.jsx";

const tabFromHash = () => {
  const id = window.location.hash.replace("#", "");
  return TABS.some((t) => t.id === id) ? id : null;
};

export default function App() {
  const [plan, setPlan] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [rooftops, setRooftops] = useState(null); // shared by every tab; starts at the noon match
  const [ready, setReady] = useState(false);       // true once the first noon-match plan has arrived
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(() => tabFromHash() ?? "overview");
  const inFlight = useRef(null);

  // Fetch the plan; a newer request cancels an older one, so dragging the slider stays snappy.
  const load = useCallback((count) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    fetchPlan(count, controller.signal)
      .then((next) => { setPlan(next); setError(null); })
      .catch((e) => { if (e.name !== "AbortError") setError(e); });
  }, []);

  useEffect(() => { load(rooftops); }, [rooftops, load]);
  useEffect(() => { fetchAccuracy().then(setAccuracy).catch(() => {}); }, []);

  // The pitch opens at the noon match: once the first plan tells us that number, switch to it.
  useEffect(() => {
    if (plan && rooftops === null) setRooftops(plan.scenario.preset_noon_match ?? plan.scenario.rooftops);
    if (plan && !ready && rooftops !== null && plan.scenario.rooftops === rooftops) setReady(true);
  }, [plan, rooftops, ready]);

  // Tabs: click, keys 1-5 (for the live pitch), and the address bar (#solar) so a refresh keeps the tab.
  const changeTab = useCallback((id) => {
    setTab(id);
    window.history.replaceState(null, "", `#${id}`);
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target;
      if (el.isContentEditable || el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && el.type !== "range")) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < TABS.length) changeTab(TABS[index].id);
    };
    const onHash = () => { const id = tabFromHash(); if (id) setTab(id); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", onHash);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("hashchange", onHash); };
  }, [changeTab]);

  if (!plan || !ready) {
    return (
      <div className="app app-waiting">
        <header className="band">
          <p className="wordmark">Helios</p>
          {error ? (
            <div className="headline">
              <h1>Can't reach the Helios server.</h1>
              <p className="headline-sub">Start it with <code>python run_demo.py</code>, then try again.</p>
              <button type="button" className="preset preset-small" onClick={() => load(rooftops)}>Try again</button>
            </div>
          ) : (
            <div className="headline"><h1 className="loading">Loading the next working day's forecast…</h1></div>
          )}
        </header>
      </div>
    );
  }

  const shownRooftops = rooftops ?? plan.scenario.rooftops;
  return (
    <div className="app">
      <TopBar tab={tab} onTab={changeTab} plan={plan} />
      {tab === "overview" && <OverviewTab plan={plan} rooftops={shownRooftops} onRooftops={setRooftops} error={error} />}
      {tab === "sdp" && <SdpTab plan={plan} />}
      {tab === "solar" && <SolarTab plan={plan} accuracy={accuracy} />}
      {tab === "demand" && <DemandTab plan={plan} accuracy={accuracy} />}
      {tab === "about" && <AboutTab plan={plan} />}
    </div>
  );
}
