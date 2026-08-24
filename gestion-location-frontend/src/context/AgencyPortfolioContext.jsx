"use client";

import { createContext, useContext, useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";
import { fetchMyClients } from "@/lib/agences";

const AgencyPortfolioContext = createContext(null);

export function AgencyPortfolioProvider({ children }) {
  const [clients, setClients] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState(() => {
    try {
      const raw = sessionStorage.getItem("agency:selectedClientId");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  async function refreshClients() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyClients();
      setClients(data);
      // If previously selected id is no longer valid, reset to null
      if (selectedClientId && !data.some((c) => c.id === selectedClientId)) {
        setSelectedClientId(null);
        sessionStorage.removeItem("agency:selectedClientId");
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshClients();
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem("agency:selectedClientId", JSON.stringify(selectedClientId));
    } catch (e) {}
  }, [selectedClientId]);

  function selectClient(id) {
    setSelectedClientId(id ?? null);
  }

  return (
    <AgencyPortfolioContext.Provider
      value={{ clients, loading, error, selectedClientId, selectClient, refreshClients }}
    >
      {children}
    </AgencyPortfolioContext.Provider>
  );
}

export function useAgencyPortfolio() {
  const ctx = useContext(AgencyPortfolioContext);
  if (!ctx) throw new Error("useAgencyPortfolio must be used inside AgencyPortfolioProvider");
  return ctx;
}
