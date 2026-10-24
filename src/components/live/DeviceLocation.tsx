import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import type { ErrorEvent, LocationEvent } from "leaflet";
import { useMap } from "react-leaflet";
import { validPoint, type GeoPoint } from "@/lib/nearby-nodes";

export function DeviceLocation({ point, onPoint }: { point: GeoPoint | null; onPoint: (point: GeoPoint) => void }) {
  const map = useMap();
  const [locating, setLocating] = useState(true);
  const [error, setError] = useState("");
  const centered = useRef(false);
  const locate = useCallback(() => {
    setError("");
    if (!window.isSecureContext || !navigator.geolocation) {
      setLocating(false);
      setError("Lokasi memerlukan HTTPS dan peramban yang mendukung lokasi perangkat.");
      return;
    }
    setLocating(true);
    centered.current = false;
    map.stopLocate();
    map.locate({ watch: true, setView: false, enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }, [map]);

  useEffect(() => {
    function found(event: LocationEvent) {
      const next = { latitude: event.latlng.lat, longitude: event.latlng.lng,
        ...(Number.isFinite(event.accuracy) && event.accuracy >= 0 ? { accuracy: event.accuracy } : {}) };
      if (!validPoint(next)) return;
      onPoint(next);
      setLocating(false);
      setError("");
      if (!centered.current) {
        centered.current = true;
        map.setView(event.latlng, Math.max(13, map.getZoom()), { animate: false });
      }
    }
    function failed(event: ErrorEvent) {
      setLocating(false);
      setError(event.code === 1 ? "Izin lokasi ditolak. Izinkan lokasi di pengaturan situs, lalu coba lagi."
        : event.code === 3 ? "Lokasi belum ditemukan. Periksa layanan lokasi, lalu coba lagi."
          : "Lokasi perangkat belum tersedia. Coba lagi.");
      if (event.code === 1) map.stopLocate();
    }
    map.on("locationfound", found);
    map.on("locationerror", failed);
    locate();
    return () => {
      map.stopLocate();
      map.off("locationfound", found);
      map.off("locationerror", failed);
    };
  }, [map, onPoint, locate]);

  const label = locating ? "Mencari lokasi Anda…" : point && !error ? "Pusatkan ke lokasi saya" : "Gunakan lokasi saya";
  return <div className="leaflet-top leaflet-right">
    <div className="leaflet-control map-location-control" onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
      <button type="button" aria-label={label} title={label} disabled={locating}
        onClick={event => { event.stopPropagation(); if (point && !error) map.setView([point.latitude, point.longitude], 14, { animate: false }); else locate(); }}>
        <LocateFixed size={19} aria-hidden="true" />
      </button>
      {locating && <span className="map-location-message" role="status">Mencari lokasi…</span>}
      {error && <p className="map-location-message" role="alert">{error}</p>}
    </div>
  </div>;
}
