export const state = {
  primulaReady: false,
  phase: "idle",
  message: "",
  plan: null,
};

export function setState(patch) {
  Object.assign(state, patch);
}
