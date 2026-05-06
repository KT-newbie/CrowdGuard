import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTranslation } from 'react-i18next';
import { getZoneCapacity } from '@/lib/zoneUtils';

interface ZoneData {
  id: string;
  name: string;
  peopleCount: number;
  capacity?: number;
  areaM2?: number;
  isSeated?: boolean;
  confidence?: number;
  points?: {x: number, y: number}[];
}

interface GateData {
  id: string;
  label: string;
  currentLoad: number;
  status: string;
  x?: number;
  y?: number;
}

interface RouteData {
  points: {x: number, y: number}[];
  color?: string;
  label?: string;
}

interface CrowdMapProps {
  zones: ZoneData[];
  attendeeLocations?: any[];
  userZoneId?: string | null;
  onZoneClick?: (zone: ZoneData) => void;
  userGateId?: string | null;
  onGateClick?: (gate: GateData) => void;
  gatesData?: GateData[];
  route?: RouteData | null;
  timeframe?: 'before' | 'during' | 'after';
  theme?: 'light' | 'dark';
  backgroundUrl?: string;
}

export const CrowdMap: React.FC<CrowdMapProps> = ({ 
  zones, 
  attendeeLocations, 
  userZoneId, 
  onZoneClick, 
  userGateId, 
  onGateClick, 
  gatesData, 
  route,
  theme = 'dark',
  backgroundUrl
}) => {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 300;
    const height = 200;

    // Defs for gradients/filters
    const defs = svg.append("defs");
    
    // Pulse animation for route
    const filter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-20%")
      .attr("y", "-20%")
      .attr("width", "140%")
      .attr("height", "140%");
    
    filter.append("feGaussianBlur")
      .attr("stdDeviation", "2")
      .attr("result", "blur");
    
    filter.append("feComposite")
      .attr("in", "SourceGraphic")
      .attr("in2", "blur")
      .attr("operator", "over");

    // Draw Arena Outline
    if (backgroundUrl) {
      svg.append("image")
        .attr("xlink:href", backgroundUrl)
        .attr("x", 10)
        .attr("y", 10)
        .attr("width", width - 20)
        .attr("height", height - 20)
        .attr("preserveAspectRatio", "xMidYMid slice")
        .attr("opacity", 0.4);
    }

    svg.append("rect")
      .attr("x", 10)
      .attr("y", 10)
      .attr("width", width - 20)
      .attr("height", height - 20)
      .attr("rx", 10)
      .attr("fill", theme === 'dark' ? "#0f172a" : "#ffffff")
      .attr("stroke", theme === 'dark' ? "rgba(255,255,255,0.1)" : "#e2e8f0")
      .attr("stroke-width", 1.5);

    // Draw Stage
    svg.append("rect")
      .attr("x", width / 2 - 40)
      .attr("y", 15)
      .attr("width", 80)
      .attr("height", 25)
      .attr("rx", 2)
      .attr("fill", "#334155");

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 31)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", "7px")
      .attr("font-weight", "bold")
      .text(t('stage').toUpperCase());

    // Draw FOH
    svg.append("rect")
      .attr("x", width / 2 - 15)
      .attr("y", 115)
      .attr("width", 30)
      .attr("height", 15)
      .attr("rx", 2)
      .attr("fill", "#475569");

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 125)
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("opacity", 0.5)
      .attr("font-size", "6px")
      .attr("font-weight", "bold")
      .text(t('foh').toUpperCase());

    if (zones.length === 0) {
      svg.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", theme === 'dark' ? "white" : "#94a3b8")
        .attr("opacity", 0.2)
        .attr("font-size", "8px")
        .attr("font-weight", "bold")
        .text(t('awaiting_telemetry').toUpperCase());
      return;
    }

    // 1. Draw Zone Shapes
    zones.forEach((zone) => {
      let pathData = "";
      const zid = zone.id.toLowerCase();

      if (zone.points && zone.points.length > 2) {
        pathData = "M " + zone.points.map(p => `${p.x} ${p.y}`).join(" L ") + " Z";
      } else if (zid.includes('standing')) pathData = `M 100 50 L 200 50 L 200 110 L 100 110 Z`;
      else if (zid.includes('cat1')) pathData = `M 85 50 L 95 50 L 95 110 L 85 110 Z M 205 50 L 215 50 L 215 110 L 205 110 Z`;
      else if (zid.includes('cat2')) pathData = `M 85 115 L 215 115 L 215 135 L 85 135 Z`;
      else if (zid.includes('cat3')) pathData = `M 70 50 L 80 50 L 80 135 L 70 135 Z M 220 50 L 230 50 L 230 135 L 220 135 Z`;
      else if (zid.includes('cat4')) pathData = `M 55 50 L 65 50 L 65 135 L 55 135 Z M 235 50 L 245 50 L 245 135 L 235 135 Z`;
      else if (zid.includes('cat5')) pathData = `M 70 140 L 230 140 L 230 165 L 70 165 Z`;
      else if (zid.includes('cat6')) pathData = `M 20 20 L 45 20 L 45 40 L 20 40 Z M 255 20 L 280 20 L 280 40 L 255 40 Z`;
      
      if (!pathData) return;

      const capacity = getZoneCapacity(zone);

      const densityPercentage = (zone.peopleCount / capacity) * 100;
      let zoneColor = "#22c55e"; // Safe: <= 50%
      if (densityPercentage >= 80) {
        zoneColor = "#ef4444"; // Dangerous: >= 80%
      } else if (densityPercentage > 50) {
        zoneColor = "#eab308"; // Busy: 50% < density < 80%
      }

      svg.append("path")
        .attr("d", pathData)
        .attr("fill", zoneColor)
        .attr("opacity", 0.75) 
        .attr("stroke", zone.id === userZoneId ? "#3b82f6" : "rgba(255,255,255,0.1)")
        .attr("stroke-width", zone.id === userZoneId ? 2 : 0.5)
        .attr("cursor", "pointer")
        .on("click", () => onZoneClick?.(zone));
    });

    // 2. Attendee Dots (Removed)

    // 3. Draw Zone Labels (on top of heatmap)
    zones.forEach((zone) => {
      let labelPos: {x: number, y: number}[] = [];
      const zid = zone.id.toLowerCase();
      if (zone.points && zone.points.length > 0) {
        labelPos = [{
          x: zone.points.reduce((acc, p) => acc + p.x, 0) / zone.points.length,
          y: zone.points.reduce((acc, p) => acc + p.y, 0) / zone.points.length
        }];
      } else if (zid.includes('standing')) labelPos = [{x: 150, y: 80}];
      else if (zid.includes('cat1')) labelPos = [{x: 90, y: 80}, {x: 210, y: 80}];
      else if (zid.includes('cat2')) labelPos = [{x: 150, y: 125}];
      else if (zid.includes('cat3')) labelPos = [{x: 75, y: 92}, {x: 225, y: 92}];
      else if (zid.includes('cat4')) labelPos = [{x: 60, y: 92}, {x: 240, y: 92}];
      else if (zid.includes('cat5')) labelPos = [{x: 150, y: 152.5}];
      else if (zid.includes('cat6')) labelPos = [{x: 32.5, y: 30}, {x: 267.5, y: 30}];

      labelPos.forEach(pos => {
        svg.append("text")
          .attr("x", pos.x)
          .attr("y", pos.y)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("fill", "white")
          .attr("opacity", 0.6)
          .attr("font-size", "5px")
          .attr("font-weight", "black")
          .attr("pointer-events", "none")
          .text(zone.name.replace("CAT ", "C").split(" ")[0]);
      });
    });

    // 4. Gates (on top of everything)
    if (gatesData) {
      const gateCoords = [
        { id: 'gate-a', x: 30, y: 100 },
        { id: 'gate-b', x: 270, y: 100 },
        { id: 'gate-c', x: 50, y: 15 },
        { id: 'gate-d', x: 250, y: 15 },
        { id: 'gate-e', x: 150, y: 185 },
        { id: 'gate-n', x: 10, y: 50 },
        { id: 'gate-s', x: 290, y: 50 }
      ];

      gatesData.forEach(gateData => {
        const coords = gateCoords.find(c => c.id === gateData.id);
        if (!coords) return;
        const isSelected = gateData.id === userGateId;
        const color = gateData.currentLoad > 250 ? "#ef4444" : "#22c55e";
        const group = svg.append("g")
          .attr("cursor", "pointer")
          .on("click", () => onGateClick?.(gateData));
        group.append("circle")
          .attr("cx", coords.x)
          .attr("cy", coords.y)
          .attr("r", isSelected ? 6 : 4)
          .attr("fill", color)
          .attr("stroke", "white")
          .attr("stroke-width", 1);
      });
    }

    // Render Route
    if (route && route.points.length > 1) {
      const lineGenerator = d3.line<{x: number, y: number}>()
        .x(d => d.x)
        .y(d => d.y)
        .curve(d3.curveBasis);

      // Shadow/Glow Path
      svg.append("path")
        .datum(route.points)
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", route.color || "#3b82f6")
        .attr("stroke-width", 6)
        .attr("stroke-linecap", "round")
        .attr("opacity", 0.2)
        .attr("filter", "url(#glow)");

      const path = svg.append("path")
        .datum(route.points)
        .attr("d", lineGenerator)
        .attr("fill", "none")
        .attr("stroke", route.color || "#3b82f6")
        .attr("stroke-width", 3)
        .attr("stroke-linecap", "round")
        .attr("stroke-linejoin", "round");

      // Animated "moving" dots for direction
      const totalLength = (path.node() as SVGPathElement).getTotalLength();
      
      path
        .attr("stroke-dasharray", "1, 10")
        .append("animate")
        .attr("attributeName", "stroke-dashoffset")
        .attr("from", totalLength)
        .attr("to", 0)
        .attr("dur", "5s")
        .attr("repeatCount", "indefinite");

      // User Marker (Pulsing blue dot)
      const userMarker = svg.append("g")
        .attr("transform", `translate(${route.points[0].x}, ${route.points[0].y})`);

      userMarker.append("circle")
        .attr("r", 8)
        .attr("fill", "#3b82f6")
        .attr("opacity", 0.4)
        .append("animate")
        .attr("attributeName", "r")
        .attr("values", "4;10;4")
        .attr("dur", "2s")
        .attr("repeatCount", "indefinite");

      userMarker.append("circle")
        .attr("r", 4)
        .attr("fill", "#3b82f6")
        .attr("stroke", "white")
        .attr("stroke-width", 1.5);

      // End Marker (Destination)
      const endPoint = route.points[route.points.length - 1];
      const destinationGroup = svg.append("g");
      
      destinationGroup.append("circle")
        .attr("cx", endPoint.x)
        .attr("cy", endPoint.y)
        .attr("r", 6)
        .attr("fill", "#ef4444")
        .attr("stroke", "white")
        .attr("stroke-width", 2);
        
      destinationGroup.append("text")
        .attr("x", endPoint.x)
        .attr("y", endPoint.y - 12)
        .attr("text-anchor", "middle")
        .attr("fill", "#ef4444")
        .attr("font-size", "9px")
        .attr("font-weight", "900")
        .attr("paint-order", "stroke")
        .attr("stroke", "black")
        .attr("stroke-width", 2)
        .text(route.label || t('exit').toUpperCase());
    }

  }, [zones, attendeeLocations, userZoneId, userGateId, gatesData, theme, onZoneClick, onGateClick, route]);

  return (
    <svg 
      ref={svgRef} 
      viewBox="0 0 300 200" 
      className="w-full h-full drop-shadow-2xl"
      preserveAspectRatio="xMidYMid meet"
    />
  );
};
