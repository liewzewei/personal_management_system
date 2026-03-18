/**
 * DiaryGraphView.tsx
 *
 * Interactive force-directed graph visualising diary entries and their tags.
 * Entry nodes connect to tag nodes via edges. Entries sharing tags cluster
 * together naturally. Uses D3.js for simulation, zoom/pan, and SVG rendering.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiaryGraphEntry {
  id: string;
  title: string | null;
  content_text: string | null;
  tags: string[] | null;
}

interface DiaryGraphViewProps {
  entries: DiaryGraphEntry[];
  onSelectEntry: (id: string) => void;
  loading?: boolean;
}

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: "entry" | "tag";
  /** Number of connected entries (only for tag nodes). */
  connectionCount: number;
}

interface GraphEdge extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTRY_RADIUS = 8;
const TAG_RADIUS = 11;
const HOVER_SCALE = 1.05;
const PURPLE_HOVER = "hsl(270, 60%, 55%)";
const AUTO_FIT_ALPHA_THRESHOLD = 0.05;

/** Compute label opacity as a smooth function of zoom level (fade in between 0.4–1.2). */
function labelOpacityForZoom(zoom: number): number {
  return Math.max(0, Math.min(1, (zoom - 0.4) / 0.8));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiaryGraphView({ entries, onSelectEntry, loading }: DiaryGraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // -----------------------------------------------------------------------
  // Derive nodes and edges
  // -----------------------------------------------------------------------

  const { nodes, edges, connectedMap } = useMemo(() => {
    const entryNodes: GraphNode[] = entries.map((e) => ({
      id: `entry-${e.id}`,
      label:
        e.title ||
        (e.content_text ? e.content_text.slice(0, 30) + (e.content_text.length > 30 ? "…" : "") : "Untitled"),
      type: "entry" as const,
      connectionCount: 0,
    }));

    // Collect unique tags and count connections
    const tagCountMap = new Map<string, number>();
    for (const entry of entries) {
      if (entry.tags) {
        for (const tag of entry.tags) {
          tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1);
        }
      }
    }

    const tagNodes: GraphNode[] = Array.from(tagCountMap.entries()).map(([tag, count]) => ({
      id: `tag-${tag}`,
      label: tag,
      type: "tag" as const,
      connectionCount: count,
    }));

    const edgeList: GraphEdge[] = [];
    for (const entry of entries) {
      if (entry.tags) {
        for (const tag of entry.tags) {
          edgeList.push({
            source: `entry-${entry.id}`,
            target: `tag-${tag}`,
          });
        }
      }
    }

    // Build a map of node id → set of connected node ids
    const connected = new Map<string, Set<string>>();
    for (const edge of edgeList) {
      const s = typeof edge.source === "string" ? edge.source : edge.source.id;
      const t = typeof edge.target === "string" ? edge.target : edge.target.id;
      if (!connected.has(s)) connected.set(s, new Set());
      if (!connected.has(t)) connected.set(t, new Set());
      connected.get(s)!.add(t);
      connected.get(t)!.add(s);
    }

    return {
      nodes: [...entryNodes, ...tagNodes],
      edges: edgeList,
      connectedMap: connected,
    };
  }, [entries]);

  // -----------------------------------------------------------------------
  // Node radius helper
  // -----------------------------------------------------------------------

  const getNodeRadius = useCallback(
    (node: GraphNode) => {
      return node.type === "entry" ? ENTRY_RADIUS : TAG_RADIUS;
    },
    []
  );

  // -----------------------------------------------------------------------
  // D3 simulation + rendering
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // Clear previous content
    svg.selectAll("*").remove();

    // Root group for zoom/pan
    const g = svg.append("g");

    // Deep copy nodes — start clustered near center with small random perturbations
    const cx = width / 2;
    const cy = height / 2;
    const simNodes: GraphNode[] = nodes.map((n) => ({
      ...n,
      x: cx + (Math.random() - 0.5) * 60,
      y: cy + (Math.random() - 0.5) * 60,
    }));
    const simEdges: GraphEdge[] = edges.map((e) => ({
      source: typeof e.source === "string" ? e.source : e.source.id,
      target: typeof e.target === "string" ? e.target : e.target.id,
    }));

    // ---- Physics forces (Hooke's law + Coulomb's law + position centering) ----
    const simulation = d3
      .forceSimulation<GraphNode>(simNodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphEdge>(simEdges)
          .id((d) => d.id)
          .distance(60)
          .strength(0.3)
      )
      .force(
        "charge",
        d3.forceManyBody<GraphNode>().strength(-150).distanceMax(300)
      )
      .force("x", d3.forceX<GraphNode>(cx).strength(0.05))
      .force("y", d3.forceY<GraphNode>(cy).strength(0.05))
      .force(
        "collide",
        d3.forceCollide<GraphNode>().radius((d) => getNodeRadius(d) + 6).iterations(2)
      );

    // ---- Render edges ----
    const edgeElements = g
      .append("g")
      .attr("class", "edges")
      .selectAll("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", "var(--muted-foreground)")
      .attr("stroke-opacity", 0.3)
      .attr("stroke-width", 1);

    // ---- Render nodes ----
    const nodeGroup = g
      .append("g")
      .attr("class", "nodes")
      .selectAll<SVGGElement, GraphNode>("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "grab")
      .style("transition", "opacity 200ms ease");

    // Circle for each node
    nodeGroup
      .append("circle")
      .attr("r", (d) => getNodeRadius(d))
      .attr("fill", "var(--primary)")
      .attr("stroke", "var(--primary)")
      .attr("stroke-width", 1.5)
      .style("transition", "r 200ms ease, fill 200ms ease, stroke 200ms ease, opacity 200ms ease");

    // Label for each node
    nodeGroup
      .append("text")
      .text((d) => d.label)
      .attr("text-anchor", "middle")
      .attr("dy", (d) => getNodeRadius(d) + 14)
      .attr("font-size", (d) => (d.type === "tag" ? "11px" : "10px"))
      .attr("font-family", "inherit")
      .attr("fill", "var(--foreground)")
      .attr("pointer-events", "none")
      .style("opacity", 0)
      .style("transition", "opacity 200ms ease");

    // Track current zoom for label opacity
    let currentZoom = 1;
    let hasFittedViewport = false;

    // ---- Live tick handler — updates positions each frame ----
    simulation.on("tick", () => {
      edgeElements
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);

      nodeGroup.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);

      // Auto-fit viewport once the simulation has mostly settled
      if (!hasFittedViewport && simulation.alpha() < AUTO_FIT_ALPHA_THRESHOLD) {
        hasFittedViewport = true;
        fitGraphToViewport(simNodes, width, height, svg, zoom);
      }
    });

    // ---- Drag behavior ----
    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on("start", function (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        d3.select(this).attr("cursor", "grabbing");
      })
      .on("drag", function (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d) {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", function (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        d3.select(this).attr("cursor", "grab");
      });

    nodeGroup.call(drag);

    // ---- Hover interactions ----
    nodeGroup
      .on("mouseenter", function (_event, d) {

        const connSet = connectedMap.get(d.id) ?? new Set();

        // Enlarge hovered node slightly (5%) and turn purple
        d3.select(this)
          .select("circle")
          .attr("r", getNodeRadius(d) * HOVER_SCALE)
          .attr("fill", PURPLE_HOVER)
          .attr("stroke", PURPLE_HOVER);

        // Show hovered node label
        d3.select(this).select("text").style("opacity", 1);

        // Connected edges turn purple, others fade
        edgeElements
          .attr("stroke", (e) => {
            const sourceId = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
            const targetId = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
            return sourceId === d.id || targetId === d.id ? PURPLE_HOVER : "var(--muted-foreground)";
          })
          .attr("stroke-opacity", (e) => {
            const sourceId = typeof e.source === "string" ? e.source : (e.source as GraphNode).id;
            const targetId = typeof e.target === "string" ? e.target : (e.target as GraphNode).id;
            return sourceId === d.id || targetId === d.id ? 0.8 : 0.05;
          });

        // Connected nodes stay same, unconnected fade
        nodeGroup.each(function (n) {
          if (n.id === d.id) return;
          const isConn = connSet.has(n.id);
          d3.select(this)
            .select("circle")
            .style("opacity", isConn ? 1 : 0.2);
          d3.select(this)
            .select("text")
            .style("opacity", isConn ? 1 : 0);
        });
      })
      .on("mouseleave", function () {

        const zoomOpacity = labelOpacityForZoom(currentZoom);

        // Reset all nodes
        nodeGroup.each(function (n) {
          d3.select(this)
            .select("circle")
            .attr("r", getNodeRadius(n))
            .attr("fill", "var(--primary)")
            .attr("stroke", "var(--primary)")
            .style("opacity", 1);
          d3.select(this).select("text").style("opacity", zoomOpacity);
        });

        // Reset edges
        edgeElements
          .attr("stroke", "var(--muted-foreground)")
          .attr("stroke-opacity", 0.3);
      });

    // ---- Click interactions ----
    nodeGroup.on("click", function (_event, d) {
      if (d.type === "entry") {
        const entryId = d.id.replace("entry-", "");
        onSelectEntry(entryId);
      }
    });

    // ---- Zoom / Pan ----
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        g.attr("transform", event.transform.toString());
        currentZoom = event.transform.k;

        // Gradual label opacity based on zoom level
        const zoomOpacity = labelOpacityForZoom(event.transform.k);
        nodeGroup.each(function () {
          d3.select(this).select("text").style("opacity", zoomOpacity);
        });
      });

    svg.call(zoom);

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [nodes, edges, connectedMap, getNodeRadius, onSelectEntry]);

  // -----------------------------------------------------------------------
  // Helper: fit graph to viewport
  // -----------------------------------------------------------------------

  function fitGraphToViewport(
    simNodes: GraphNode[],
    width: number,
    height: number,
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    zoom: d3.ZoomBehavior<SVGSVGElement, unknown>
  ) {
    const allX = simNodes.map((n) => n.x ?? 0);
    const allY = simNodes.map((n) => n.y ?? 0);
    if (allX.length === 0) return;

    const pad = 60;
    const minX = Math.min(...allX) - pad;
    const maxX = Math.max(...allX) + pad;
    const minY = Math.min(...allY) - pad;
    const maxY = Math.max(...allY) + pad;
    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const scale = Math.min(width / graphWidth, height / graphHeight, 1.5);
    const translateX = (width - graphWidth * scale) / 2 - minX * scale;
    const translateY = (height - graphHeight * scale) / 2 - minY * scale;

    svg
      .transition()
      .duration(600)
      .call(
        zoom.transform,
        d3.zoomIdentity.translate(translateX, translateY).scale(scale)
      );
  }

  // -----------------------------------------------------------------------
  // Empty states
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading entries for graph…</p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-muted-foreground">
            No diary entries yet. Write your first entry to see your graph.
          </p>
        </div>
      </div>
    );
  }

  const hasAnyTags = entries.some((e) => e.tags && e.tags.length > 0);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-background">
      <svg ref={svgRef} className="h-full w-full" />

      {/* Hint when entries exist but no tags */}
      {!hasAnyTags && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-muted/80 px-4 py-2 backdrop-blur-sm">
          <p className="text-xs text-muted-foreground">
            Add tags to your entries to see connections
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 flex items-center gap-4 rounded-md bg-muted/60 px-3 py-1.5 backdrop-blur-sm text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" />
          Entry
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
          Tag
        </span>
      </div>
    </div>
  );
}
