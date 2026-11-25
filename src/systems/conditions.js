// Minutes since midnight; weather ranges continuously from clear (0) to downpour (1).
export class Conditions {
  minutes = 14 * 60;
  weather = 0;
  auto = false;
  setAuto(on) {
    this.auto = on;
    if (on) this.next();
  }
  next(random = Math.random) {
    this.fromMinutes = this.minutes;
    this.fromWeather = this.weather;
    // Choose a different part of the day and a visibly different weather target.
    this.advanceMinutes = 300 + random() * 840;
    this.toWeather = (this.weather + 0.28 + 0.44 * random()) % 1;
    this.duration = 32 + random() * 28;
    this.elapsed = 0;
  }
  step(dt) {
    if (!this.auto) return;
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    const t = this.elapsed / this.duration,
      blend = t * t * (3 - 2 * t);
    this.minutes = (this.fromMinutes + this.advanceMinutes * blend) % 1440;
    this.weather =
      this.fromWeather + (this.toWeather - this.fromWeather) * blend;
    if (t === 1) this.next();
  }
}

export function bindConditions() {
  const state = new Conditions();
  const time = document.getElementById("time-of-day"),
    weather = document.getElementById("weather");
  const clock = document.getElementById("clock-label"),
    forecast = document.getElementById("weather-label");
  const toggle = document.getElementById("auto-conditions");
  function sync() {
    const minute = Math.floor(state.minutes),
      intensity = Math.round(state.weather * 100);
    const timeText =
      String(Math.floor(minute / 60)).padStart(2, "0") +
      ":" +
      String(minute % 60).padStart(2, "0");
    const weatherText =
      intensity < 13
        ? "Clear"
        : intensity < 36
          ? "Hazy"
          : intensity < 56
            ? "Cloudy"
            : intensity < 76
              ? "Rain"
              : "Downpour";
    if (+time.value !== minute) time.value = minute;
    if (+weather.value !== intensity) weather.value = intensity;
    if (clock.textContent !== timeText) {
      clock.textContent = timeText;
      time.setAttribute("aria-valuetext", timeText);
    }
    if (forecast.textContent !== weatherText) {
      forecast.textContent = weatherText;
      weather.setAttribute("aria-valuetext", weatherText);
    }
  }
  function manual() {
    state.setAuto(false);
    toggle.checked = false;
  }
  for (const slider of [time, weather]) {
    slider.addEventListener("pointerdown", manual);
    slider.addEventListener("input", () => {
      manual();
      if (slider === time) state.minutes = +time.value;
      else state.weather = +weather.value / 100;
      sync();
    });
  }
  // Mouse users can resume driving immediately; keyboard users retain normal tab focus.
  for (const control of [time, weather, toggle.closest("label")])
    control.addEventListener("pointerup", () =>
      requestAnimationFrame(() =>
        document.getElementById("world").focus({ preventScroll: true }),
      ),
    );
  toggle.addEventListener("change", () => state.setAuto(toggle.checked));
  sync();
  return {
    state,
    update(dt) {
      if (state.auto) {
        state.step(dt);
        sync();
      }
    },
  };
}
