// Talks to the Helios FastAPI server (backend/app/main.py).

/** Full held-out accuracy results (Solar, Demand and About tabs). */
export async function fetchAccuracy() {
  const response = await fetch("/api/accuracy");
  if (!response.ok) throw new Error(`Server answered ${response.status}`);
  return response.json();
}

/**
 * The plan for the next working day, for a number of scenario rooftops (omit for the server default)
 * and a day type ("forecast", or a real past "sunny" / "average" / "cloudy" day's sunlight).
 */
export async function fetchPlan(rooftops, signal, dayType = "forecast") {
  const params = new URLSearchParams();
  if (rooftops != null) params.set("rooftops", rooftops);
  if (dayType !== "forecast") params.set("day_type", dayType);
  const query = params.size ? `?${params}` : "";
  const response = await fetch(`/api/plan${query}`, { signal });
  if (!response.ok) {
    throw new Error(`Server answered ${response.status}`);
  }
  return response.json();
}

/** Twelve months of past weather through the models (For SDP "Season" view); null until generated. */
export async function fetchSeason() {
  const response = await fetch("/api/season");
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Server answered ${response.status}`);
  return response.json();
}
