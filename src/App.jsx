import { useState, useRef, useCallback, useEffect } from "react";

const ROLES = ["Bisabuelo/a","Abuelo/a","Padre/Madre","Tío/Tía","Yo","Hermano/a","Pareja","Hijo/a","Nieto/a","Primo/a","Otro"];
const COLORS = {
  "Bisabuelo/a":["#FAC775","#633806"],"Abuelo/a":["#9FE1CB","#085041"],
  "Padre/Madre":["#7BB3D4","#0C447C"],"Tío/Tía":["#F5C4B3","#712B13"],
  "Yo":["#AFA9EC","#3C3489"],"Hermano/a":["#B5D4F4","#0C447C"],
  "Pareja":["#F4C0D1","#72243E"],"Hijo/a":["#C0DD97","#27500A"],
  "Nieto/a":["#9FE1CB","#085041"],"Primo/a":["#FAC775","#633806"],"Otro":["#D3D1C7","#444441"]
};
const CONN = {
  "padre-hijo":{stroke:"#8B6F47",dash:"",label:"hijo/a de",curve:true},
  "pareja":{stroke:"#D4537E",dash:"6,3",label:"pareja de",curve:false},
  "hermano":{stroke:"#378ADD",dash:"2,4",label:"hno/a de",curve:false},
  "abuelo-nieto":{stroke:"#1D9E75",dash:"8,3",label:"nieto/a de",curve:true}
};

let uid = 1;

function load() {
  try {
    const raw = localStorage.getItem("arbol-gen");
    if (!raw) return { members: [], connections: [] };
    const d = JSON.parse(raw);
    uid = d.uid || 1;
    return { members: d.members || [], connections: d.connections || [] };
  } catch { return { members: [], connections: [] }; }
}

function save(members, connections) {
  try { localStorage.setItem("arbol-gen", JSON.stringify({ members, connections, uid })); } catch {}
}

export default function App() {
  const init = load();
  const [members, setMembers] = useState(init.members);
  const [connections, setConnections] = useState(init.connections);
  const [showModal, setShowModal] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFirst, setConnectFirst] = useState(null);
  const [connType, setConnType] = useState("padre-hijo");
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [form, setForm] = useState({ name: "", role: "Padre/Madre", photo: null, year: "" });
  const canvasRef = useRef(null);
  const updatePhotoId = useRef(null);
  const updatePhotoRef = useRef(null);

  useEffect(() => { save(members, connections); }, [members, connections]);

  const handlePhotoFile = (file, cb) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = e => cb(e.target.result);
    r.readAsDataURL(file);
  };

  const addMember = () => {
    if (!form.name.trim()) return;
    const cvs = canvasRef.current;
    const m = {
      id: uid++, name: form.name.trim(), role: form.role,
      photo: form.photo, year: form.year,
      x: (cvs.clientWidth / 2 - pan.x) / zoom - 77 + (Math.random() - 0.5) * 100,
      y: (cvs.clientHeight / 2 - pan.y) / zoom - 90 + (Math.random() - 0.5) * 60,
    };
    setMembers(prev => [...prev, m]);
    setForm({ name: "", role: "Padre/Madre", photo: null, year: "" });
    setShowModal(false);
  };

  const removeMember = id => {
    setMembers(prev => prev.filter(x => x.id !== id));
    setConnections(prev => prev.filter(x => x.from !== id && x.to !== id));
    setSelected(null);
  };

  const onCardDown = useCallback((e, id) => {
    e.stopPropagation();
    if (connectMode) {
      if (!connectFirst) { setConnectFirst(id); return; }
      if (connectFirst !== id) {
        setConnections(prev => [...prev, { from: connectFirst, to: id, type: connType }]);
        setConnectFirst(null); setConnectMode(false);
      }
      return;
    }
    const m = members.find(x => x.id === id);
    setDragging(id);
    setDragOff({ x: e.clientX / zoom - m.x, y: e.clientY / zoom - m.y });
    setSelected(id);
  }, [connectMode, connectFirst, members, zoom, connType]);

  const onMouseMove = useCallback(e => {
    if (dragging !== null) {
      setMembers(prev => prev.map(m => m.id === dragging ? { ...m, x: e.clientX / zoom - dragOff.x, y: e.clientY / zoom - dragOff.y } : m));
    } else if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [dragging, dragOff, zoom, isPanning, panStart]);

  const onMouseUp = useCallback(() => { setDragging(null); setIsPanning(false); }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  const onCanvasDown = e => {
    if (e.target === canvasRef.current || e.target.tagName === "svg" || e.target.tagName === "SVG") {
      setSelected(null);
      if (!connectMode) { setIsPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); }
    }
  };

  const onWheel = e => { e.preventDefault(); setZoom(z => Math.min(3, Math.max(0.2, z - e.deltaY * 0.001))); };

  const doExport = () => {
    const blob = new Blob([JSON.stringify({ members, connections, uid }, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "arbol-genealogico.json"; a.click();
  };

  const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  return (
    <div style={{ width:"100vw", height:"100vh", background:"radial-gradient(ellipse at 60% 20%,#EDE4D0,#F5F0E8 60%,#E8E0D0)", display:"flex", flexDirection:"column", userSelect:"none", overflow:"hidden", fontFamily:"'Jost',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@300;400;500&display=swap" rel="stylesheet"/>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 22px", background:"rgba(245,240,232,0.92)", backdropFilter:"blur(8px)", borderBottom:"1px solid rgba(139,111,71,0.15)", flexShrink:0, gap:10, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:300, color:"#3D2B1F", letterSpacing:1 }}>
            Árbol <em style={{ fontStyle:"italic", color:"#8B6F47" }}>Genealógico</em>
          </div>
          <div style={{ fontSize:11, color:"rgba(93,58,26,0.45)", marginTop:2 }}>
            {members.length} {members.length === 1 ? "persona" : "personas"} · {connections.length} {connections.length === 1 ? "vínculo" : "vínculos"}
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          {connectMode ? (
            <>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {[["padre-hijo","↓ Hijo"],["pareja","♥ Pareja"],["hermano","≡ Hno"],["abuelo-nieto","↓↓ Nieto"]].map(([t,l]) => (
                  <button key={t} onClick={() => setConnType(t)} style={{ padding:"4px 10px", border:"1.5px solid", borderColor: connType===t?"#8B6F47":"rgba(139,111,71,0.25)", borderRadius:2, background: connType===t?"#8B6F47":"transparent", color: connType===t?"#FFF8F0":"#8B6F47", fontSize:10, letterSpacing:"0.8px", textTransform:"uppercase", cursor:"pointer", fontFamily:"'Jost',sans-serif" }}>{l}</button>
                ))}
              </div>
              <Btn onClick={() => { setConnectMode(false); setConnectFirst(null); }} color="#8B6F47">✕ Cancelar</Btn>
            </>
          ) : (
            <>
              <Btn onClick={() => { setConnectMode(true); setConnectFirst(null); }}>↔ Conectar</Btn>
              <Btn onClick={doExport} style={{ borderColor:"rgba(91,123,111,0.4)", color:"#3D6B5A" }}>↓ Guardar</Btn>
              <Btn onClick={() => setShowModal(true)} primary>+ Agregar persona</Btn>
            </>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div ref={canvasRef} style={{ flex:1, position:"relative", overflow:"hidden", cursor: isPanning?"grabbing":"grab" }}
        onMouseDown={onCanvasDown} onWheel={onWheel}>
        <div style={{ position:"absolute", top:0, left:0, transformOrigin:"0 0", transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
          {/* Lines */}
          <svg style={{ position:"absolute", top:0, left:0, width:8000, height:8000, pointerEvents:"none" }}>
            <defs>
              <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3z" fill="rgba(93,58,26,0.35)"/>
              </marker>
            </defs>
            {connections.map((conn, i) => {
              const fm = members.find(x => x.id === conn.from);
              const tm = members.find(x => x.id === conn.to);
              if (!fm || !tm) return null;
              const x1=fm.x+77, y1=fm.y+90, x2=tm.x+77, y2=tm.y+90;
              const mx=(x1+x2)/2, my=(y1+y2)/2;
              const s = CONN[conn.type] || CONN["padre-hijo"];
              const d = s.curve
                ? `M${x1} ${y1} C${x1} ${y1+(y2-y1)*0.45},${x2} ${y2-(y2-y1)*0.45},${x2} ${y2}`
                : `M${x1} ${y1} L${x2} ${y2}`;
              return (
                <g key={i}>
                  <path d={d} fill="none" stroke={s.stroke} strokeWidth="1.5" strokeOpacity="0.55" strokeDasharray={s.dash||undefined} markerEnd={s.curve?"url(#arr)":undefined}/>
                  <text x={mx} y={my-7} textAnchor="middle" fontSize="9" fill="rgba(93,58,26,0.4)" fontFamily="Jost,sans-serif">{s.label}</text>
                  <circle cx={mx} cy={my+5} r="7" fill="rgba(245,240,232,0.93)" stroke="rgba(139,111,71,0.25)" strokeWidth="1"
                    style={{ cursor:"pointer", pointerEvents:"all" }}
                    onClick={e => { e.stopPropagation(); setConnections(prev => prev.filter((_,j) => j!==i)); }}/>
                  <text x={mx} y={my+9} textAnchor="middle" fontSize="9" fill="rgba(139,111,71,0.6)" style={{ pointerEvents:"none" }}>✕</text>
                </g>
              );
            })}
          </svg>

          {/* Cards */}
          {members.map(m => {
            const col = COLORS[m.role] || COLORS["Otro"];
            return (
              <div key={m.id}
                onMouseDown={e => onCardDown(e, m.id)}
                style={{ position:"absolute", left:m.x, top:m.y, width:155, background:"rgba(255,252,245,0.94)", border:`1.5px solid ${selected===m.id?"#8B6F47":connectFirst===m.id?"#5B7B6F":"rgba(139,111,71,0.2)"}`, borderRadius:3, boxShadow:"0 3px 18px rgba(93,58,26,0.08)", cursor:"pointer", overflow:"hidden" }}>
                {m.photo
                  ? <img src={m.photo} style={{ width:"100%", height:105, objectFit:"cover", display:"block", pointerEvents:"none" }} draggable={false}/>
                  : <div style={{ width:"100%", height:105, background:"linear-gradient(135deg,#E8DFD0,#D5C9B8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:34, color:"rgba(139,111,71,0.3)" }}>👤</div>
                }
                <div style={{ padding:"9px 11px 10px" }}>
                  <div style={{ display:"inline-block", padding:"2px 6px", borderRadius:2, fontSize:8, fontWeight:500, letterSpacing:1, textTransform:"uppercase", color:col[1], background:col[0], marginBottom:5 }}>{m.role}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:16, fontWeight:400, color:"#2D1B0E", lineHeight:1.2 }}>{m.name}</div>
                  {m.year && <div style={{ fontSize:10, color:"rgba(93,58,26,0.4)", marginTop:2 }}>✦ {m.year}</div>}
                </div>
                {selected === m.id && !connectMode && (
                  <div style={{ display:"flex", gap:3, padding:"6px 7px", borderTop:"1px solid rgba(139,111,71,0.12)", background:"rgba(245,240,232,0.5)" }}>
                    <button onClick={e => { e.stopPropagation(); updatePhotoId.current = m.id; updatePhotoRef.current.click(); }}
                      style={{ flex:1, padding:4, background:"transparent", border:"1px solid rgba(139,111,71,0.2)", borderRadius:2, fontSize:9, color:"#8B6F47", cursor:"pointer", fontFamily:"'Jost',sans-serif", textTransform:"uppercase" }}>📷 Foto</button>
                    <button onClick={e => { e.stopPropagation(); removeMember(m.id); }}
                      style={{ flex:1, padding:4, background:"transparent", border:"1px solid rgba(139,111,71,0.2)", borderRadius:2, fontSize:9, color:"#8B6F47", cursor:"pointer", fontFamily:"'Jost',sans-serif", textTransform:"uppercase" }}>✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {members.length === 0 && (
          <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, pointerEvents:"none" }}>
            <div style={{ fontSize:52, opacity:0.14 }}>🌳</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:300, color:"rgba(93,58,26,0.3)", letterSpacing:1 }}>Tu árbol genealógico</div>
            <div style={{ fontSize:12, color:"rgba(93,58,26,0.2)", letterSpacing:"0.5px" }}>Presiona "+ Agregar persona" para comenzar</div>
          </div>
        )}

        {connectMode && (
          <div style={{ position:"absolute", bottom:20, left:"50%", transform:"translateX(-50%)", background:"#5D3A1A", color:"#FFF8F0", padding:"9px 20px", borderRadius:2, fontSize:11, letterSpacing:"0.8px", whiteSpace:"nowrap", boxShadow:"0 4px 20px rgba(45,27,14,0.25)" }}>
            {connectFirst ? "✓ Ahora haz clic en el segundo miembro" : "Haz clic en el primer miembro"}
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div style={{ position:"fixed", bottom:20, right:20, display:"flex", flexDirection:"column", gap:4, zIndex:100 }}>
        {[["+", () => setZoom(z => Math.min(3, z+0.15))], ["⊙", () => { setZoom(1); setPan({x:0,y:0}); }], ["−", () => setZoom(z => Math.max(0.2, z-0.15))]].map(([l, fn]) => (
          <div key={l} onClick={fn} style={{ width:34, height:34, background:"rgba(255,252,245,0.93)", border:"1.5px solid rgba(139,111,71,0.3)", borderRadius:2, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16, color:"#8B6F47" }}>{l}</div>
        ))}
      </div>

      {/* Hidden file input for photo update */}
      <input type="file" accept="image/*" ref={updatePhotoRef} style={{ display:"none" }}
        onChange={e => { handlePhotoFile(e.target.files[0], photo => { setMembers(prev => prev.map(m => m.id === updatePhotoId.current ? {...m, photo} : m)); }); e.target.value=""; }}/>

      {/* Add Modal */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position:"fixed", inset:0, background:"rgba(45,27,14,0.38)", backdropFilter:"blur(5px)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#FFF8F0", border:"1.5px solid rgba(139,111,71,0.25)", borderRadius:4, padding:28, width:360, boxShadow:"0 20px 60px rgba(45,27,14,0.2)", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22, fontWeight:300, color:"#2D1B0E", marginBottom:20, letterSpacing:"0.5px" }}>Agregar persona</div>
            {[
              { label:"Nombre completo", el: <input autoFocus placeholder="Ej: María Elena Torres" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addMember()} style={inputStyle}/> },
              { label:"Relación", el: <select value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))} style={inputStyle}>{ROLES.map(r=><option key={r}>{r}</option>)}</select> },
              { label:"Año de nacimiento", el: <input placeholder="Ej: 1945" value={form.year} onChange={e => setForm(f=>({...f,year:e.target.value}))} style={inputStyle}/> },
            ].map(({ label, el }) => (
              <div key={label} style={{ marginBottom:14 }}>
                <label style={{ display:"block", fontSize:9, letterSpacing:"1.5px", textTransform:"uppercase", color:"#8B6F47", fontWeight:500, marginBottom:5 }}>{label}</label>
                {el}
              </div>
            ))}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"block", fontSize:9, letterSpacing:"1.5px", textTransform:"uppercase", color:"#8B6F47", fontWeight:500, marginBottom:5 }}>Foto (opcional)</label>
              <div onClick={() => document.getElementById("modal-photo-input").click()}
                style={{ width:"100%", height:80, border:"1.5px dashed rgba(139,111,71,0.35)", borderRadius:2, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:12, color:"rgba(139,111,71,0.55)", overflow:"hidden", position:"relative" }}>
                {form.photo ? <img src={form.photo} style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}/> : "📷 Subir foto"}
              </div>
              <input id="modal-photo-input" type="file" accept="image/*" style={{ display:"none" }}
                onChange={e => { handlePhotoFile(e.target.files[0], photo => setForm(f=>({...f,photo}))); e.target.value=""; }}/>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:20 }}>
              <Btn onClick={() => setShowModal(false)} style={{ flex:1, padding:11 }}>Cancelar</Btn>
              <Btn onClick={addMember} primary style={{ flex:1, padding:11 }}>Agregar ✦</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = { width:"100%", padding:"9px 11px", border:"1.5px solid rgba(139,111,71,0.25)", borderRadius:2, background:"rgba(245,240,232,0.5)", fontFamily:"'Jost',sans-serif", fontSize:13, color:"#2D1B0E", outline:"none" };

function Btn({ children, onClick, primary, color, style={} }) {
  return (
    <button onClick={onClick} style={{ padding:"7px 16px", border:"1.5px solid", borderColor: color||( primary?"#5D3A1A":"rgba(139,111,71,0.35)"), borderRadius:2, background: color||( primary?"#5D3A1A":"transparent"), color: primary?"#FFF8F0":"#5D3A1A", fontFamily:"'Jost',sans-serif", fontSize:11, fontWeight:500, letterSpacing:1, textTransform:"uppercase", cursor:"pointer", ...style }}>
      {children}
    </button>
  );
}
