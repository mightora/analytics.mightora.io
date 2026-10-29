export const DAY = 86400000;
export const isoDay = value => new Date(value).toISOString().slice(0, 10);
export function dayRange(start, end) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new Error('Use ISO dates');
  const result = [];
  for (let t = Date.parse(start); t <= Date.parse(end); t += DAY) result.push(isoDay(t));
  return result;
}
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
}
export function sum(rows, field) { return rows.reduce((n, r) => n + (Number(r?.[field]) || 0), 0); }
export function percentage(part, total) { return total > 0 ? part / total * 100 : null; }
export function change(current, previous) { return previous > 0 ? (current - previous) / previous * 100 : null; }
export function mergeGroups(rows, dimension, metric = 'count') {
  const groups = new Map();
  for (const row of rows) {
    const name = String(row.dimensions?.[dimension] ?? row[dimension] ?? 'Unknown');
    const value = Number(row[metric] ?? row.sum?.[metric] ?? 0);
    groups.set(name, (groups.get(name) || 0) + value);
  }
  return [...groups].map(([name, value]) => ({name, value})).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}
export function redactPath(value) {
  return String(value || '/').split(/[?#]/)[0]
    .replace(/[\w.+-]+@[^/]+\.[^/]+/g, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\/\d{10,}(?=\/|$)/g, '/[id]')
    .replace(/\/[^/]{64,}/g, '/[redacted]');
}
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function coverageForHost(host, records, rumHosts) {
  const matching = records.filter(r => r.name === host);
  if (matching.some(r => r.proxied)) return 'Proxied · HTTP requests';
  if (rumHosts.includes(host)) return 'DNS only · browser page views';
  return 'DNS only · no edge request data';
}
export function completePreviousPeriod(days, start, end) {
  const length = (Date.parse(end) - Date.parse(start)) / DAY + 1;
  const previousEnd = isoDay(Date.parse(start) - DAY);
  const previousStart = isoDay(Date.parse(previousEnd) - (length - 1) * DAY);
  const rows = days.filter(d => d.date >= previousStart && d.date <= previousEnd);
  return rows.length === length && rows.every(d => d.edge?.status === 'available') ? rows : null;
}
