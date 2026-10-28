/* ============================================================
   BUSCAMINAS POWER · utilidades compartidas
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function fitBoardCell(cols, rows, width, height, maxCell) {
    const fit = Math.min(maxCell, width / Math.max(1, cols), height / Math.max(1, rows));
    return Math.max(1, Math.floor(fit * 100) / 100);
  }

  function pad(value, length = 2) {
    return String(Math.abs(value)).padStart(length, "0");
  }

  function formatClock(ms) {
    const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  }

  function formatPrecise(ms) {
    const safe = Math.max(0, Math.round(Number(ms || 0)));
    const totalSeconds = Math.floor(safe / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const centis = Math.floor((safe % 1000) / 10);
    const base = hours > 0
      ? `${hours}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;
    return `${base}.${pad(centis)}`;
  }

  function formatDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat("es-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch (_error) {
      return date.toLocaleString();
    }
  }

  function formatCounter(value) {
    const number = Number(value) || 0;
    const sign = number < 0 ? "-" : "";
    return sign + pad(Math.abs(number), 3);
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomFloat(min, max) {
    return Math.random() * (max - min) + min;
  }

  function shuffle(array) {
    for (let index = array.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [array[index], array[swap]] = [array[swap], array[index]];
    }
    return array;
  }

  function angularDistance(a, b) {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
  }

  function isTyping(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function icon(id, className = "icon") {
    return `<svg class="${className}" aria-hidden="true"><use href="#${id}"></use></svg>`;
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (_error) { /* noop */ }
    }
  }

  BP.Utils = {
    $,
    $$,
    clamp,
    fitBoardCell,
    pad,
    formatClock,
    formatPrecise,
    formatDate,
    formatCounter,
    randomInt,
    randomFloat,
    shuffle,
    angularDistance,
    isTyping,
    escapeHtml,
    icon,
    vibrate,
  };
})();
