/* ============================================================
   BUSCAMINAS POWER · modelo del tablero y reglas clásicas
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});
  const { shuffle } = BP.Utils;

  class Cell {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.mine = false;
      this.adjacent = 0;
      this.revealed = false;
      this.flagged = false;
      this.defused = false;
      this.exploded = false;
      this.frozen = false;
      this.wrongFlag = false;
    }
  }

  class MinesweeperBoard {
    constructor(width, height, mineCount) {
      this.width = Math.max(1, Math.floor(width));
      this.height = Math.max(1, Math.floor(height));
      this.area = this.width * this.height;
      this.mineCount = BP.Utils.clamp(Math.floor(mineCount), 1, Math.max(1, this.area - 1));
      this.reset();
    }

    reset() {
      this.grid = [];
      this.generated = false;
      this.revealedSafeCount = 0;
      for (let y = 0; y < this.height; y += 1) {
        const row = [];
        for (let x = 0; x < this.width; x += 1) {
          row.push(new Cell(x, y));
        }
        this.grid.push(row);
      }
    }

    get safeCount() {
      return this.area - this.mineCount;
    }

    get flagsPlaced() {
      let count = 0;
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          if (this.grid[y][x].flagged) count += 1;
        }
      }
      return count;
    }

    get minesDefused() {
      let count = 0;
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          if (this.grid[y][x].mine && this.grid[y][x].defused) count += 1;
        }
      }
      return count;
    }

    getCell(x, y) {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
      return this.grid[y][x];
    }

    neighbors(x, y) {
      const result = [];
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const cell = this.getCell(x + dx, y + dy);
          if (cell) result.push(cell);
        }
      }
      return result;
    }

    generate(safeX, safeY) {
      if (this.generated) return;
      const safe = new Set();
      const useZone = this.area >= 16;
      const radius = useZone ? 1 : 0;

      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const cell = this.getCell(safeX + dx, safeY + dy);
          if (cell) safe.add(cell.y * this.width + cell.x);
        }
      }

      let candidates = [];
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          const index = y * this.width + x;
          if (!safe.has(index)) candidates.push(index);
        }
      }

      if (candidates.length < this.mineCount) {
        candidates = [];
        for (let y = 0; y < this.height; y += 1) {
          for (let x = 0; x < this.width; x += 1) {
            if (x === safeX && y === safeY) continue;
            candidates.push(y * this.width + x);
          }
        }
      }

      shuffle(candidates);
      const total = Math.min(this.mineCount, candidates.length);
      this.mineCount = total;
      for (let index = 0; index < total; index += 1) {
        const flat = candidates[index];
        const x = flat % this.width;
        const y = Math.floor(flat / this.width);
        this.grid[y][x].mine = true;
      }

      this.computeAdjacency();
      this.generated = true;
    }

    computeAdjacency() {
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          const cell = this.grid[y][x];
          if (cell.mine) {
            cell.adjacent = 0;
            continue;
          }
          let count = 0;
          this.neighbors(x, y).forEach((neighbor) => {
            if (neighbor.mine) count += 1;
          });
          cell.adjacent = count;
        }
      }
    }

    _revealFrom(start, brokenFrozen = []) {
      const changed = [];
      const queued = new Set();
      const stack = [start];
      queued.add(start.y * this.width + start.x);

      while (stack.length > 0) {
        const cell = stack.pop();
        if (!cell || cell.revealed || cell.flagged) continue;
        if (cell.mine && !cell.defused) continue;
        if (cell.frozen) {
          cell.frozen = false;
          brokenFrozen.push(cell);
        }

        cell.revealed = true;
        if (!cell.mine) this.revealedSafeCount += 1;
        changed.push(cell);

        if (!cell.mine && cell.adjacent === 0) {
          this.neighbors(cell.x, cell.y).forEach((neighbor) => {
            if (neighbor.revealed || neighbor.flagged) return;
            if (neighbor.mine && !neighbor.defused) return;
            const key = neighbor.y * this.width + neighbor.x;
            if (queued.has(key)) return;
            queued.add(key);
            stack.push(neighbor);
          });
        }
      }

      return changed;
    }

    reveal(x, y) {
      if (!this.generated) this.generate(x, y);
      const cell = this.getCell(x, y);
      if (!cell || cell.revealed || cell.flagged || cell.frozen) {
        return { kind: "none", changed: [] };
      }
      if (cell.mine) {
        return { kind: "mine", cell, changed: [] };
      }
      const brokenFrozen = [];
      const changed = this._revealFrom(cell, brokenFrozen);
      return { kind: "safe", cell, changed, brokenFrozen };
    }

    toggleFlag(x, y) {
      const cell = this.getCell(x, y);
      if (!cell || cell.revealed) return null;
      cell.flagged = !cell.flagged;
      return cell;
    }

    chord(x, y) {
      const cell = this.getCell(x, y);
      if (!cell || !cell.revealed || cell.mine || cell.adjacent <= 0) {
        return { kind: "none", changed: [] };
      }

      const hidden = [];
      let flags = 0;
      let defused = 0;
      this.neighbors(x, y).forEach((neighbor) => {
        if (neighbor.flagged) flags += 1;
        else if (neighbor.mine && neighbor.defused) defused += 1;
        else if (!neighbor.revealed && !neighbor.frozen) hidden.push(neighbor);
      });

      // Una mina neutralizada ya cuenta como "satisfecha": sigue sumando
      // al número de la celda, pero no se puede volver a marcar.
      if (flags + defused !== cell.adjacent || hidden.length === 0) {
        return { kind: "none", changed: [] };
      }

      const mines = hidden.filter((neighbor) => neighbor.mine && !neighbor.defused);
      if (mines.length > 0) {
        return { kind: "mine", cell: mines[0], mines, changed: [] };
      }

      let changed = [];
      const brokenFrozen = [];
      hidden.forEach((neighbor) => {
        if (neighbor.mine && !neighbor.defused) return;
        if (neighbor.revealed) return;
        changed = changed.concat(this._revealFrom(neighbor, brokenFrozen));
      });

      return { kind: "safe", changed, brokenFrozen };
    }

    canChord(x, y) {
      const cell = this.getCell(x, y);
      if (!cell || !cell.revealed || cell.mine || cell.adjacent <= 0) return false;
      let flags = 0;
      let defused = 0;
      let hidden = 0;
      this.neighbors(x, y).forEach((neighbor) => {
        if (neighbor.flagged) flags += 1;
        else if (neighbor.mine && neighbor.defused) defused += 1;
        else if (!neighbor.revealed && !neighbor.frozen) hidden += 1;
      });
      return flags + defused === cell.adjacent && hidden > 0;
    }

    hasFreezeTarget(x, y, radius = 0) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const cell = this.getCell(x + dx, y + dy);
          if (cell && !cell.revealed && !cell.flagged && !cell.frozen) return true;
        }
      }
      return false;
    }

    defuse(cell) {
      if (!cell || !cell.mine) return false;
      cell.defused = true;
      cell.revealed = true;
      cell.flagged = false;
      cell.exploded = false;
      cell.frozen = false;
      return true;
    }

    defuseAt(x, y) {
      return this.defuse(this.getCell(x, y));
    }

    freezeArea(centerX, centerY, radius = 1) {
      if (!this.generated) this.generate(centerX, centerY);
      const changed = [];

      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const cell = this.getCell(centerX + dx, centerY + dy);
          if (!cell) continue;

          if (cell.mine) {
            if (cell.defused && cell.revealed) continue;
            cell.flagged = false;
            cell.defused = true;
            cell.revealed = true;
            cell.frozen = true;
            changed.push(cell);
          } else if (!cell.revealed) {
            cell.flagged = false;
            cell.revealed = true;
            cell.frozen = true;
            this.revealedSafeCount += 1;
            changed.push(cell);
          }
        }
      }

      return changed;
    }

    revealAllMines(explodedCell) {
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          const cell = this.grid[y][x];
          if (cell.mine && !cell.defused) {
            cell.revealed = true;
          }
          if (!cell.mine && cell.flagged) {
            cell.wrongFlag = true;
          }
        }
      }
      if (explodedCell && !explodedCell.defused) {
        explodedCell.exploded = true;
        explodedCell.revealed = true;
      }
    }

    flagAllMines() {
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          const cell = this.grid[y][x];
          if (cell.mine && !cell.revealed) cell.flagged = true;
          if (!cell.mine) cell.wrongFlag = false;
        }
      }
    }

    allSafeRevealed() {
      return this.revealedSafeCount >= this.safeCount;
    }

    forEach(callback) {
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          callback(this.grid[y][x]);
        }
      }
    }
  }

  BP.Cell = Cell;
  BP.Board = MinesweeperBoard;
})();
