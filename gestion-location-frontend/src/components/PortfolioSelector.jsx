"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useAgencyPortfolio } from "@/context/AgencyPortfolioContext";
import { useLanguage } from "@/context/LanguageContext";

export default function PortfolioSelector() {
  const { clients, loading, error, selectedClientId, selectClient } = useAgencyPortfolio();
  const { t } = useLanguage();
  
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!search) return clients;
    const lowerSearch = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.nom?.toLowerCase().includes(lowerSearch) ||
        c.prenom?.toLowerCase().includes(lowerSearch) ||
        c.email?.toLowerCase().includes(lowerSearch)
    );
  }, [clients, search]);

  const selectedClient = useMemo(() => {
    if (!clients || !selectedClientId) return null;
    return clients.find((c) => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  if (loading) {
    return (
      <div style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", background: "rgba(0,0,0,0.05)", fontSize: "0.85rem", opacity: 0.7 }}>
        Chargement portefeuille...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", background: "rgba(255,0,0,0.05)", color: "red", fontSize: "0.85rem" }}>
        Erreur portefeuille
      </div>
    );
  }

  if (!clients || clients.length === 0) {
    return (
      <div style={{ padding: "0.4rem 0.8rem", borderRadius: "8px", border: "1px dashed var(--brand-border)", fontSize: "0.85rem", color: "var(--brand-text-muted)" }}>
        Aucun client pour le moment
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative", minWidth: "190px", fontFamily: "var(--font-geist-sans)" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "0.4rem 0.7rem",
          background: "var(--brand-surface)",
          border: "1px solid var(--brand-border)",
          borderRadius: "8px",
          boxShadow: "var(--brand-shadow-sm)",
          cursor: "pointer",
          textAlign: "left",
          fontSize: "0.85rem",
          fontWeight: 500,
          color: "var(--brand-text)",
          transition: "border-color 0.2s, box-shadow 0.2s"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
          <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--brand-text-muted)", fontWeight: 600 }}>
            Portefeuille Client
          </span>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {selectedClient ? `${selectedClient.prenom} ${selectedClient.nom}` : "Tous mes clients"}
          </span>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.6, flexShrink: 0, marginLeft: "10px", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: "280px",
            background: "var(--brand-surface)",
            border: "1px solid var(--brand-border)",
            borderRadius: "10px",
            boxShadow: "var(--brand-shadow-lg)",
            zIndex: 1000,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "400px"
          }}
        >
          <div style={{ padding: "10px", borderBottom: "1px solid var(--brand-border-soft)" }}>
            <div style={{ position: "relative" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--brand-text-muted)" }}>
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  padding: "8px 10px 8px 30px",
                  border: "1px solid var(--brand-border)",
                  borderRadius: "6px",
                  fontSize: "0.85rem",
                  background: "var(--brand-body-bg)",
                  color: "var(--brand-text)",
                  outline: "none"
                }}
              />
            </div>
          </div>

          <div style={{ overflowY: "auto", padding: "6px" }}>
            <button
              onClick={() => {
                selectClient(null);
                setOpen(false);
                setSearch("");
              }}
              style={{
                width: "100%",
                padding: "10px 12px",
                textAlign: "left",
                background: selectedClientId === null ? "var(--brand-primary-soft)" : "transparent",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: selectedClientId === null ? "var(--brand-primary)" : "var(--brand-text)",
                fontWeight: selectedClientId === null ? 600 : 500,
                fontSize: "0.9rem",
                transition: "background 0.15s"
              }}
              onMouseEnter={(e) => { if(selectedClientId !== null) e.currentTarget.style.background = "var(--brand-surface-hover)"; }}
              onMouseLeave={(e) => { if(selectedClientId !== null) e.currentTarget.style.background = "transparent"; }}
            >
              <span>✓ Tous mes clients</span>
            </button>

            {filteredClients.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  selectClient(c.id);
                  setOpen(false);
                  setSearch("");
                }}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  textAlign: "left",
                  background: selectedClientId === c.id ? "var(--brand-primary-soft)" : "transparent",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  color: "var(--brand-text)",
                  transition: "background 0.15s",
                  marginTop: "2px"
                }}
                onMouseEnter={(e) => { if(selectedClientId !== c.id) e.currentTarget.style.background = "var(--brand-surface-hover)"; }}
                onMouseLeave={(e) => { if(selectedClientId !== c.id) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <span style={{ fontWeight: selectedClientId === c.id ? 600 : 500, color: selectedClientId === c.id ? "var(--brand-primary)" : "var(--brand-text)" }}>
                    {c.prenom} {c.nom}
                  </span>
                  {selectedClientId === c.id && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-primary)" }}>
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--brand-text-muted)" }}>
                  {c.biens_count} bien{c.biens_count !== 1 ? 's' : ''} · {c.lots_count} lot{c.lots_count !== 1 ? 's' : ''}
                </div>
              </button>
            ))}

            {filteredClients.length === 0 && search && (
              <div style={{ padding: "12px", textAlign: "center", color: "var(--brand-text-muted)", fontSize: "0.85rem" }}>
                Aucun client trouvé
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
