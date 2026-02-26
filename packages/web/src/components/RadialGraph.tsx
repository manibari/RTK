"use client";

import { useEffect, useRef, useCallback } from "react";
import cytoscape, { type Core, type EventObject } from "cytoscape";
import { theme } from "../lib/theme";
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

const EDGE_COLORS = {
  friend: "#7db88a",   // warm green
  rival: "#c47171",    // warm red
  neutral: "#9c9c9c",  // warm gray
};

function buildElements(data: GraphData) {
  const nodes = [
    {
      data: {
        id: data.center.id,
        label: data.center.name,
        traits: data.center.traits.join(", "),
        isCenter: true,
      },
    },
    ...data.characters.map((c) => ({
      data: {
        id: c.id,
        label: c.name,
        traits: c.traits.join(", "),
        isCenter: false,
      },
    })),
  ];

  const edges = data.relationships.map((r) => ({
    data: {
      id: `${r.sourceId}-${r.targetId}`,
      source: r.sourceId,
      target: r.targetId,
      intimacy: r.intimacy,
      relationshipType: r.relationshipType,
      label: `${r.intimacy}`,
    },
  }));

  return [...nodes, ...edges];
}

const STYLESHEET: cytoscape.StylesheetStyle[] = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "text-valign": "bottom",
      "text-margin-y": 8,
      "background-color": theme.textMuted,
      color: theme.textPrimary,
      "font-size": "14px",
      width: 40,
      height: 40,
    },
  },
  {
    selector: "node[?isCenter]",
    style: {
      "background-color": theme.accent,
      width: 56,
      height: 56,
      "font-size": "16px",
      "font-weight": "bold",
    },
  },
  {
    selector: "edge",
    style: {
      width: "mapData(intimacy, 0, 100, 1, 10)",
      "line-color": "#9c9c9c",
      "curve-style": "bezier",
      label: "data(label)",
      "font-size": "11px",
      color: theme.textSecondary,
      "text-background-color": theme.bg2,
      "text-background-opacity": 0.8,
      "text-background-padding": "3px",
    },
  },
  {
    selector: "edge[relationshipType = 'friend']",
    style: { "line-color": EDGE_COLORS.friend },
  },
  {
    selector: "edge[relationshipType = 'rival']",
    style: { "line-color": EDGE_COLORS.rival },
  },
  {
    selector: "edge[relationshipType = 'neutral']",
    style: { "line-color": EDGE_COLORS.neutral },
  },
  {
    selector: "edge:active",
    style: { "overlay-opacity": 0.2 },
  },
];

interface RadialGraphProps {
  data: GraphData;
  onEdgeClick?: (edge: { sourceId: string; targetId: string; intimacy: number; relationshipType: string }) => void;
}

export function RadialGraph({ data, onEdgeClick }: RadialGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const handleEdgeClick = useCallback(
    (evt: EventObject) => {
      if (!onEdgeClick) return;
      const edgeData = evt.target.data();
      onEdgeClick({
        sourceId: edgeData.source,
        targetId: edgeData.target,
        intimacy: edgeData.intimacy,
        relationshipType: edgeData.relationshipType,
      });
    },
    [onEdgeClick],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: buildElements(data),
      style: STYLESHEET,
      layout: {
        name: "concentric",
        concentric: (node: cytoscape.NodeSingular) => (node.data("isCenter") ? 10 : 1),
        levelWidth: () => 1,
        minNodeSpacing: 80,
        animate: true,
        animationDuration: 500,
      },
      userZoomingEnabled: true,
      userPanningEnabled: true,
    });

    cy.on("tap", "edge", handleEdgeClick);
    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [data, handleEdgeClick]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 600,
        backgroundColor: theme.bg1,
        borderRadius: 12,
      }}
    />
  );
}
