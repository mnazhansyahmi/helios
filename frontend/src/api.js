// Talks to the Helios FastAPI server (backend/app/main.py).

/** Full held-out accuracy results (Solar, Demand and About tabs). */
export async function fetchAccuracy() {
  const response = await fetch("/api/accuracy");
  if (!response.ok) throw new Error(`Server answered ${response.status}`);
  return response.json();
}

/** The plan for the next working day, for a number of scenario rooftops (omit for the server default). */
export async function fetchPlan(rooftops, signal) {
  const query = rooftops == null ? "" : `?rooftops=${rooftops}`;
  const response = await fetch(`/api/plan${query}`, { signal });
  if (!response.ok) {
    throw new Error(`Server answered ${response.status}`);
  }
  return response.json();
}
