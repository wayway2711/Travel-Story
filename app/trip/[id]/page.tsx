"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTrip } from "@/lib/useStore";
import {
  addDay,
  addStop,
  addStopMedia,
  removeDay,
  removeStop,
  removeStopMedia,
  moveStop,
  setStopTransport,
  setSegmentRoute,
  updateTrip,
} from "@/lib/store";
import { deleteMediaBlob, putMediaBlob } from "@/lib/media";
import type { SearchResult, Transport, TripStop } from "@/lib/types";
import { routing } from "@/lib/routing";
import { TravelMap } from "@/components/TravelMap";
import { PlanTimeline } from "@/components/PlanTimeline";
import type { TravelMapEngine } from "@/lib/map/engine";

export default function TripPage() {
  const params = useParams<{ id: string }>();
  const trip = useTrip(params.id);
  const router = useRouter();
  const engineRef = useRef<TravelMapEngine | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const fetchingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!trip) return;
    let cancelled = false;
    for (const seg of trip.segments) {
      if (seg.route || fetchingRef.current.has(seg.fromStopId)) continue;
      const from = trip.stops.find((s) => s.id === seg.fromStopId);
      const to = trip.stops.find((s) => s.id === seg.toStopId);
      if (!from || !to) continue;
      fetchingRef.current.add(seg.fromStopId);
      routing
        .getRoute([from.longitude, from.latitude], [to.longitude, to.latitude], seg.transport)
        .then((res) => {
          if (cancelled || !res.authoritative) return;
          setSegmentRoute(trip.id, seg.fromStopId, {
            ...seg,
            route: res.route,
            distance: res.distance,
            duration: res.duration,
          });
        })
        .catch(() => {})
        .finally(() => fetchingRef.current.delete(seg.fromStopId));
    }
    return () => {
      cancelled = true;
    };
  }, [trip]);

  if (!trip) {
    return (
      <div className="notfound">
        <p>找不到这个行程。</p>
        <Link href="/" className="btn">返回首页</Link>
      </div>
    );
  }

  function handleSelectStop(stopId: string) {
    setSelectedStopId(stopId);
    const stop = trip!.stops.find((s) => s.id === stopId);
    if (stop) engineRef.current?.flyToStop(stop);
  }

  function handleAddStop(dayId: string, r: SearchResult) {
    addStop(trip!.id, dayId, {
      name: r.name,
      city: r.city,
      country: r.country,
      latitude: r.latitude,
      longitude: r.longitude,
      type: r.type,
    });
  }

  function handleSetTransport(fromStopId: string, t: Transport) {
    setStopTransport(trip!.id, fromStopId, t);
  }

  function handleMoveStop(stopId: string, targetDayId: string, targetIndex: number) {
    moveStop(trip!.id, stopId, targetDayId, targetIndex);
  }

  function handleUpdateStopMemory(
    stopId: string,
    patch: Pick<TripStop, "visitedAt" | "note">
  ) {
    if (!trip) return;
    updateTrip(trip.id, {
      stops: trip.stops.map((stop) => (stop.id === stopId ? { ...stop, ...patch } : stop)),
    });
  }

  async function handleAddMedia(stopId: string, files: File[]) {
    if (!trip) return;
    for (const f of files) {
      const id = `media_${crypto.randomUUID()}`;
      try {
        await putMediaBlob(id, f);
      } catch (e) {
        console.warn("[travel-story] 素材写入 IndexedDB 失败", e);
        continue;
      }
      addStopMedia(trip.id, stopId, {
        id,
        kind: f.type.startsWith("video") ? "video" : "image",
        name: f.name,
        createdAt: Date.now(),
      });
    }
  }

  function handleRemoveMedia(stopId: string, mediaId: string) {
    if (!trip) return;
    removeStopMedia(trip.id, stopId, mediaId);
    deleteMediaBlob(mediaId).catch(() => {});
  }

  function handleHoverSearch(r: SearchResult | null) {
    const engine = engineRef.current;
    if (!engine) return;
    if (r) {
      engine.flyTo(
        { center: [r.longitude, r.latitude], zoom: 12.5, bearing: 0, pitch: 0 },
        700
      );
    } else if (trip) {
      engine.fitToStops(trip.stops, 100);
    }
  }

  return (
    <main className="plan">
      <header className="plan-topbar">
        <Link href="/" className="topbar-back font-mono">← 所有旅行</Link>
        <div className="topbar-title">
          <span className="font-mono kicker">MEMORIES</span>
          <h1 className="font-display">{trip.name}</h1>
        </div>
        <div className="topbar-actions">
          <button
            className="btn btn-ghost btn-sm"
            disabled={trip.stops.length < 2}
            onClick={() => router.push(`/trip/${trip.id}/record`)}
            title={trip.stops.length < 2 ? "至少添加两个地点才能生成" : "把旅行记录生成纪录片视频"}
          >🎬 生成纪录片</button>
          <button
            className="btn topbar-play"
            disabled={trip.stops.length < 2}
            onClick={() => router.push(`/trip/${trip.id}/play`)}
            title={trip.stops.length < 2 ? "至少添加两个地点才能播放" : "播放旅行足迹"}
          >▶ 播放足迹</button>
        </div>
      </header>

      <div className="plan-body">
        <aside className="plan-sidebar">
          <PlanTimeline
            trip={trip}
            selectedStopId={selectedStopId}
            onSelectStop={(s) => handleSelectStop(s.id)}
            onAddStop={handleAddStop}
            onRemoveStop={(id) => removeStop(trip.id, id)}
            onMoveStop={handleMoveStop}
            onSetTransport={handleSetTransport}
            onAddDay={() => addDay(trip.id)}
            onRemoveDay={(dayId) => removeDay(trip.id, dayId)}
            onHoverSearch={handleHoverSearch}
            onAddMedia={handleAddMedia}
            onRemoveMedia={handleRemoveMedia}
            onUpdateStopMemory={handleUpdateStopMemory}
          />
        </aside>

        <section className="plan-map">
          <TravelMap
            trip={trip}
            selectedStopId={selectedStopId}
            onReady={(engine) => (engineRef.current = engine)}
            onStopClick={(s) => handleSelectStop(s.id)}
          />
          <div className="map-legend font-mono">
            <span className="dot dot-traveled" /> 我们去过的地方
          </div>
        </section>
      </div>
    </main>
  );
}
