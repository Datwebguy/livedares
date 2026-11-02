'use strict';
function createAutoStart({ store, onChange, delay = 5000 }) {
 let timer;
 function schedule() {
  const state = store.state();
  if (!state.autoStart || state.challenge || !state.queue.length) { if (timer) clearTimeout(timer); timer = null; return; }
  if (timer) return;
  timer = setTimeout(() => { timer = null; const current = store.state(); if (current.autoStart && !current.challenge && current.queue.length && !store.startMostVoted()) onChange(); }, delay);
  timer.unref?.();
 }
 return { schedule, close: () => clearTimeout(timer) };
}
module.exports = { createAutoStart };
