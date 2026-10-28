/* Objetivos diarios y rangos de campo, independientes de la interfaz. */
(function () {
  "use strict";
  const BP = (window.BP = window.BP || {});
  const definitions = [
    { id: "clear", label: "Despeja un sector", reward: 20, accepts: () => true },
    { id: "swift", label: "Victoria contrarreloj", reward: 35,
      accepts: (result) => result.elapsedMs <= ({ beginner: 90000, intermediate: 180000, expert: 360000 })[result.mode] },
    { id: "clean", label: "Gana sin usar poderes", reward: 45, accepts: (result) => result.usedPowers === 0 },
  ];

  function localDate(now = new Date()) {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function current(state, date = localDate()) {
    const completed = state.contracts && state.contracts.date === date ? state.contracts.completed : [];
    return definitions.map(({ id, label, reward }) => ({ id, label, reward, completed: completed.includes(id) }));
  }

  function completeWin(state, result, date = localDate()) {
    if (!state.contracts || state.contracts.date !== date) state.contracts = { date, completed: [] };
    const awarded = [];
    const eligible = ["beginner", "intermediate", "expert"].includes(result.mode);
    if (eligible) {
      state.fieldWins += 1;
      definitions.forEach((contract) => {
        if (!state.contracts.completed.includes(contract.id) && contract.accepts(result)) {
          state.contracts.completed.push(contract.id);
          awarded.push({ id: contract.id, label: contract.label, reward: contract.reward });
        }
      });
    }
    const nextRank = Math.floor(state.fieldWins / 3);
    const rankReward = nextRank > state.rank ? 30 + Math.min(nextRank, 100) * 5 : 0;
    state.rank = Math.max(state.rank, nextRank);
    return { awarded, rankReward, total: awarded.reduce((sum, item) => sum + item.reward, rankReward) };
  }

  class ContractsView {
    constructor(store) {
      this.store = store;
      this.element = document.getElementById("contractsList");
      this.rank = document.getElementById("fieldRank");
      this.streak = document.getElementById("expertStreak");
      this.lastSignature = "";
    }

    render() {
      const state = this.store.progression;
      const contracts = current(state);
      const signature = JSON.stringify([state.rank, state.fieldWins, state.expertStreak, state.bestExpertStreak, contracts]);
      if (signature === this.lastSignature) return;
      this.lastSignature = signature;
      if (this.rank) this.rank.textContent = `Rango ${state.rank} · ${state.fieldWins % 3}/3 victorias`;
      if (this.streak) this.streak.textContent = `Racha experta: ${state.expertStreak} · récord: ${state.bestExpertStreak}. Cada victoria suma +10% (máx. +150%); perder en experto la reinicia.`;
      if (this.element) this.element.innerHTML = contracts.map((contract) => `
        <li class="contract${contract.completed ? " is-complete" : ""}">
          <span>${contract.completed ? "✓" : "□"} ${contract.label}</span>
          <b>${contract.completed ? "Completado" : `+${contract.reward}`}</b>
        </li>`).join("");
    }
  }

  BP.Contracts = { definitions, localDate, current, completeWin };
  BP.ContractsView = ContractsView;
})();
