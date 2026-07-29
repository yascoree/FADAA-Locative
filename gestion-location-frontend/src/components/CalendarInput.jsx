"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ui.module.css";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function parseISO(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Calendrier déroulant accessible — remplace <input type="date"> dont le rendu
    natif est incohérent selon navigateur/OS. Navigation à trois niveaux
    (jours -> mois -> années) pour atteindre rapidement une date éloignée
    (ex. date de naissance). Le contrat onChange imite un évènement natif
    ({ target: { name, value } }) pour rester un remplacement direct des
    handlers `(e) => ... e.target.value` déjà branchés sur <TextField type="date">. */
export default function CalendarInput({ id, name, value, onChange, placeholder = "jj/mm/aaaa", min, max, disabled }) {
  const selected = useMemo(() => parseISO(value), [value]);
  const minDate = useMemo(() => parseISO(min), [min]);
  const maxDate = useMemo(() => parseISO(max), [max]);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("days"); // days | months | years
  const [viewDate, setViewDate] = useState(() => selected || new Date());
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function openPanel() {
    setViewDate(selected || new Date());
    setMode("days");
    setOpen(true);
  }

  function emit(date) {
    onChange?.({ target: { name, value: date ? toISO(date) : "" } });
  }

  function isDisabled(date) {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  }

  const today = startOfDay(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const dayCells = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const startOffset = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
    return cells;
  }, [year, month]);

  const decadeStart = year - (year % 10);
  const yearCells = useMemo(() => {
    const cells = [];
    for (let y = decadeStart - 1; y <= decadeStart + 10; y += 1) cells.push(y);
    return cells;
  }, [decadeStart]);

  const triggerLabel = selected
    ? selected.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : placeholder;

  return (
    <div className={styles.calendarWrap} ref={wrapRef}>
      <button
        type="button"
        id={id}
        className={styles.calendarTrigger}
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
          } else {
            openPanel();
          }
        }}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <i className="bi bi-calendar3" />
        <span className={selected ? styles.calendarValue : styles.calendarPlaceholder}>{triggerLabel}</span>
        {selected && (
          <span
            role="button"
            tabIndex={0}
            className={styles.calendarClear}
            onClick={(e) => {
              e.stopPropagation();
              emit(null);
            }}
            aria-label="Effacer la date"
          >
            <i className="bi bi-x-circle-fill" />
          </span>
        )}
      </button>

      {open && !disabled && (
        <div className={styles.calendarPanel} role="dialog" aria-label="Sélecteur de date">
          {mode === "days" && (
            <>
              <div className={styles.calendarHeader}>
                <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} aria-label="Mois précédent">
                  <i className="bi bi-chevron-left" />
                </button>
                <button type="button" className={styles.calendarHeaderLabel} onClick={() => setMode("months")}>
                  {MONTHS[month]} {year}
                </button>
                <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} aria-label="Mois suivant">
                  <i className="bi bi-chevron-right" />
                </button>
              </div>

              <div className={styles.calendarWeekdays}>
                {WEEKDAYS.map((w, i) => (
                  <span key={i}>{w}</span>
                ))}
              </div>

              <div className={styles.calendarGrid}>
                {dayCells.map((d, i) => {
                  if (!d) return <span key={`empty-${i}`} />;
                  const off = isDisabled(d);
                  const isSelected = selected && isSameDay(d, selected);
                  const isToday = isSameDay(d, today);
                  return (
                    <button
                      key={d.getTime()}
                      type="button"
                      disabled={off}
                      className={`${styles.calendarDay} ${isSelected ? styles.calendarDaySelected : ""} ${
                        isToday && !isSelected ? styles.calendarDayToday : ""
                      }`}
                      onClick={() => {
                        emit(d);
                        setOpen(false);
                      }}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {mode === "months" && (
            <>
              <div className={styles.calendarHeader}>
                <button type="button" onClick={() => setViewDate(new Date(year - 1, month, 1))} aria-label="Année précédente">
                  <i className="bi bi-chevron-left" />
                </button>
                <button type="button" className={styles.calendarHeaderLabel} onClick={() => setMode("years")}>
                  {year}
                </button>
                <button type="button" onClick={() => setViewDate(new Date(year + 1, month, 1))} aria-label="Année suivante">
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
              <div className={styles.calendarPickGrid}>
                {MONTHS.map((m, i) => (
                  <button
                    key={m}
                    type="button"
                    className={`${styles.calendarPickCell} ${i === month ? styles.calendarDaySelected : ""}`}
                    onClick={() => {
                      setViewDate(new Date(year, i, 1));
                      setMode("days");
                    }}
                  >
                    {m.slice(0, 3)}
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === "years" && (
            <>
              <div className={styles.calendarHeader}>
                <button type="button" onClick={() => setViewDate(new Date(year - 10, month, 1))} aria-label="Décennie précédente">
                  <i className="bi bi-chevron-left" />
                </button>
                <span className={styles.calendarHeaderLabel}>
                  {decadeStart} – {decadeStart + 9}
                </span>
                <button type="button" onClick={() => setViewDate(new Date(year + 10, month, 1))} aria-label="Décennie suivante">
                  <i className="bi bi-chevron-right" />
                </button>
              </div>
              <div className={styles.calendarPickGrid}>
                {yearCells.map((y) => (
                  <button
                    key={y}
                    type="button"
                    className={`${styles.calendarPickCell} ${y === year ? styles.calendarDaySelected : ""} ${
                      y < decadeStart || y > decadeStart + 9 ? styles.calendarPickCellMuted : ""
                    }`}
                    onClick={() => {
                      setViewDate(new Date(y, month, 1));
                      setMode("months");
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </>
          )}

          <div className={styles.calendarFooter}>
            <button
              type="button"
              className={styles.calendarFooterBtn}
              onClick={() => {
                emit(null);
                setOpen(false);
              }}
            >
              Effacer
            </button>
            <button
              type="button"
              className={`${styles.calendarFooterBtn} ${styles.calendarFooterBtnPrimary}`}
              onClick={() => {
                const now = new Date();
                if (isDisabled(startOfDay(now))) {
                  setViewDate(now);
                  setMode("days");
                  return;
                }
                emit(now);
                setOpen(false);
              }}
            >
              Aujourd&apos;hui
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
