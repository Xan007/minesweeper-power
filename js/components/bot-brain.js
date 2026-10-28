/* Deducciones a partir de pistas visibles; nunca consulta minas ocultas. */
(function () {
  "use strict";
  const BP = (window.BP = window.BP || {});
  const key = (cell) => `${cell.x},${cell.y}`;

  function analyze(board, knownMines = new Set()) {
    const constraints = [];
    const hidden = [];
    board.forEach((cell) => {
      if (!cell.revealed && !cell.flagged && !cell.frozen && !knownMines.has(key(cell))) hidden.push(cell);
      if (!cell.revealed || cell.adjacent <= 0 || cell.defused) return;
      let known = 0;
      const cells = [];
      board.neighbors(cell.x, cell.y).forEach((neighbor) => {
        if (neighbor.flagged || neighbor.defused || knownMines.has(key(neighbor))) known += 1;
        else if (!neighbor.revealed && !neighbor.frozen) cells.push(neighbor);
      });
      const mines = cell.adjacent - known;
      if (cells.length && mines >= 0 && mines <= cells.length) constraints.push({ cells, mines });
    });

    const safe = new Map();
    const mines = new Map();
    const mark = (cells, count) => {
      if (count === 0) cells.forEach((cell) => safe.set(key(cell), cell));
      else if (count === cells.length) cells.forEach((cell) => mines.set(key(cell), cell));
    };
    constraints.forEach((constraint) => mark(constraint.cells, constraint.mines));
    // Si un conjunto está contenido en otro, la diferencia también es una pista.
    constraints.forEach((a) => constraints.forEach((b) => {
      if (a === b || a.cells.length >= b.cells.length) return;
      const aKeys = new Set(a.cells.map(key));
      if (!a.cells.every((cell) => b.cells.some((other) => key(other) === key(cell)))) return;
      const difference = b.cells.filter((cell) => !aKeys.has(key(cell)));
      const remaining = b.mines - a.mines;
      if (remaining >= 0 && remaining <= difference.length) mark(difference, remaining);
    }));

    const remainingMines = Math.max(0, board.mineCount - board.flagsPlaced - board.minesDefused - knownMines.size);
    const baseline = hidden.length ? Math.min(1, remainingMines / hidden.length) : 1;
    const risks = hidden.map((cell) => {
      const related = constraints.filter((constraint) => constraint.cells.includes(cell));
      // Una aproximación local conservadora, no una probabilidad exacta.
      const risk = related.length ? Math.max(...related.map((c) => c.mines / c.cells.length)) : baseline;
      return { cell, risk };
    });
    return { safe: [...safe.values()].filter((cell) => !mines.has(key(cell))), mines: [...mines.values()], risks };
  }

  BP.BotBrain = { analyze };
})();
