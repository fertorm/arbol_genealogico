import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import * as d3 from "d3";

export default function NexusView({ currentTreeId, onNavigate, onClose }) {
  const svgRef      = useRef(null);
  const wrapRef     = useRef(null);
  const simRef      = useRef(null);
  const [loading, setLoading]   = useState(true);
  const [nodeCount, setNodeCount] = useState(0);
  const [hovered, setHovered]   = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Cargar todos los árboles
      const { data: trees } = await supabase.from("trees").select("id, name, created_at");
      // Cargar portales (miembros con linked_tree_id)
      const { data: portals } = await supabase
        .from("members")
        .select("tree_id, linked_tree_id, name, linked_tree_name")
        .not("linked_tree_id", "is", null);

      if (cancelled || !trees) return;

      const treeIds = new Set(trees.map(t => t.id));

      const nodes = trees.map(t => ({
        id:        t.id,
        name:      t.name || "Mi Familia",
        isCurrent: t.id === currentTreeId,
      }));

      const links = (portals || [])
        .filter(p => treeIds.has(p.tree_id) && treeIds.has(p.linked_tree_id))
        .map(p => ({
          source: p.tree_id,
          target: p.linked_tree_id,
          label:  p.linked_tree_name || p.name || "",
        }));

      setNodeCount(nodes.length);
      if (!cancelled) buildGraph(nodes, links);
    }

    load();
    return () => { cancelled = true; if (simRef.current) simRef.current.stop(); };
  }, [currentTreeId]);

  function buildGraph(nodes, links) {
    const container = wrapRef.current;
    if (!container || !svgRef.current) return;

    const W = container.clientWidth;
    const H = container.clientHeight;

    const svg = d3.select(svgRef.current)
      .attr("width", W).attr("height", H);

    svg.selectAll("*").remove();

    // Fondo estrellado sutil
    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id", "glow");
    glow.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "coloredBlur");
    const feMerge = glow.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const glowCurrent = defs.append("filter").attr("id", "glowCurrent");
    glowCurrent.append("feGaussianBlur").attr("stdDeviation", "8").attr("result", "coloredBlur");
    const fmCurrent = glowCurrent.append("feMerge");
    fmCurrent.append("feMergeNode").attr("in", "coloredBlur");
    fmCurrent.append("feMergeNode").attr("in", "SourceGraphic");

    // Grupo principal (zoom/pan)
    const g = svg.append("g").attr("class", "nexus-g");

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.15, 4])
      .on("zoom", e => g.attr("transform", e.transform));
    svg.call(zoom).on("dblclick.zoom", null);

    // Copiar nodos para no mutar el estado
    const nodeData = nodes.map(n => ({ ...n }));
    const linkData = links.map(l => ({ ...l }));

    // Simulación de fuerzas
    const sim = d3.forceSimulation(nodeData)
      .force("link",      d3.forceLink(linkData).id(d => d.id).distance(200).strength(0.5))
      .force("charge",    d3.forceManyBody().strength(-500))
      .force("center",    d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide(70))
      .alphaDecay(0.03);
    simRef.current = sim;

    // ── Links ──
    const linkGroup = g.append("g").attr("class", "links");
    const linkEl = linkGroup.selectAll("line")
      .data(linkData).join("line")
      .attr("stroke", "#D4A017")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.4)
      .attr("stroke-dasharray", "6 4");

    // Etiquetas de links
    const linkLabelEl = linkGroup.selectAll("text")
      .data(linkData).join("text")
      .text(d => d.label)
      .attr("font-size", 9)
      .attr("font-family", "Jost, sans-serif")
      .attr("fill", "rgba(212,160,23,0.55)")
      .attr("text-anchor", "middle")
      .attr("pointer-events", "none");

    // ── Nodos ──
    const nodeGroup = g.append("g").attr("class", "nodes");
    const nodeEl = nodeGroup.selectAll("g")
      .data(nodeData).join("g")
      .style("cursor", "pointer")
      .call(
        d3.drag()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag",  (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end",   (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            d.fx = null; d.fy = null;
          })
      )
      .on("click",     (event, d) => { event.stopPropagation(); onNavigate(d.id); })
      .on("mouseover", (_, d)     => setHovered(d.id))
      .on("mouseout",  ()         => setHovered(null));

    // Halo exterior
    nodeEl.append("circle")
      .attr("r",            d => d.isCurrent ? 52 : 42)
      .attr("fill",         "none")
      .attr("stroke",       d => d.isCurrent ? "rgba(139,111,71,0.5)" : "rgba(212,160,23,0.15)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 4");

    // Círculo principal
    nodeEl.append("circle")
      .attr("r",      d => d.isCurrent ? 44 : 36)
      .attr("fill",   d => d.isCurrent ? "#5D3A1A" : "rgba(30,18,8,0.85)")
      .attr("stroke", d => d.isCurrent ? "#D4A017" : "rgba(139,111,71,0.45)")
      .attr("stroke-width", d => d.isCurrent ? 2.5 : 1.5)
      .attr("filter", d => d.isCurrent ? "url(#glowCurrent)" : "url(#glow)");

    // Emoji árbol
    nodeEl.append("text")
      .attr("text-anchor",       "middle")
      .attr("dominant-baseline", "middle")
      .attr("y",        d => d.isCurrent ? -12 : -10)
      .attr("font-size", d => d.isCurrent ?  22 :  18)
      .text("🌳");

    // Nombre del árbol
    nodeEl.append("text")
      .attr("text-anchor",       "middle")
      .attr("dominant-baseline", "middle")
      .attr("y",           d => d.isCurrent ? 10 : 8)
      .attr("font-size",   d => d.isCurrent ? 11 : 9)
      .attr("font-family", "Cormorant Garamond, serif")
      .attr("font-weight", "400")
      .attr("fill",        d => d.isCurrent ? "#FFF8F0" : "rgba(245,230,200,0.75)")
      .text(d => d.name.length > 14 ? d.name.slice(0, 13) + "…" : d.name);

    // Badge "tú" en el nodo actual
    nodeEl.filter(d => d.isCurrent)
      .append("text")
      .attr("text-anchor",       "middle")
      .attr("dominant-baseline", "middle")
      .attr("y", 26)
      .attr("font-size", 8)
      .attr("font-family", "Jost, sans-serif")
      .attr("letter-spacing", "1px")
      .attr("fill", "rgba(212,160,23,0.7)")
      .text("● TÚ ESTÁS AQUÍ");

    // Tick de simulación
    sim.on("tick", () => {
      linkEl
        .attr("x1", d => d.source.x).attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x).attr("y2", d => d.target.y);

      linkLabelEl
        .attr("x", d => (d.source.x + d.target.x) / 2)
        .attr("y", d => (d.source.y + d.target.y) / 2 - 8);

      nodeEl.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    setLoading(false);
  }

  return (
    <div style={{ position:"fixed",inset:0,background:"radial-gradient(ellipse at 40% 40%, #1C0E04 0%, #0A0502 100%)",zIndex:500,display:"flex",flexDirection:"column",fontFamily:"'Jost',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@300;400;500&display=swap" rel="stylesheet"/>

      {/* Header */}
      <div style={{ padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(139,111,71,0.2)",background:"rgba(10,5,2,0.7)",backdropFilter:"blur(10px)",flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,color:"rgba(255,240,210,0.9)",letterSpacing:1 }}>
            Nexus <em style={{ fontStyle:"italic",color:"#D4A017" }}>Familiar</em>
          </div>
          <div style={{ fontSize:10,color:"rgba(212,160,23,0.45)",marginTop:2,letterSpacing:"0.5px" }}>
            {loading ? "Mapeando linajes..." : `${nodeCount} árbol${nodeCount!==1?"es":""} en el universo familiar`}
          </div>
        </div>
        <button onClick={onClose}
          style={{ padding:"7px 16px",background:"transparent",border:"1.5px solid rgba(212,160,23,0.3)",borderRadius:2,color:"rgba(212,160,23,0.7)",fontFamily:"'Jost',sans-serif",fontSize:11,cursor:"pointer",letterSpacing:"1px",textTransform:"uppercase",transition:"all 0.2s" }}>
          ← Volver
        </button>
      </div>

      {/* Graph area */}
      <div ref={wrapRef} style={{ flex:1,position:"relative",overflow:"hidden" }}>
        {loading && (
          <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:36,marginBottom:12,opacity:0.4 }}>🌐</div>
              <div style={{ color:"rgba(212,160,23,0.5)",fontFamily:"'Cormorant Garamond',serif",fontSize:18,letterSpacing:1 }}>Mapeando linajes...</div>
            </div>
          </div>
        )}
        <svg ref={svgRef} style={{ width:"100%",height:"100%",display:"block" }}/>
      </div>

      {/* Footer legend */}
      <div style={{ padding:"8px 20px",background:"rgba(10,5,2,0.8)",borderTop:"1px solid rgba(139,111,71,0.15)",display:"flex",gap:20,alignItems:"center",flexShrink:0,flexWrap:"wrap" }}>
        <div style={{ display:"flex",gap:6,alignItems:"center" }}>
          <div style={{ width:12,height:12,borderRadius:"50%",background:"#5D3A1A",border:"2px solid #D4A017" }}/>
          <span style={{ fontSize:10,color:"rgba(212,160,23,0.4)" }}>Tu árbol</span>
        </div>
        <div style={{ display:"flex",gap:6,alignItems:"center" }}>
          <div style={{ width:12,height:12,borderRadius:"50%",background:"rgba(30,18,8,0.85)",border:"1.5px solid rgba(139,111,71,0.45)" }}/>
          <span style={{ fontSize:10,color:"rgba(212,160,23,0.4)" }}>Árbol vinculado</span>
        </div>
        <div style={{ display:"flex",gap:6,alignItems:"center" }}>
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#D4A017" strokeWidth="1.5" strokeDasharray="4 3" strokeOpacity="0.5"/></svg>
          <span style={{ fontSize:10,color:"rgba(212,160,23,0.4)" }}>Portal</span>
        </div>
        <span style={{ fontSize:9,color:"rgba(212,160,23,0.25)",marginLeft:"auto" }}>
          Arrastra nodos · Pellizca para zoom · Clic para abrir árbol
        </span>
      </div>
    </div>
  );
}
