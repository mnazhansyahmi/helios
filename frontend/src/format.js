// Number and time formatting shared by every component.

const whole = new Intl.NumberFormat("en-MY", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("en-MY", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const kwh = (n) => `${whole.format(n)} kWh`;
export const number = (n) => whole.format(n);

/** Big energy amounts read better in MWh: 11,700 kWh -> "11.7 MWh". */
export const energy = (n) => (n >= 1000 ? `${oneDecimal.format(n / 1000)} MWh` : kwh(n));

/** CO2 mass: 935 kg -> "935 kg", 4,900 kg -> "4.9 t". */
export const mass = (kg) => (kg >= 1000 ? `${oneDecimal.format(kg / 1000)} t` : `${whole.format(kg)} kg`);

/** Hour labels people say out loud: 0 -> "midnight", 12 -> "noon", 15 -> "3pm". */
export function hourName(h) {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/** "15:00-16:00" style range for one hourly bucket (hours are labelled by their start). */
export const hourRange = (h) => `${String(h).padStart(2, "0")}:00–${String((h + 1) % 24).padStart(2, "0")}:00`;

/** "2026-10-16" -> "Fri 16 Oct 2026" */
export function longDate(isoDay) {
  const d = new Date(`${isoDay}T12:00:00`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
