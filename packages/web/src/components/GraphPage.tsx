"use client";

import { useState, useEffect, useCallback } from "react";
import { trpc } from "../lib/trpc";
import { RadialGraph } from "./RadialGraph";
import { Sidebar } from "./Sidebar";
import { Timeline, type TimelineMarker } from "./Timeline";

interface CharacterNode {
  id: string;
  name: string;
  traits: string[];
}

interface RelationshipEdge {
  sourceId: string;
  targetId: string;
  intimacy: number;
  relationshipType: string;
}

interface GraphData {
  center: CharacterNode;
  characters: CharacterNode[];
  relationships: RelationshipEdge[];
}

interface SelectedEdge {
  sourceId: string;
  targetId: string;
  intimacy: number;
  relationshipType: string;
}

export interface PairEvent {
  id: number;
  tick: number;
  actorId: string;
  targetId: string;
  eventCode: string;
  intimacyChange: number;
  oldIntimacy: number;
  newIntimacy: number;
  relation: string;
  narrative: string;
}

export interface TimelinePoint {
  tick: number;
  intimacy: number;
}

interface GraphPageProps {
  currentTick: number;
  viewTick: number;
  onTickChange: (tick: number) => void;
  playing: boolean;
  onPlayToggle: () => void;
  advancing: boolean;
  onAdvanceDay: () => Promise<{ tick: number; dailySummary: string } | undefined>;
  onTickUpdate: (tick: number) => void;
  timelineMarkers?: TimelineMarker[];
}

export function GraphPage({
  currentTick,
  viewTick,
  onTickChange,
  playing,
  onPlayToggle,
  advancing,
  onAdvanceDay,
  onTickUpdate,
  timelineMarkers,
}: GraphPageProps) {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [allCharacters, setAllCharacters] = useState<CharacterNode[]>([]);
  const [centerId, setCenterId] = useState("liu_bei");
  const [selectedEdge, setSelectedEdge] = useState<SelectedEdge | null>(null);
  const [pairEvents, setPairEvents] = useState<PairEvent[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailySummary, setDailySummary] = useState("");
  const [error, setError] = useState<string | null>(null);

  const characterMap = new Map(allCharacters.map((c) => [c.id, c]));

  const fetchGraph = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [graph, chars] = await Promise.all([
        trpc.character.getGraph.query({ centerId: id, depth: 2 }),
        trpc.character.getAll.query(),
      ]);
      setGraphData(graph as GraphData);
      setAllCharacters(chars as CharacterNode[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph(centerId);
  }, [centerId, fetchGraph]);

  // Fetch snapshot when viewTick changes
  useEffect(() => {
    if (currentTick === 0) return;
    trpc.simulation.getGraphAtTick
      .query({ centerId, depth: 2, tick: viewTick })
      .then((graph) => setGraphData(graph as GraphData))
      .catch(() => {});
  }, [viewTick, centerId, currentTick]);

  // Fetch pair events + timeline when edge is selected
  useEffect(() => {
    if (!selectedEdge) {
      setPairEvents([]);
      setTimeline([]);
      return;
    }
    Promise.all([
      trpc.simulation.getPairEvents.query({
        actorId: selectedEdge.sourceId,
        targetId: selectedEdge.targetId,
      }),
      trpc.simulation.getIntimacyTimeline.query({
        actorId: selectedEdge.sourceId,
        targetId: selectedEdge.targetId,
      }),
    ]).then(([events, tl]) => {
      setPairEvents(events as PairEvent[]);
      setTimeline(tl as TimelinePoint[]);
    }).catch(() => {});
  }, [selectedEdge, currentTick]);

  const handleAdvanceDay = async () => {
    setError(null);
    try {
      const result = await onAdvanceDay();
      if (result) {
        setDailySummary(result.dailySummary);
      }
      // Refetch graph
      const graph = await trpc.character.getGraph.query({ centerId, depth: 2 });
      setGraphData(graph as GraphData);
      // Refresh selected edge data
      if (selectedEdge) {
        const [events, tl] = await Promise.all([
          trpc.simulation.getPairEvents.query({
            actorId: selectedEdge.sourceId,
            targetId: selectedEdge.targetId,
          }),
          trpc.simulation.getIntimacyTimeline.query({
            actorId: selectedEdge.sourceId,
            targetId: selectedEdge.targetId,
          }),
        ]);
        setPairEvents(events as PairEvent[]);
        setTimeline(tl as TimelinePoint[]);
        const updatedEdge = (graph as GraphData).relationships.find(
          (r) =>
            (r.sourceId === selectedEdge.sourceId && r.targetId === selectedEdge.targetId) ||
            (r.sourceId === selectedEdge.targetId && r.targetId === selectedEdge.sourceId),
        );
        if (updatedEdge) {
          setSelectedEdge({
            sourceId: updatedEdge.sourceId,
            targetId: updatedEdge.targetId,
            intimacy: updatedEdge.intimacy,
            relationshipType: updatedEdge.relationshipType,
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to advance day");
    }
  };

  return (
    <div style={styles.layout}>
      <div style={styles.main}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>RTK - Relationship Graph</h1>
            <span style={styles.tick}>Day {viewTick}{viewTick !== currentTick ? ` (live: ${currentTick})` : ""}</span>
          </div>
          <div style={styles.controls}>
            <label style={styles.label}>中心角色：</label>
            <select
              value={centerId}
              onChange={(e) => setCenterId(e.target.value)}
              style={styles.select}
            >
              {allCharacters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAdvanceDay}
              disabled={advancing}
              style={{
                ...styles.button,
                opacity: advancing ? 0.6 : 1,
                cursor: advancing ? "not-allowed" : "pointer",
              }}
            >
              {advancing ? "推進中..." : "推進一天"}
            </button>
          </div>
        </header>

        <Timeline
          currentTick={currentTick}
          viewTick={viewTick}
          onTickChange={onTickChange}
          playing={playing}
          onPlayToggle={onPlayToggle}
          markers={timelineMarkers}
        />

        {error && <div style={styles.error}>{error}</div>}

        {loading ? (
          <div style={styles.loading}>Loading...</div>
        ) : graphData ? (
          <RadialGraph data={graphData} onEdgeClick={setSelectedEdge} />
        ) : null}
      </div>

      <Sidebar
        selectedEdge={selectedEdge}
        characters={characterMap}
        pairEvents={pairEvents}
        timeline={timeline}
        viewTick={viewTick}
        dailySummary={dailySummary}
        currentTick={currentTick}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    display: "flex",
    height: "100%",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: 20,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    margin: 0,
  },
  tick: {
    fontSize: 14,
    color: "#f59e0b",
    backgroundColor: "#1e293b",
    padding: "4px 10px",
    borderRadius: 6,
    fontWeight: 600,
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  label: {
    fontSize: 14,
    color: "#94a3b8",
  },
  select: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #334155",
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    fontSize: 14,
  },
  button: {
    padding: "8px 16px",
    borderRadius: 6,
    border: "none",
    backgroundColor: "#f59e0b",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 700,
  },
  error: {
    padding: "12px 16px",
    backgroundColor: "#991b1b",
    borderRadius: 8,
    marginBottom: 12,
  },
  loading: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    color: "#64748b",
  },
};
