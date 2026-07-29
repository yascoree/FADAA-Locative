"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import styles from "./ui.module.css";

const DEFAULT_CENTER = [33.5731, -7.5898]; // Casablanca
const DEFAULT_ZOOM = 6;
const PIN_ZOOM = 16;

/** Recherche d'adresse gratuite (OpenStreetMap Nominatim, sans clé d'API) —
    limitée au Maroc puisque la plateforme cible ce marché. */
async function searchAddress(query, signal) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&countrycodes=ma&accept-language=fr&q=${encodeURIComponent(
    query
  )}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Recherche indisponible");
  return res.json();
}

async function reverseGeocode(lat, lng, signal) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.display_name || null;
}

function buildPinIcon(L) {
  return L.divIcon({
    className: styles.mapPickerPinWrap,
    html: `<span class="${styles.mapPickerPin}"><span class="${styles.mapPickerPinDot}"></span></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 32],
  });
}

/** Sélecteur de localisation sur carte (Leaflet + OpenStreetMap, sans clé
    d'API ni facturation) — recherche d'adresse, géolocalisation du navigateur,
    clic sur la carte ou glisser-déposer du marqueur pour fixer les coordonnées
    précises d'un bien. Leaflet touche `window` dès son import : chargé
    dynamiquement dans un effet pour rester compatible avec le rendu serveur
    de Next.js. */
export default function MapPicker({
  label = "Localisation sur la carte",
  hint,
  adresse,
  latitude,
  longitude,
  onChange,
  readOnly = false,
}) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const leafletRef = useRef(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [geoBusy, setGeoBusy] = useState(false);
  const [locateBusy, setLocateBusy] = useState(false);
  const [locateError, setLocateError] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const wrapRef = useRef(null);

  // Le clic carte / drag marqueur sont branchés une seule fois (effet d'init à
  // deps []) : ils passent par cette ref plutôt que de fermer sur les props
  // pour toujours lire la dernière valeur de `adresse`/`onChange`.
  const latestRef = useRef({ adresse, onChange });
  useEffect(() => {
    latestRef.current = { adresse, onChange };
  });

  function placeMarker(lat, lng, L, map) {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { draggable: !readOnly, icon: buildPinIcon(L) }).addTo(map);
      if (!readOnly) {
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current.getLatLng();
          handlePick(pos.lat, pos.lng, true);
        });
      }
    }
  }

  async function handlePick(lat, lng, reverseLookup) {
    latestRef.current.onChange?.({ adresse: latestRef.current.adresse, latitude: lat, longitude: lng });
    if (mapRef.current) mapRef.current.panTo([lat, lng]);
    if (leafletRef.current && mapRef.current) placeMarker(lat, lng, leafletRef.current, mapRef.current);
    if (reverseLookup) {
      setGeoBusy(true);
      try {
        const label = await reverseGeocode(lat, lng);
        latestRef.current.onChange?.({ adresse: label || latestRef.current.adresse, latitude: lat, longitude: lng });
      } finally {
        setGeoBusy(false);
      }
    }
  }

  // Initialisation de la carte (une seule fois)
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (cancelled || mapRef.current) return;
      const L = mod.default;
      leafletRef.current = L;

      const hasCoords = latitude != null && longitude != null;
      // Molette désactivée par défaut : la carte est intégrée dans un formulaire
      // scrollable (modal) — sans ça, survoler la carte pour scroller la page
      // zoome la carte à la place et piège l'utilisateur. Zoom toujours possible
      // via les boutons +/-, le double-clic, ou le pincement tactile.
      const map = L.map(mapElRef.current, { zoomControl: false, scrollWheelZoom: false }).setView(
        hasCoords ? [latitude, longitude] : DEFAULT_CENTER,
        hasCoords ? PIN_ZOOM : DEFAULT_ZOOM
      );
      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      if (hasCoords) placeMarker(latitude, longitude, L, map);

      if (!readOnly) {
        map.on("click", (e) => {
          handlePick(e.latlng.lat, e.latlng.lng, true);
        });
      }
      map.whenReady(() => setMapReady(true));

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recentre la carte si les coordonnées changent depuis l'extérieur (ex. formulaire réinitialisé)
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) return;
    if (latitude == null || longitude == null) return;
    const current = markerRef.current?.getLatLng();
    if (current && Math.abs(current.lat - latitude) < 1e-6 && Math.abs(current.lng - longitude) < 1e-6) return;
    placeMarker(latitude, longitude, leafletRef.current, mapRef.current);
    mapRef.current.setView([latitude, longitude], Math.max(mapRef.current.getZoom(), PIN_ZOOM));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 3) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearchBusy(true);
      searchAddress(term, controller.signal)
        .then((data) => {
          setResults(data);
          setHighlighted(0);
          setSearchOpen(true);
        })
        .catch(() => {
          // Une recherche annulée ou en échec ne doit pas casser le formulaire.
        })
        .finally(() => setSearchBusy(false));
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function selectResult(result) {
    const lat = Number(result.lat);
    const lng = Number(result.lon);
    onChange?.({ adresse: result.display_name, latitude: lat, longitude: lng });
    if (mapRef.current) mapRef.current.setView([lat, lng], PIN_ZOOM);
    if (leafletRef.current && mapRef.current) placeMarker(lat, lng, leafletRef.current, mapRef.current);
    setQuery("");
    setResults([]);
    setSearchOpen(false);
  }

  function handleSearchKeyDown(e) {
    // Ce champ vit dans le formulaire du bien : sans ce garde-fou, Entrée
    // soumet tout le formulaire (perdant la sélection en cours) dès que
    // l'utilisateur valide avant que les suggestions Nominatim n'arrivent.
    if (e.key === "Enter") e.preventDefault();
    if (!searchOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectResult(results[highlighted]);
    } else if (e.key === "Escape") {
      setSearchOpen(false);
    }
  }

  function clearSearch() {
    setQuery("");
    setResults([]);
    setSearchOpen(false);
  }

  function clearLocation() {
    onChange?.({ adresse, latitude: null, longitude: null });
    if (markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    if (mapRef.current) mapRef.current.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setLocateError("Géolocalisation non supportée par ce navigateur.");
      return;
    }
    setLocateBusy(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocateBusy(false);
        handlePick(pos.coords.latitude, pos.coords.longitude, true);
        if (mapRef.current) mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], PIN_ZOOM);
      },
      () => {
        setLocateBusy(false);
        setLocateError("Position indisponible — autorisez la géolocalisation ou choisissez un point manuellement.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  const hasLocation = latitude != null && longitude != null;

  return (
    <label className={styles.field}>
      {label}
      <div className={styles.mapPickerWrap} ref={wrapRef}>
        {!readOnly && (
          <div className={styles.mapPickerSearchWrap}>
            <i className={`bi bi-search ${styles.mapPickerSearchIcon}`} />
            <input
              type="text"
              className={`${styles.fieldInput} ${styles.mapPickerSearchInput}`}
              placeholder="Rechercher une adresse, une ville..."
              value={query}
              onChange={(e) => {
                const next = e.target.value;
                setQuery(next);
                if (next.trim().length < 3) setResults([]);
              }}
              onFocus={() => results.length > 0 && setSearchOpen(true)}
              onKeyDown={handleSearchKeyDown}
            />
            {searchBusy && <i className={`bi bi-arrow-repeat ${styles.mapPickerSpinner}`} />}
            {!searchBusy && query && (
              <button type="button" className={styles.mapPickerSearchClear} onClick={clearSearch} aria-label="Effacer la recherche">
                <i className="bi bi-x-lg" />
              </button>
            )}

            {searchOpen && results.length > 0 && (
              <ul className={styles.mapPickerDropdown}>
                {results.map((r, i) => (
                  <li key={r.place_id}>
                    <button
                      type="button"
                      className={`${styles.mapPickerOption} ${i === highlighted ? styles.mapPickerOptionActive : ""}`}
                      onMouseEnter={() => setHighlighted(i)}
                      onClick={() => selectResult(r)}
                    >
                      <i className="bi bi-geo-alt-fill" />
                      <span>{r.display_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className={styles.mapPickerCanvasWrap}>
          <div className={styles.mapPickerCanvas} ref={mapElRef} />

          {!mapReady && (
            <div className={styles.mapPickerLoading}>
              <i className="bi bi-arrow-repeat" />
              Chargement de la carte...
            </div>
          )}

          {!readOnly && (
            <button
              type="button"
              className={styles.mapPickerLocateBtn}
              onClick={locateMe}
              disabled={locateBusy}
              title="Utiliser ma position actuelle"
            >
              <i className={`bi ${locateBusy ? "bi-arrow-repeat" : "bi-crosshair"} ${locateBusy ? styles.mapPickerSpin : ""}`} />
            </button>
          )}

          {!readOnly && !hasLocation && mapReady && (
            <span className={styles.mapPickerEmptyHint}>
              <i className="bi bi-hand-index-thumb" />
              Cliquez sur la carte pour placer le bien
            </span>
          )}
        </div>

        <div className={styles.mapPickerFooter}>
          <span className={styles.mapPickerHint}>
            {geoBusy ? (
              <>
                <i className="bi bi-arrow-repeat" style={{ marginRight: "0.3rem" }} />
                Recherche de l&apos;adresse...
              </>
            ) : hasLocation ? (
              <>
                <i className="bi bi-geo-alt-fill" style={{ marginRight: "0.3rem", color: "var(--brand-primary)" }} />
                {latitude.toFixed(5)}, {longitude.toFixed(5)}
              </>
            ) : readOnly ? (
              "Aucune localisation enregistrée."
            ) : (
              "Recherchez une adresse, cliquez sur la carte ou utilisez votre position."
            )}
          </span>
          {!readOnly && hasLocation && (
            <button type="button" className={styles.mapPickerClear} onClick={clearLocation}>
              <i className="bi bi-x-circle" />
              Effacer
            </button>
          )}
        </div>
        {locateError && <span className={styles.mapPickerError}>{locateError}</span>}
      </div>
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}
