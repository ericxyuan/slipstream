const keys = {
  KeyJ: "jump",
  ShiftLeft: "boost",
  ShiftRight: "boost",
  KeyG: "configure",
  KeyP: "partyMenu",
  KeyV: "ready",
  KeyX: "menu",
  KeyF: "arm",
  Escape: "cancel",
  KeyE: "rise",
  KeyQ: "lower",
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "back",
  ArrowDown: "back",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "handbrake",
  KeyR: "reset",
  KeyC: "camera",
};
export class Input {
  held = new Map();
  constructor(actions, enabled = () => true) {
    this.enabled = enabled;
    this.actions = actions;
    let lastWheel = -Infinity,
      lastDirection = 0;
    window.addEventListener(
      "wheel",
      (e) => {
        if (
          document.querySelector("dialog[open]") ||
          e.target.closest?.(".conditions") ||
          e.ctrlKey ||
          e.metaKey ||
          !e.deltaY ||
          Math.abs(e.deltaX) > Math.abs(e.deltaY)
        )
          return;
        e.preventDefault();
        const direction = Math.sign(e.deltaY);
        const detent =
          e.deltaMode !== 0 ||
          (Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 90);
        // A wheel detent is discrete. Group a precision trackpad's inertia tail into its gesture.
        if (
          detent ||
          e.timeStamp - lastWheel > 150 ||
          direction !== lastDirection
        )
          actions.vehicle(direction);
        lastWheel = e.timeStamp;
        lastDirection = direction;
      },
      { passive: false },
    );
    window.addEventListener("keydown", (e) => {
      if (e.target.closest?.("input,select,textarea,[contenteditable=true]")) return;
      const dialog = document.querySelector("dialog[open]");
      const action = keys[e.code];
      if (dialog && !(action === "menu" || (dialog.id === "course-dialog" &&
          ["ready", "arm"].includes(action) && dialog.querySelector("#party-roster"))))
        return;
      if (!action || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (!e.repeat) this.press(e.code, action);
    });
    window.addEventListener("keyup", (e) => this.held.delete(e.code));
    window.addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => this.clear());
    document.querySelectorAll("[data-control]").forEach((el) => {
      const action = el.dataset.control;
      if (actions[action]) {
        el.addEventListener("click", () => actions[action]());
        return;
      }
      el.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        this.press(e.pointerId, action);
      });
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        el.addEventListener(event, (e) => this.held.delete(e.pointerId));
      el.addEventListener("keydown", (e) => {
        if (e.code === "Enter" && !e.repeat) {
          e.preventDefault();
          e.stopPropagation();
          this.press("btn" + e.code, action);
        }
      });
      el.addEventListener("keyup", (e) => this.held.delete("btn" + e.code));
    });
  }
  clear() {
    this.held.clear();
  }
  press(id, action) {
    if (!this.enabled(action)) return;
    this.held.set(id, action);
    this.actions[action]?.();
  }
  read() {
    const state = {
      forward: false,
      back: false,
      left: false,
      right: false,
      handbrake: false,
    };
    for (const action of this.held.values())
      if (this.enabled(action)) state[action] = true;
    return state;
  }
}
