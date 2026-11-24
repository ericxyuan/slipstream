import { vehicles } from "../vehicle/catalog.js";
import { formats } from "../world/events.js";
import { formatTime } from "./readouts.js";

const phases = {
  finished: "Finished",
  "false-start": "False start",
  dnf: "Did not finish",
  running: "Racing",
  countdown: "At the start",
  ready: "Ready",
};

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function metric(label, value, secondary) {
  const row = element("div", "result-metric");
  const reading = element("dd", "", value);
  if (secondary) reading.append(element("small", "", secondary));
  row.append(element("dt", "", label), reading);
  return row;
}

function section(title, rows) {
  const group = element("section", "result-section");
  const list = element("dl");
  list.append(...rows);
  group.append(element("h3", "", title), list);
  return group;
}

const speed = (n) => (n * 3.6).toFixed(1) + " km/h";
const acceleration = (label, n) =>
  metric(label, n.toFixed(2) + " m/s²", (n / 9.80665).toFixed(2) + " g");

function metrics(result, course) {
  const grid = element("div", "result-metrics");
  if (result.phase === "false-start") {
    if (result.reaction != null)
      grid.append(section("Start timing", [metric("Before green", formatTime(Math.abs(result.reaction)))]));
    return grid;
  }
  const finished = result.phase === "finished";
  const timing = [];
  if (result.phase === "dnf" && result.elapsed > 0)
    timing.push(metric("Time on course", formatTime(result.elapsed)));
  if (result.reaction != null) timing.push(metric("Reaction time", formatTime(result.reaction)));
  if (result.lineTime != null) timing.push(metric("Crossed start line", formatTime(result.lineTime)));
  if (course.format === "circuit")
    timing.push(metric("Laps completed", result.completedLaps + " / " + course.config.laps));
  if (timing.length) grid.append(section("Timing", timing));
  if (finished || result.elapsed > 0) {
    const speeds = [];
    if (finished) speeds.push(metric("At finish", speed(result.finishSpeed)));
    speeds.push(metric("Top speed", speed(result.maxSpeed)));
    grid.append(section("Speed", speeds));
    const rates = [acceleration("Peak", result.maxAccel)];
    if (result.accelDuration > 0) rates.push(acceleration("Average", result.meanAccel));
    grid.append(section("Acceleration", rates));
  }
  return grid;
}

export function renderRaceResults(dialog, race, room, vehicle) {
  const byId = (id) => dialog.querySelector("#" + id);
  const { course } = race;
  const roster = room.state?.players;
  const local = roster?.find(p => p.id === room.id);
  const result = local?.result ?? race;
  const model = (id) => vehicles.find(v => v.id === id)?.name;
  const [name, edition] = (model(local?.vehicle) ?? vehicle.name).split(" · ");
  const rule = course.config.rules === "balanced" ? "Balanced" : "Authentic";
  byId("result-course").textContent = [course.name, formats[course.format], rule].join(" · ");
  byId("result-label").textContent = result.phase === "finished" ? "Your finish time" : "Your result";
  byId("result-time").textContent = result.phase === "finished" ? formatTime(result.elapsed) : phases[result.phase];
  byId("result-vehicle").textContent = name;
  byId("result-edition").textContent = edition ?? "";
  byId("result-edition").hidden = !edition;
  const stats = byId("result-stats");
  if (!roster) {
    stats.replaceChildren(metrics(result, course));
    return;
  }

  const expanded = new Set([...stats.querySelectorAll("details[open]")].map(row => row.dataset.driver));
  const hadStandings = !!stats.querySelector(".result-standings") && dialog.open;
  const standings = element("section", "result-standings");
  standings.append(element("h3", "", "Finishing order"));
  const finishTime = (p) => p.result.phase === "finished" ? p.result.elapsed : Infinity;
  const ordered = [...roster].sort((a, b) => finishTime(a) - finishTime(b));
  for (const [i, p] of ordered.entries()) {
    const own = p.id === room.id;
    const t = p.result, finished = t.phase === "finished";
    const row = element("details", "result-driver");
    row.dataset.driver = p.id;
    row.open = hadStandings ? expanded.has(String(p.id)) : own;
    const summary = element("summary");
    const identity = element("span", "result-driver-name");
    identity.append(element("b", "", p.name + (own ? " (you)" : "")), element("small", "", model(p.vehicle)));
    const place = element("span", "result-place", finished ? String(i + 1) : "—");
    place.setAttribute("aria-label", finished ? "Place " + (i + 1) : "Unplaced");
    summary.append(place, identity,
      element("span", "result-driver-time", finished ? formatTime(t.elapsed) : phases[t.phase]));
    const detail = metrics(t, course);
    if (!detail.childElementCount) detail.append(element("p", "result-empty", "No recorded splits."));
    row.append(summary, detail);
    standings.append(row);
  }
  stats.replaceChildren(standings);
}
