import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "./supabase";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const MUSIC_URL = "/musica.mp3";
const PAN_STEP = 120;

function getMyId() {
  let id = localStorage.getItem("arbol-my-id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("arbol-my-id", id); }
  return id;
}
const MY_ID = getMyId();

function getRecentTrees() {
  try { return JSON.parse(localStorage.getItem("arbol-recent") || "[]"); } catch { return []; }
}
function saveRecentTree(id, name) {
  const t = getRecentTrees().filter(t => t.id !== id);
  t.unshift({ id, name, date: new Date().toLocaleDateString("es-BO") });
  localStorage.setItem("arbol-recent", JSON.stringify(t.slice(0, 10)));
}
function removeRecentTree(id) {
  localStorage.setItem("arbol-recent", JSON.stringify(getRecentTrees().filter(t => t.id !== id)));
}

const ROLES = ["Bisabuelo/a","Abuelo/a","Padre/Madre","Tío/Tía","Yo","Hermano/a","Pareja","Hijo/a","Nieto/a","Primo/a","Otro"];
const GENERATION_ROLES = {
  "Bisabuelos": ["Bisabuelo/a"],
  "Abuelos":    ["Abuelo/a"],
  "Padres":     ["Padre/Madre","Tío/Tía"],
  "Mi gen.":    ["Yo","Hermano/a","Pareja","Primo/a"],
  "Hijos":      ["Hijo/a"],
  "Nietos":     ["Nieto/a"],
  "Otros":      ["Otro"],
};
const COLORS = {
  "Bisabuelo/a":["#FAC775","#633806"],"Abuelo/a":["#9FE1CB","#085041"],
  "Padre/Madre":["#7BB3D4","#0C447C"],"Tío/Tía":["#F5C4B3","#712B13"],
  "Yo":["#AFA9EC","#3C3489"],"Hermano/a":["#B5D4F4","#0C447C"],
  "Pareja":["#F4C0D1","#72243E"],"Hijo/a":["#C0DD97","#27500A"],
  "Nieto/a":["#9FE1CB","#085041"],"Primo/a":["#FAC775","#633806"],"Otro":["#D3D1C7","#444441"]
};
const CONN = {
  "padre-hijo":      { stroke:"#8B6F47", dash:"",     label:"hijo/a de",     curve:true  },
  "pareja":          { stroke:"#D4537E", dash:"6,3",  label:"pareja de",     curve:false },
  "hermano":         { stroke:"#378ADD", dash:"2,4",  label:"hno/a de",      curve:false },
  "abuelo-nieto":    { stroke:"#1D9E75", dash:"8,3",  label:"nieto/a de",    curve:true  },
  "bisabuelo-nieto": { stroke:"#9B59B6", dash:"10,4", label:"bisnieto/a de", curve:true  },
  "tio-sobrino":     { stroke:"#E67E22", dash:"4,3",  label:"sobrino/a de",  curve:false },
};
const CONN_BTNS = [
  ["padre-hijo","↓ Hijo"],["pareja","♥ Pareja"],["hermano","≡ Hno"],
  ["abuelo-nieto","↓↓ Nieto"],["bisabuelo-nieto","↓↓↓ Bisnieto"],["tio-sobrino","↗ Sobrino"],
];

function getTreeIdFromUrl() { return new URLSearchParams(window.location.search).get("tree"); }
function setTreeIdInUrl(id) {
  const url = new URL(window.location); url.searchParams.set("tree", id);
  window.history.pushState({}, "", url);
}
function clearTreeFromUrl() {
  const url = new URL(window.location); url.searchParams.delete("tree");
  window.history.pushState({}, "", url);
}
function extractUUID(str) {
  const m = str.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

// ── HomeScreen ────────────────────────────────────────────────────────────────
function HomeScreen({ onOpen, onCreate }) {
  const [recent, setRecent] = useState(getRecentTrees());
  const [joinId, setJoinId] = useState("");
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState("");

  const handleJoin = async () => {
    const raw = joinId.trim(); if (!raw) return;
    const id = extractUUID(raw) || raw;
    setJoining(true); setErr("");
    const { data } = await supabase.from("trees").select("id,name").eq("id", id).single();
    setJoining(false);
    if (data) onOpen(data.id, data.name);
    else setErr("No se encontró ese árbol. Verifica el link.");
  };

  return (
    <div style={{ width:"100vw",minHeight:"100vh",background:"radial-gradient(ellipse at 60% 20%,#EDE4D0,#F5F0E8 60%,#E8E0D0)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Jost',sans-serif",padding:"24px 16px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@300;400;500&display=swap" rel="stylesheet"/>
      <div style={{ width:"100%",maxWidth:480 }}>
        <div style={{ textAlign:"center",marginBottom:36 }}>
          <div style={{ fontSize:48,marginBottom:10 }}>🌳</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:300,color:"#3D2B1F",letterSpacing:1 }}>Árbol <em style={{ fontStyle:"italic",color:"#8B6F47" }}>Genealógico</em></div>
          <div style={{ fontSize:12,color:"rgba(93,58,26,0.45)",marginTop:6 }}>Conecta tu historia familiar</div>
        </div>
        <button onClick={onCreate} style={{ width:"100%",padding:"16px",background:"#5D3A1A",color:"#FFF8F0",border:"none",borderRadius:3,fontFamily:"'Jost',sans-serif",fontSize:13,fontWeight:500,letterSpacing:"1.5px",textTransform:"uppercase",cursor:"pointer",marginBottom:14 }}>
          + Crear nuevo árbol
        </button>
        <div style={{ background:"rgba(255,252,245,0.7)",border:"1.5px solid rgba(139,111,71,0.2)",borderRadius:3,padding:"16px",marginBottom:recent.length>0?14:0 }}>
          <div style={{ fontSize:10,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6F47",fontWeight:500,marginBottom:10 }}>Continuar árbol existente</div>
          <div style={{ display:"flex",gap:8 }}>
            <input value={joinId} onChange={e=>{setJoinId(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&handleJoin()}
              placeholder="Pega el link o ID del árbol"
              style={{ flex:1,padding:"9px 11px",border:"1.5px solid rgba(139,111,71,0.25)",borderRadius:2,background:"rgba(245,240,232,0.5)",fontFamily:"'Jost',sans-serif",fontSize:12,color:"#2D1B0E",outline:"none" }}/>
            <button onClick={handleJoin} disabled={joining}
              style={{ padding:"9px 14px",background:"rgba(139,111,71,0.15)",border:"1.5px solid rgba(139,111,71,0.35)",borderRadius:2,color:"#5D3A1A",fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:500,letterSpacing:"0.8px",textTransform:"uppercase",cursor:"pointer" }}>
              {joining?"...":"Abrir"}
            </button>
          </div>
          {err && <div style={{ fontSize:11,color:"#B43C3C",marginTop:8 }}>{err}</div>}
        </div>
        {recent.length > 0 && (
          <div style={{ background:"rgba(255,252,245,0.7)",border:"1.5px solid rgba(139,111,71,0.2)",borderRadius:3,overflow:"hidden" }}>
            <div style={{ padding:"12px 16px 8px",fontSize:10,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6F47",fontWeight:500 }}>Mis árboles recientes</div>
            {recent.map((t,i)=>(
              <div key={t.id} onClick={()=>onOpen(t.id,t.name)}
                style={{ display:"flex",alignItems:"center",padding:"12px 16px",borderTop:i===0?"none":"1px solid rgba(139,111,71,0.1)",cursor:"pointer" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:17,color:"#2D1B0E" }}>{t.name}</div>
                  <div style={{ fontSize:10,color:"rgba(93,58,26,0.4)",marginTop:2 }}>Último acceso: {t.date}</div>
                </div>
                <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                  <span style={{ fontSize:11,color:"rgba(93,58,26,0.35)" }}>Abrir →</span>
                  <button onClick={e=>{e.stopPropagation();removeRecentTree(t.id);setRecent(getRecentTrees());}}
                    style={{ padding:"3px 7px",background:"transparent",border:"1px solid rgba(180,60,60,0.25)",borderRadius:2,fontSize:9,color:"rgba(180,60,60,0.6)",cursor:"pointer",fontFamily:"'Jost',sans-serif" }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign:"center",marginTop:20,fontSize:10,color:"rgba(93,58,26,0.3)" }}>Todo se guarda automáticamente en la nube ☁️</div>
      </div>
    </div>
  );
}

// ── EditModal ─────────────────────────────────────────────────────────────────
function EditModal({ member, onSave, onClose, handlePhotoFile }) {
  const [form, setForm] = useState({ name:member.name||"", role:member.role||"Otro", year:member.year||"", photo:member.photo||null });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true); await onSave(member.id, form); setSaving(false); onClose();
  };
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(45,27,14,0.38)",backdropFilter:"blur(5px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px" }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#FFF8F0",border:"1.5px solid rgba(139,111,71,0.25)",borderRadius:4,padding:24,width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(45,27,14,0.2)",maxHeight:"90vh",overflowY:"auto" }}>
        <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:20 }}>
          <div onClick={()=>document.getElementById("edit-photo-inp").click()}
            style={{ width:64,height:64,borderRadius:3,overflow:"hidden",background:"#EDE4D0",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",border:"1.5px dashed rgba(139,111,71,0.3)",position:"relative" }}>
            {form.photo?<img src={form.photo} style={{ width:"100%",height:"100%",objectFit:"contain" }}/>:<span style={{ fontSize:24 }}>👤</span>}
            <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"rgba(93,58,26,0.5)",fontSize:8,color:"#FFF",textAlign:"center",padding:"2px 0",fontFamily:"'Jost',sans-serif" }}>📷</div>
          </div>
          <div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:300,color:"#2D1B0E" }}>Editar persona</div>
            <div style={{ fontSize:11,color:"rgba(93,58,26,0.4)",marginTop:2 }}>Toca la foto para cambiarla</div>
          </div>
        </div>
        <input id="edit-photo-inp" type="file" accept="image/*" style={{ display:"none" }}
          onChange={e=>{ handlePhotoFile(e.target.files[0],photo=>setForm(f=>({...f,photo}))); e.target.value=""; }}/>
        {[{label:"Nombre completo",el:<input autoFocus value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleSave()} placeholder="Nombre completo" style={iStyle}/>},
          {label:"Relación",el:<select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={iStyle}>{ROLES.map(r=><option key={r}>{r}</option>)}</select>},
          {label:"Año de nacimiento",el:<input value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))} placeholder="Ej: 1945" style={iStyle}/>},
        ].map(({label,el})=>(
          <div key={label} style={{ marginBottom:12 }}>
            <label style={{ display:"block",fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6F47",fontWeight:500,marginBottom:5 }}>{label}</label>
            {el}
          </div>
        ))}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block",fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6F47",fontWeight:500,marginBottom:5 }}>Foto</label>
          <div onClick={()=>document.getElementById("edit-photo-inp").click()}
            style={{ width:"100%",height:100,border:"1.5px dashed rgba(139,111,71,0.35)",borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",position:"relative",background:"rgba(245,240,232,0.5)" }}>
            {form.photo?<img src={form.photo} style={{ maxWidth:"100%",maxHeight:"100px",objectFit:"contain" }}/>:<span style={{ fontSize:12,color:"rgba(139,111,71,0.5)" }}>📷 Subir / cambiar foto</span>}
          </div>
          {form.photo&&<button onClick={()=>setForm(f=>({...f,photo:null}))}
            style={{ marginTop:6,padding:"4px 10px",background:"transparent",border:"1px solid rgba(180,60,60,0.3)",borderRadius:2,fontSize:10,color:"#B43C3C",cursor:"pointer",fontFamily:"'Jost',sans-serif" }}>✕ Quitar foto</button>}
        </div>
        <div style={{ display:"flex",gap:8,marginTop:18 }}>
          <Btn onClick={onClose} style={{ flex:1,padding:11 }}>Cancelar</Btn>
          <Btn onClick={handleSave} primary style={{ flex:1,padding:11 }}>{saving?"Guardando...":"Guardar cambios"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── D-pad navegación ──────────────────────────────────────────────────────────
function DPad({ onPan, onReset }) {
  const pressRef = useRef(null);
  const startPress = (dir) => {
    onPan(dir);
    pressRef.current = setInterval(() => onPan(dir), 120);
  };
  const stopPress = () => { clearInterval(pressRef.current); pressRef.current = null; };
  const btn = (dir, label) => (
    <div
      onMouseDown={()=>startPress(dir)} onMouseUp={stopPress} onMouseLeave={stopPress}
      onTouchStart={e=>{e.preventDefault();startPress(dir);}} onTouchEnd={e=>{e.preventDefault();stopPress();}}
      style={{ width:40,height:40,background:"rgba(255,252,245,0.93)",border:"1.5px solid rgba(139,111,71,0.3)",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#8B6F47",boxShadow:"0 2px 8px rgba(93,58,26,0.1)",userSelect:"none",touchAction:"none" }}>
      {label}
    </div>
  );
  return (
    <div style={{ display:"grid",gridTemplateColumns:"40px 40px 40px",gridTemplateRows:"40px 40px 40px",gap:3 }}>
      <div/>
      {btn("up","↑")}
      <div/>
      {btn("left","←")}
      <div onMouseDown={onReset} onTouchStart={e=>{e.preventDefault();onReset();}}
        style={{ width:40,height:40,background:"rgba(255,252,245,0.93)",border:"1.5px solid rgba(139,111,71,0.3)",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:"#8B6F47",boxShadow:"0 2px 8px rgba(93,58,26,0.1)" }}>⊙</div>
      {btn("right","→")}
      <div/>
      {btn("down","↓")}
      <div/>
    </div>
  );
}

// ── App Principal ─────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("loading");
  const [members, setMembers] = useState([]);
  const [connections, setConnections] = useState([]);
  const [treeId, setTreeId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [copied, setCopied] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFirst, setConnectFirst] = useState(null);
  const [connType, setConnType] = useState("padre-hijo");
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x:0, y:0 });
  const [genFilter, setGenFilter] = useState("Todos"); // generación activa
  const [form, setForm] = useState({ name:"", role:"Padre/Madre", photo:null, year:"", isPortal:false, linkedTreeUrl:"", linkedTreeName:"" });

  // Refs
  const treeIdRef       = useRef(null);
  const connTypeRef     = useRef("padre-hijo");
  const connectFirstRef = useRef(null);
  const connectModeRef  = useRef(false);
  const membersRef      = useRef([]);
  const zoomRef         = useRef(1);
  const panRef          = useRef({ x:0, y:0 });
  const draggingRef     = useRef(null);
  const dragOffRef      = useRef({ x:0, y:0 });
  const isPanningRef    = useRef(false);
  const panStartRef     = useRef({ x:0, y:0 });
  const lastTouchDistRef = useRef(null);
  const lastTouchMidRef  = useRef(null);
  const touchPanningRef  = useRef(false);
  const touchPanStartRef = useRef({ x:0, y:0 });
  const canvasRef       = useRef(null);
  const audioRef        = useRef(null);

  useEffect(() => { treeIdRef.current = treeId; }, [treeId]);
  useEffect(() => { connTypeRef.current = connType; }, [connType]);
  useEffect(() => { connectFirstRef.current = connectFirst; }, [connectFirst]);
  useEffect(() => { connectModeRef.current = connectMode; }, [connectMode]);
  useEffect(() => { membersRef.current = members; }, [members]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  const showToast = (msg, color="#B43C3C") => { setToast({msg,color}); setTimeout(()=>setToast(null),3000); };
  const handlePhotoFile = (file, cb) => { if(!file)return; const r=new FileReader(); r.onload=e=>cb(e.target.result); r.readAsDataURL(file); };
  const isMine = m => !m.creator_id || m.creator_id === MY_ID;

  // ── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    const id = getTreeIdFromUrl();
    if (id) openTree(id); else setScreen("home");
  }, []);

  const openTree = async (id) => {
    setScreen("loading");
    const { data: tree } = await supabase.from("trees").select("*").eq("id",id).single();
    if (!tree) { setScreen("home"); return; }
    const { data: m } = await supabase.from("members").select("*").eq("tree_id",id);
    const { data: c } = await supabase.from("connections").select("*").eq("tree_id",id);
    setTreeId(id); treeIdRef.current=id;
    setMembers(m||[]); membersRef.current=m||[];
    setConnections(c||[]);
    setTreeIdInUrl(id); saveRecentTree(id, tree.name||"Mi Familia");
    setScreen("tree");
  };

  const createTree = async () => {
    setScreen("loading");
    const { data } = await supabase.from("trees").insert({ name:"Mi Familia" }).select().single();
    if (data) await openTree(data.id); else setScreen("home");
  };

  const goHome = () => {
    setTreeId(null); setMembers([]); setConnections([]);
    setConnectMode(false); setConnectFirst(null); setSelected(null);
    clearTreeFromUrl(); setScreen("home");
  };

  // ── Realtime ──────────────────────────────────────────────────
  useEffect(() => {
    if (!treeId) return;
    const ch1 = supabase.channel("m-"+treeId)
      .on("postgres_changes",{event:"*",schema:"public",table:"members",filter:`tree_id=eq.${treeId}`},p=>{
        if(p.eventType==="INSERT"){setMembers(prev=>{const u=prev.find(x=>x.id===p.new.id)?prev:[...prev,p.new];membersRef.current=u;return u;});}
        else if(p.eventType==="UPDATE"){setMembers(prev=>{const u=prev.map(x=>x.id===p.new.id?{...x,...p.new}:x);membersRef.current=u;return u;});}
        else if(p.eventType==="DELETE"){setMembers(prev=>{const u=prev.filter(x=>x.id!==p.old.id);membersRef.current=u;return u;});}
      }).subscribe();
    const ch2 = supabase.channel("c-"+treeId)
      .on("postgres_changes",{event:"*",schema:"public",table:"connections",filter:`tree_id=eq.${treeId}`},p=>{
        if(p.eventType==="INSERT") setConnections(prev=>prev.find(x=>x.id===p.new.id)?prev:[...prev,p.new]);
        else if(p.eventType==="DELETE") setConnections(prev=>prev.filter(x=>x.id!==p.old.id));
      }).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [treeId]);

  // ── connectMembers ────────────────────────────────────────────
  const connectMembers = async (fromId, toId) => {
    const tid=treeIdRef.current, ct=connTypeRef.current;
    if(!tid||!fromId||!toId||fromId===toId) return;
    const { data: ex } = await supabase.from("connections").select("id").eq("tree_id",tid)
      .or(`and(from_id.eq.${fromId},to_id.eq.${toId}),and(from_id.eq.${toId},to_id.eq.${fromId})`);
    if(ex&&ex.length>0){ showToast("⚠️ Ya existe una conexión","#E67E22"); return; }
    const { data, error } = await supabase.from("connections").insert({ tree_id:tid, from_id:fromId, to_id:toId, type:ct }).select().single();
    if(error) showToast("❌ Error: "+error.message);
    else if(data){ setConnections(p=>[...p,data]); showToast("✓ Conexión creada","#2D7A4F"); }
  };

  // ── CRUD ──────────────────────────────────────────────────────
  const addMember = async () => {
    if(!treeId) return;
    if(form.isPortal){
      // Tarjeta portal — vincula a otro árbol
      if(!form.linkedTreeName.trim()){ showToast("Escribe un nombre para el portal"); return; }
      const linkedId = extractUUID(form.linkedTreeUrl||"");
      const cvs=canvasRef.current, z=zoomRef.current, p=panRef.current;
      const { data, error } = await supabase.from("members").insert({
        tree_id:treeId, name:form.linkedTreeName.trim(), role:"Otro",
        linked_tree_id: linkedId||null, linked_tree_name: form.linkedTreeName.trim(),
        creator_id:MY_ID,
        x:(cvs.clientWidth/2-p.x)/z-77+(Math.random()-0.5)*100,
        y:(cvs.clientHeight/2-p.y)/z-90+(Math.random()-0.5)*60,
      }).select().single();
      if(error){ showToast("❌ Error: "+error.message); return; }
      if(data){ setMembers(p=>[...p,data]); membersRef.current=[...membersRef.current,data]; }
    } else {
      if(!form.name.trim()) return;
      const cvs=canvasRef.current, z=zoomRef.current, p=panRef.current;
      const { data, error } = await supabase.from("members").insert({
        tree_id:treeId, name:form.name.trim(), role:form.role,
        photo:form.photo, year:form.year, creator_id:MY_ID,
        x:(cvs.clientWidth/2-p.x)/z-77+(Math.random()-0.5)*100,
        y:(cvs.clientHeight/2-p.y)/z-90+(Math.random()-0.5)*60,
      }).select().single();
      if(error){ showToast("❌ Error: "+error.message); return; }
      if(data){ setMembers(p=>[...p,data]); membersRef.current=[...membersRef.current,data]; }
    }
    setForm({ name:"", role:"Padre/Madre", photo:null, year:"", isPortal:false, linkedTreeUrl:"", linkedTreeName:"" });
    setShowAddModal(false);
  };

  const saveMemberEdit = async (id, fields) => {
    const { error } = await supabase.from("members").update({ name:fields.name.trim(), role:fields.role, year:fields.year, photo:fields.photo }).eq("id",id);
    if(error){ showToast("❌ Error: "+error.message); return; }
    setMembers(p=>p.map(m=>m.id===id?{...m,...fields,name:fields.name.trim()}:m));
    showToast("✓ Cambios guardados","#2D7A4F");
  };

  const removeMember = async id => {
    const m=membersRef.current.find(x=>x.id===id);
    if(!isMine(m)){ showToast("🔒 Solo puedes eliminar tus propias tarjetas"); return; }
    await supabase.from("members").delete().eq("id",id);
    setMembers(p=>p.filter(x=>x.id!==id));
    setConnections(p=>p.filter(x=>x.from_id!==id&&x.to_id!==id));
    setSelected(null);
  };

  const removeConnection = async id => {
    await supabase.from("connections").delete().eq("id",id);
    setConnections(p=>p.filter(x=>x.id!==id));
  };

  const updateMemberPos = async (id,x,y) => {
    const m=membersRef.current.find(mem=>mem.id===id);
    if(!m||!isMine(m)) return;
    setMembers(p=>p.map(mem=>mem.id===id?{...mem,x,y}:mem));
    await supabase.from("members").update({x,y}).eq("id",id);
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const canvas = await html2canvas(canvasRef.current,{backgroundColor:"#F5F0E8",scale:2,useCORS:true});
      const pdf = new jsPDF("landscape","mm","a4");
      pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,297,210);
      pdf.save("arbol-genealogico.pdf");
    } catch(e){ console.error(e); }
    setExporting(false);
  };

  // ── D-pad pan ─────────────────────────────────────────────────
  const handleDPan = (dir) => {
    const s = PAN_STEP / zoomRef.current;
    setPan(p => ({
      x: p.x + (dir==="left"?s : dir==="right"?-s : 0),
      y: p.y + (dir==="up"?s  : dir==="down"?-s  : 0),
    }));
  };

  // ── Filtro generación ─────────────────────────────────────────
  const visibleMemberIds = new Set(
    genFilter === "Todos"
      ? members.map(m => m.id)
      : members.filter(m => {
          if (m.linked_tree_id !== undefined && m.linked_tree_id !== null) return true; // portales siempre visibles
          const genRoles = GENERATION_ROLES[genFilter] || [];
          return genRoles.includes(m.role);
        }).map(m => m.id)
  );

  // ── Card interaction ──────────────────────────────────────────
  const handleCardInteraction = useCallback((id, clientX, clientY, isTouch=false) => {
    if(connectModeRef.current){
      const first=connectFirstRef.current;
      if(!first){ setConnectFirst(id); connectFirstRef.current=id; return; }
      if(first===id){ setConnectFirst(null); connectFirstRef.current=null; return; }
      connectMembers(first,id);
      setConnectFirst(null); connectFirstRef.current=null;
      setConnectMode(false); connectModeRef.current=false;
      return;
    }
    const m=membersRef.current.find(x=>x.id===id);
    setSelected(id);
    if(!m||!isMine(m)) return;
    if(m.linked_tree_id) return; // portal: no drag
    draggingRef.current=id;
    dragOffRef.current={ x:clientX/zoomRef.current-m.x, y:clientY/zoomRef.current-m.y };
    if(isTouch) touchPanningRef.current=false;
  }, []);

  const onCardMouseDown = useCallback((e,id) => { e.stopPropagation(); handleCardInteraction(id,e.clientX,e.clientY,false); }, [handleCardInteraction]);

  const onMouseMove = useCallback(e => {
    if(draggingRef.current!==null) setMembers(p=>p.map(m=>m.id===draggingRef.current?{...m,x:e.clientX/zoomRef.current-dragOffRef.current.x,y:e.clientY/zoomRef.current-dragOffRef.current.y}:m));
    else if(isPanningRef.current) setPan({x:e.clientX-panStartRef.current.x,y:e.clientY-panStartRef.current.y});
  }, []);

  const onMouseUp = useCallback(e => {
    if(draggingRef.current!==null){ updateMemberPos(draggingRef.current,e.clientX/zoomRef.current-dragOffRef.current.x,e.clientY/zoomRef.current-dragOffRef.current.y); draggingRef.current=null; }
    isPanningRef.current=false;
  }, []);

  const onCanvasMouseDown = e => {
    if(e.target===canvasRef.current||e.target.tagName==="svg"||e.target.tagName==="SVG"){
      setSelected(null);
      if(connectModeRef.current){ setConnectFirst(null); connectFirstRef.current=null; return; }
      isPanningRef.current=true; panStartRef.current={x:e.clientX-panRef.current.x,y:e.clientY-panRef.current.y};
    }
  };

  const onWheel = e => { e.preventDefault(); setZoom(z=>Math.min(3,Math.max(0.2,z-e.deltaY*0.001))); };

  useEffect(() => {
    window.addEventListener("mousemove",onMouseMove);
    window.addEventListener("mouseup",onMouseUp);
    return ()=>{ window.removeEventListener("mousemove",onMouseMove); window.removeEventListener("mouseup",onMouseUp); };
  }, [onMouseMove,onMouseUp]);

  // ── Touch ──────────────────────────────────────────────────────
  const getTouchDist=(t1,t2)=>{const dx=t1.clientX-t2.clientX,dy=t1.clientY-t2.clientY;return Math.sqrt(dx*dx+dy*dy);};
  const getTouchMid=(t1,t2)=>({x:(t1.clientX+t2.clientX)/2,y:(t1.clientY+t2.clientY)/2});

  const onTouchStart=useCallback(e=>{
    if(e.touches.length===2){e.preventDefault();lastTouchDistRef.current=getTouchDist(e.touches[0],e.touches[1]);lastTouchMidRef.current=getTouchMid(e.touches[0],e.touches[1]);draggingRef.current=null;touchPanningRef.current=false;}
    else if(e.touches.length===1){const t=e.touches[0];touchPanStartRef.current={x:t.clientX-panRef.current.x,y:t.clientY-panRef.current.y};touchPanningRef.current=true;}
  },[]);

  const onTouchMove=useCallback(e=>{
    if(e.touches.length===2){
      e.preventDefault();
      const dist=getTouchDist(e.touches[0],e.touches[1]),mid=getTouchMid(e.touches[0],e.touches[1]);
      if(lastTouchDistRef.current!==null){
        const scale=dist/lastTouchDistRef.current,newZoom=Math.min(3,Math.max(0.2,zoomRef.current*scale));
        const cvs=canvasRef.current;
        if(cvs){const rect=cvs.getBoundingClientRect();const mx=mid.x-rect.left,my=mid.y-rect.top;const wx=(mx-panRef.current.x)/zoomRef.current,wy=(my-panRef.current.y)/zoomRef.current;setPan({x:mx-wx*newZoom,y:my-wy*newZoom});}
        setZoom(newZoom);
      }
      if(lastTouchMidRef.current){const dx=mid.x-lastTouchMidRef.current.x,dy=mid.y-lastTouchMidRef.current.y;setPan(p=>({x:p.x+dx,y:p.y+dy}));}
      lastTouchDistRef.current=dist;lastTouchMidRef.current=mid;
    } else if(e.touches.length===1){
      const t=e.touches[0];
      if(draggingRef.current!==null) setMembers(p=>p.map(m=>m.id===draggingRef.current?{...m,x:t.clientX/zoomRef.current-dragOffRef.current.x,y:t.clientY/zoomRef.current-dragOffRef.current.y}:m));
      else if(touchPanningRef.current) setPan({x:t.clientX-touchPanStartRef.current.x,y:t.clientY-touchPanStartRef.current.y});
    }
  },[]);

  const onTouchEnd=useCallback(e=>{
    lastTouchDistRef.current=null;lastTouchMidRef.current=null;
    if(draggingRef.current!==null){if(e.changedTouches.length>0){const t=e.changedTouches[0];updateMemberPos(draggingRef.current,t.clientX/zoomRef.current-dragOffRef.current.x,t.clientY/zoomRef.current-dragOffRef.current.y);}draggingRef.current=null;}
    touchPanningRef.current=false;
  },[]);

  const onCardTouchStart=useCallback((e,id)=>{
    if(e.touches.length!==1)return; e.stopPropagation();
    const t=e.touches[0]; handleCardInteraction(id,t.clientX,t.clientY,true);
  },[handleCardInteraction]);

  useEffect(()=>{
    const cvs=canvasRef.current;if(!cvs)return;
    cvs.addEventListener("touchstart",onTouchStart,{passive:false});
    cvs.addEventListener("touchmove",onTouchMove,{passive:false});
    cvs.addEventListener("touchend",onTouchEnd,{passive:false});
    return()=>{cvs.removeEventListener("touchstart",onTouchStart);cvs.removeEventListener("touchmove",onTouchMove);cvs.removeEventListener("touchend",onTouchEnd);};
  },[onTouchStart,onTouchMove,onTouchEnd]);

  const toggleMusic=e=>{
    e.stopPropagation();
    if(!audioRef.current)return;
    if(!playing){audioRef.current.volume=0.3;audioRef.current.play().then(()=>setPlaying(true)).catch(()=>{});}
    else{audioRef.current.pause();setPlaying(false);}
  };

  const shareUrl=`${window.location.origin}${window.location.pathname}?tree=${treeId}`;
  const copyLink=()=>{navigator.clipboard.writeText(shareUrl);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const shareWhatsApp=()=>window.open(`https://wa.me/?text=${encodeURIComponent("🌳 Te invito a ver y editar nuestro árbol genealógico familiar:\n"+shareUrl)}`,"_blank");
  const shareEmail=()=>window.open(`mailto:?subject=${encodeURIComponent("Árbol Genealógico Familiar")}&body=${encodeURIComponent("Hola!\n\nTe comparto el árbol genealógico familiar:\n\n"+shareUrl+"\n\nSaludos!")}`,"_blank");

  if(screen==="loading") return(
    <div style={{ width:"100vw",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F5F0E8",fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:"rgba(93,58,26,0.5)",letterSpacing:1 }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@300;400;500&display=swap" rel="stylesheet"/>
      🌳 Cargando...
    </div>
  );
  if(screen==="home") return <HomeScreen onOpen={openTree} onCreate={createTree}/>;

  return(
    <div style={{ width:"100vw",height:"100vh",background:"radial-gradient(ellipse at 60% 20%,#EDE4D0,#F5F0E8 60%,#E8E0D0)",display:"flex",flexDirection:"column",userSelect:"none",overflow:"hidden",fontFamily:"'Jost',sans-serif",touchAction:"none" }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@300;400;500&display=swap" rel="stylesheet"/>
      <audio ref={audioRef} src={MUSIC_URL} loop preload="auto" style={{ display:"none" }}/>

      {/* ── Header ── */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"rgba(245,240,232,0.92)",backdropFilter:"blur(8px)",borderBottom:"1px solid rgba(139,111,71,0.15)",flexShrink:0,gap:8,flexWrap:"wrap" }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <button onClick={goHome} style={{ padding:"5px 10px",border:"1.5px solid rgba(139,111,71,0.25)",borderRadius:2,background:"transparent",color:"rgba(93,58,26,0.5)",fontFamily:"'Jost',sans-serif",fontSize:11,cursor:"pointer" }}>← Inicio</button>
          <div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:300,color:"#3D2B1F",letterSpacing:1 }}>Árbol <em style={{ fontStyle:"italic",color:"#8B6F47" }}>Genealógico</em></div>
            <div style={{ fontSize:10,color:"rgba(93,58,26,0.45)",marginTop:1 }}>{members.length} personas · {connections.length} vínculos · <span style={{ color:"#5B7B6F" }}>● en vivo</span></div>
          </div>
        </div>
        <div style={{ display:"flex",gap:6,alignItems:"center",flexWrap:"wrap" }}>
          {connectMode?(
            <>
              <div style={{ display:"flex",gap:3,flexWrap:"wrap" }}>
                {CONN_BTNS.map(([t,l])=>(
                  <button key={t} onClick={()=>{setConnType(t);connTypeRef.current=t;}}
                    style={{ padding:"4px 8px",border:"1.5px solid",borderColor:connType===t?"#8B6F47":"rgba(139,111,71,0.25)",borderRadius:2,background:connType===t?"#8B6F47":"transparent",color:connType===t?"#FFF8F0":"#8B6F47",fontSize:10,cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:"0.5px",textTransform:"uppercase" }}>{l}</button>
                ))}
              </div>
              <Btn onClick={()=>{setConnectMode(false);connectModeRef.current=false;setConnectFirst(null);connectFirstRef.current=null;}} color="#8B6F47">✕</Btn>
            </>
          ):(
            <>
              <Btn onClick={()=>{setConnectMode(true);connectModeRef.current=true;setConnectFirst(null);connectFirstRef.current=null;}}>↔ Conectar</Btn>
              <Btn onClick={exportPDF} style={{ borderColor:"rgba(139,111,71,0.4)",color:"#5D3A1A" }}>{exporting?"...":"↓ PDF"}</Btn>
              <Btn onClick={()=>setShowShare(true)} style={{ borderColor:"rgba(91,123,111,0.4)",color:"#3D6B5A" }}>🔗 Compartir</Btn>
              <Btn onClick={()=>setShowAddModal(true)} primary>+ Agregar</Btn>
            </>
          )}
        </div>
      </div>

      {/* ── Canvas ── */}
      <div ref={canvasRef} style={{ flex:1,position:"relative",overflow:"hidden",cursor:"grab",touchAction:"none" }}
        onMouseDown={onCanvasMouseDown} onWheel={onWheel}>
        <div style={{ position:"absolute",top:0,left:0,transformOrigin:"0 0",transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>

          {/* Líneas */}
          <svg style={{ position:"absolute",top:0,left:0,width:12000,height:12000,pointerEvents:"none",overflow:"visible" }}>
            <defs><marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5z" fill="rgba(93,58,26,0.4)"/></marker></defs>
            {connections.map(conn=>{
              const fm=members.find(x=>x.id===conn.from_id),tm=members.find(x=>x.id===conn.to_id);
              if(!fm||!tm)return null;
              if(!visibleMemberIds.has(fm.id)||!visibleMemberIds.has(tm.id))return null;
              const CW=155,CH=240,x1=fm.x+CW/2,y1=fm.y+CH*0.6,x2=tm.x+CW/2,y2=tm.y+CH*0.6;
              const mx=(x1+x2)/2,my=(y1+y2)/2;
              const s=CONN[conn.type]||CONN["padre-hijo"];
              const d=s.curve?`M${x1} ${y1} C${x1} ${y1+(y2-y1)*0.45},${x2} ${y2-(y2-y1)*0.45},${x2} ${y2}`:`M${x1} ${y1} L${x2} ${y2}`;
              return(
                <g key={conn.id}>
                  <path d={d} fill="none" stroke={s.stroke} strokeWidth="2" strokeOpacity="0.65" strokeDasharray={s.dash||undefined} markerEnd={s.curve?"url(#arr)":undefined}/>
                  <text x={mx} y={my-8} textAnchor="middle" fontSize="9" fill="rgba(93,58,26,0.45)" fontFamily="Jost,sans-serif">{s.label}</text>
                  <circle cx={mx} cy={my+6} r="9" fill="rgba(245,240,232,0.95)" stroke={s.stroke} strokeWidth="1" strokeOpacity="0.5"
                    style={{ cursor:"pointer",pointerEvents:"all" }} onClick={e=>{e.stopPropagation();removeConnection(conn.id);}}/>
                  <text x={mx} y={my+10} textAnchor="middle" fontSize="10" fill="rgba(139,111,71,0.7)" style={{ pointerEvents:"none" }}>✕</text>
                </g>
              );
            })}
          </svg>

          {/* Tarjetas */}
          {members.map(m=>{
            if(!visibleMemberIds.has(m.id)) return null;
            const isPortal = m.linked_tree_id !== null && m.linked_tree_id !== undefined && m.linked_tree_id !== "";
            const col=COLORS[m.role]||COLORS["Otro"],mine=isMine(m),isFirst=connectFirst===m.id;

            // ── Tarjeta Portal ────────────────────────────────────
            if(isPortal) return(
              <div key={m.id}
                onMouseDown={e=>onCardMouseDown(e,m.id)}
                onTouchStart={e=>onCardTouchStart(e,m.id)}
                style={{ position:"absolute",left:m.x,top:m.y,width:155,
                  background:"linear-gradient(135deg,#FFF8E7,#FFF0C8)",
                  border:`2px solid ${isFirst?"#5B7B6F":"#D4A017"}`,
                  borderRadius:3,boxShadow:"0 4px 20px rgba(212,160,23,0.25)",
                  cursor:"pointer",overflow:"hidden",touchAction:"none" }}>
                <div style={{ padding:"14px 12px", textAlign:"center" }}>
                  <div style={{ fontSize:32,marginBottom:6 }}>🌳</div>
                  <div style={{ fontSize:9,letterSpacing:"1.2px",textTransform:"uppercase",color:"#8B6A00",fontWeight:500,marginBottom:4 }}>Árbol vinculado</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:400,color:"#5D3A00",lineHeight:1.2 }}>{m.name}</div>
                  <div style={{ fontSize:9,color:"rgba(93,58,26,0.5)",marginTop:6,letterSpacing:"0.3px" }}>Toca para abrir →</div>
                </div>
                {selected===m.id&&!connectMode&&(
                  <div style={{ borderTop:"1px solid rgba(212,160,23,0.3)",background:"rgba(255,248,200,0.6)",padding:"6px 7px",display:"flex",gap:3 }}>
                    <button onClick={e=>{e.stopPropagation();openTree(m.linked_tree_id);}}
                      style={{ flex:2,padding:4,background:"rgba(212,160,23,0.15)",border:"1px solid rgba(212,160,23,0.4)",borderRadius:2,fontSize:9,color:"#8B6A00",cursor:"pointer",fontFamily:"'Jost',sans-serif",textTransform:"uppercase",fontWeight:500 }}>🌳 Abrir árbol</button>
                    {mine&&<button onClick={e=>{e.stopPropagation();removeMember(m.id);}}
                      style={{ flex:1,padding:4,background:"transparent",border:"1px solid rgba(180,60,60,0.3)",borderRadius:2,fontSize:9,color:"#B43C3C",cursor:"pointer",fontFamily:"'Jost',sans-serif",textTransform:"uppercase" }}>✕</button>}
                  </div>
                )}
              </div>
            );

            // ── Tarjeta Normal ────────────────────────────────────
            return(
              <div key={m.id}
                onMouseDown={e=>onCardMouseDown(e,m.id)}
                onTouchStart={e=>onCardTouchStart(e,m.id)}
                style={{ position:"absolute",left:m.x,top:m.y,width:155,
                  background:isFirst?"rgba(240,252,248,0.97)":"rgba(255,252,245,0.94)",
                  border:`1.5px solid ${isFirst?"#5B7B6F":selected===m.id?(mine?"#8B6F47":"#B43C3C"):"rgba(139,111,71,0.2)"}`,
                  borderRadius:3,boxShadow:isFirst?"0 0 0 3px rgba(91,123,111,0.25),0 4px 20px rgba(93,58,26,0.1)":"0 3px 18px rgba(93,58,26,0.08)",
                  cursor:connectMode?"crosshair":(mine?"pointer":"default"),overflow:"hidden",touchAction:"none" }}>
                {!mine&&<div style={{ position:"absolute",top:5,right:5,zIndex:10,background:"rgba(255,252,245,0.9)",borderRadius:2,padding:"1px 5px",fontSize:9,color:"rgba(93,58,26,0.5)",border:"1px solid rgba(139,111,71,0.2)" }}>🔒</div>}
                {isFirst&&<div style={{ position:"absolute",top:5,left:5,zIndex:10,background:"#5B7B6F",borderRadius:2,padding:"1px 6px",fontSize:9,color:"#FFF",fontFamily:"'Jost',sans-serif" }}>① origen</div>}
                {m.photo?(
                  <div style={{ width:"100%",height:140,background:"#EDE4D0",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden" }}>
                    <img src={m.photo} style={{ maxWidth:"100%",maxHeight:"140px",width:"100%",height:"100%",objectFit:"contain",display:"block",pointerEvents:"none" }} draggable={false}/>
                  </div>
                ):(
                  <div style={{ width:"100%",height:140,background:"linear-gradient(135deg,#E8DFD0,#D5C9B8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,color:"rgba(139,111,71,0.3)" }}>👤</div>
                )}
                <div style={{ padding:"9px 11px 10px" }}>
                  <div style={{ display:"inline-block",padding:"2px 6px",borderRadius:2,fontSize:8,fontWeight:500,letterSpacing:1,textTransform:"uppercase",color:col[1],background:col[0],marginBottom:5 }}>{m.role}</div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:400,color:"#2D1B0E",lineHeight:1.2 }}>{m.name}</div>
                  {m.year&&<div style={{ fontSize:10,color:"rgba(93,58,26,0.4)",marginTop:2 }}>✦ {m.year}</div>}
                </div>
                {selected===m.id&&!connectMode&&(mine?(
                  <div style={{ display:"flex",gap:3,padding:"6px 7px",borderTop:"1px solid rgba(139,111,71,0.12)",background:"rgba(245,240,232,0.5)" }}>
                    <button onClick={e=>{e.stopPropagation();setEditingMember(m);}}
                      style={{ flex:2,padding:4,background:"rgba(139,111,71,0.08)",border:"1px solid rgba(139,111,71,0.25)",borderRadius:2,fontSize:9,color:"#5D3A1A",cursor:"pointer",fontFamily:"'Jost',sans-serif",textTransform:"uppercase",fontWeight:500 }}>✏️ Editar</button>
                    <button onClick={e=>{e.stopPropagation();removeMember(m.id);}}
                      style={{ flex:1,padding:4,background:"transparent",border:"1px solid rgba(180,60,60,0.3)",borderRadius:2,fontSize:9,color:"#B43C3C",cursor:"pointer",fontFamily:"'Jost',sans-serif",textTransform:"uppercase" }}>✕</button>
                  </div>
                ):(
                  <div style={{ padding:"7px 9px",borderTop:"1px solid rgba(139,111,71,0.12)",background:"rgba(245,240,232,0.5)",fontSize:9,color:"rgba(93,58,26,0.45)",textAlign:"center" }}>🔒 Creada por otro familiar</div>
                ))}
              </div>
            );
          })}
        </div>

        {members.length===0&&(
          <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,pointerEvents:"none" }}>
            <div style={{ fontSize:52,opacity:0.14 }}>🌳</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:300,color:"rgba(93,58,26,0.3)",letterSpacing:1 }}>Tu árbol genealógico</div>
            <div style={{ fontSize:12,color:"rgba(93,58,26,0.2)" }}>Presiona "+ Agregar" para comenzar</div>
          </div>
        )}
        {connectMode&&(
          <div style={{ position:"absolute",bottom:110,left:"50%",transform:"translateX(-50%)",background:"#5D3A1A",color:"#FFF8F0",padding:"9px 18px",borderRadius:2,fontSize:11,letterSpacing:"0.8px",whiteSpace:"nowrap",zIndex:10 }}>
            {connectFirst?"① Toca el segundo miembro":"Toca el primer miembro de la conexión"}
          </div>
        )}
        {toast&&(
          <div style={{ position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:toast.color,color:"#FFF",padding:"10px 20px",borderRadius:2,fontSize:12,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,0.2)",zIndex:50 }}>
            {toast.msg}
          </div>
        )}
      </div>

      {/* ── Barra generación ── */}
      <div style={{ position:"fixed",bottom:0,left:0,right:0,background:"rgba(245,240,232,0.95)",backdropFilter:"blur(8px)",borderTop:"1px solid rgba(139,111,71,0.15)",padding:"8px 14px",display:"flex",gap:6,overflowX:"auto",zIndex:90,alignItems:"center" }}>
        <span style={{ fontSize:9,color:"rgba(93,58,26,0.4)",letterSpacing:"0.8px",textTransform:"uppercase",flexShrink:0,marginRight:4 }}>Ver:</span>
        {["Todos",...Object.keys(GENERATION_ROLES)].map(g=>(
          <button key={g} onClick={()=>setGenFilter(g)}
            style={{ padding:"5px 12px",borderRadius:20,border:`1.5px solid ${genFilter===g?"#8B6F47":"rgba(139,111,71,0.25)"}`,background:genFilter===g?"#8B6F47":"transparent",color:genFilter===g?"#FFF8F0":"rgba(93,58,26,0.6)",fontFamily:"'Jost',sans-serif",fontSize:10,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",transition:"all 0.15s",flexShrink:0 }}>
            {g}
          </button>
        ))}
      </div>

      {/* ── D-pad navegación ── */}
      <div style={{ position:"fixed",bottom:64,left:14,zIndex:100 }}>
        <DPad onPan={handleDPan} onReset={()=>{setZoom(1);setPan({x:0,y:0});}}/>
      </div>

      {/* ── Zoom ── */}
      <div style={{ position:"fixed",bottom:64,right:14,display:"flex",flexDirection:"column",gap:4,zIndex:100 }}>
        {[["+",()=>setZoom(z=>Math.min(3,z+0.2))],["−",()=>setZoom(z=>Math.max(0.2,z-0.2))]].map(([l,fn])=>(
          <div key={l} onClick={fn} style={{ width:44,height:44,background:"rgba(255,252,245,0.93)",border:"1.5px solid rgba(139,111,71,0.3)",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:20,color:"#8B6F47",boxShadow:"0 2px 8px rgba(93,58,26,0.1)" }}>{l}</div>
        ))}
      </div>

      {/* ── Música ── */}
      <div onClick={toggleMusic} style={{ position:"fixed",bottom:64,left:"50%",transform:"translateX(-50%)",width:44,height:44,background:playing?"#8B6F47":"rgba(255,252,245,0.93)",border:"1.5px solid rgba(139,111,71,0.35)",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:20,zIndex:100,boxShadow:"0 2px 12px rgba(93,58,26,0.15)",transition:"all 0.2s" }}>
        {playing?"🔇":"🎵"}
      </div>

      {/* Edit Modal */}
      {editingMember&&<EditModal member={editingMember} onSave={saveMemberEdit} onClose={()=>setEditingMember(null)} handlePhotoFile={handlePhotoFile}/>}

      {/* ── Modal Compartir ── */}
      {showShare&&(
        <div onClick={()=>setShowShare(false)} style={{ position:"fixed",inset:0,background:"rgba(45,27,14,0.38)",backdropFilter:"blur(5px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#FFF8F0",border:"1.5px solid rgba(139,111,71,0.25)",borderRadius:4,padding:24,width:"100%",maxWidth:420,boxShadow:"0 20px 60px rgba(45,27,14,0.2)" }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,color:"#2D1B0E",marginBottom:8 }}>Compartir árbol</div>
            <div style={{ fontSize:12,color:"rgba(93,58,26,0.5)",marginBottom:14,lineHeight:1.6 }}>Comparte este link con tu familia. Cada familiar puede agregar su rama y solo edita sus propias tarjetas.</div>
            <div style={{ padding:"10px 12px",background:"rgba(245,240,232,0.8)",border:"1.5px solid rgba(139,111,71,0.2)",borderRadius:2,marginBottom:14,fontSize:11,color:"#5D3A1A",wordBreak:"break-all",fontFamily:"monospace" }}>{shareUrl}</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12 }}>
              <button onClick={copyLink} style={{ padding:"12px 6px",background:copied?"rgba(45,122,79,0.1)":"rgba(245,240,232,0.8)",border:`1.5px solid ${copied?"rgba(45,122,79,0.4)":"rgba(139,111,71,0.3)"}`,borderRadius:3,cursor:"pointer",fontFamily:"'Jost',sans-serif",fontSize:11,color:copied?"#2D7A4F":"#5D3A1A",textAlign:"center" }}>{copied?"✓ Copiado":"📋 Copiar"}</button>
              <button onClick={shareWhatsApp} style={{ padding:"12px 6px",background:"rgba(37,211,102,0.08)",border:"1.5px solid rgba(37,211,102,0.3)",borderRadius:3,cursor:"pointer",fontFamily:"'Jost',sans-serif",fontSize:11,color:"#1a8a47",textAlign:"center" }}>💬 WhatsApp</button>
              <button onClick={shareEmail} style={{ padding:"12px 6px",background:"rgba(66,133,244,0.08)",border:"1.5px solid rgba(66,133,244,0.3)",borderRadius:3,cursor:"pointer",fontFamily:"'Jost',sans-serif",fontSize:11,color:"#2a5fc4",textAlign:"center" }}>✉️ Email</button>
            </div>
            <Btn onClick={()=>setShowShare(false)} style={{ width:"100%",padding:11 }}>Cerrar</Btn>
          </div>
        </div>
      )}

      {/* ── Modal Agregar ── */}
      {showAddModal&&(
        <div onClick={()=>setShowAddModal(false)} style={{ position:"fixed",inset:0,background:"rgba(45,27,14,0.38)",backdropFilter:"blur(5px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px" }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#FFF8F0",border:"1.5px solid rgba(139,111,71,0.25)",borderRadius:4,padding:24,width:"100%",maxWidth:360,boxShadow:"0 20px 60px rgba(45,27,14,0.2)",maxHeight:"92vh",overflowY:"auto" }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,color:"#2D1B0E",marginBottom:16 }}>Agregar al árbol</div>

            {/* Selector tipo */}
            <div style={{ display:"flex",gap:6,marginBottom:18 }}>
              <button onClick={()=>setForm(f=>({...f,isPortal:false}))}
                style={{ flex:1,padding:"9px 6px",border:`1.5px solid ${!form.isPortal?"#8B6F47":"rgba(139,111,71,0.25)"}`,borderRadius:2,background:!form.isPortal?"#8B6F47":"transparent",color:!form.isPortal?"#FFF8F0":"#8B6F47",fontFamily:"'Jost',sans-serif",fontSize:11,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.5px" }}>
                👤 Persona
              </button>
              <button onClick={()=>setForm(f=>({...f,isPortal:true}))}
                style={{ flex:1,padding:"9px 6px",border:`1.5px solid ${form.isPortal?"#D4A017":"rgba(212,160,23,0.3)"}`,borderRadius:2,background:form.isPortal?"#D4A017":"transparent",color:form.isPortal?"#FFF":"#8B6A00",fontFamily:"'Jost',sans-serif",fontSize:11,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.5px" }}>
                🌳 Portal árbol
              </button>
            </div>

            {!form.isPortal ? (
              <>
                {[{label:"Nombre completo",el:<input autoFocus placeholder="Ej: María Elena Torres" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addMember()} style={iStyle}/>},
                  {label:"Relación",el:<select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={iStyle}>{ROLES.map(r=><option key={r}>{r}</option>)}</select>},
                  {label:"Año de nacimiento",el:<input placeholder="Ej: 1945" value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))} style={iStyle}/>},
                ].map(({label,el})=>(
                  <div key={label} style={{ marginBottom:12 }}>
                    <label style={{ display:"block",fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6F47",fontWeight:500,marginBottom:5 }}>{label}</label>
                    {el}
                  </div>
                ))}
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:"block",fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6F47",fontWeight:500,marginBottom:5 }}>Foto (opcional)</label>
                  <div onClick={()=>document.getElementById("mpi").click()} style={{ width:"100%",height:90,border:"1.5px dashed rgba(139,111,71,0.35)",borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:12,color:"rgba(139,111,71,0.55)",overflow:"hidden",position:"relative",background:"rgba(245,240,232,0.5)" }}>
                    {form.photo?<img src={form.photo} style={{ maxWidth:"100%",maxHeight:"90px",objectFit:"contain" }}/>:"📷 Subir foto"}
                  </div>
                  <input id="mpi" type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{ handlePhotoFile(e.target.files[0],photo=>setForm(f=>({...f,photo}))); e.target.value=""; }}/>
                </div>
              </>
            ) : (
              <>
                <div style={{ background:"rgba(255,248,200,0.5)",border:"1.5px solid rgba(212,160,23,0.3)",borderRadius:3,padding:"12px 14px",marginBottom:16,fontSize:11,color:"#6B5000",lineHeight:1.6 }}>
                  Crea una tarjeta portal que al tocarla abrirá el árbol genealógico de otro familiar (ej: el árbol de tu suegro).
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:"block",fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6A00",fontWeight:500,marginBottom:5 }}>Nombre del portal</label>
                  <input autoFocus placeholder="Ej: Familia Angulo Díaz" value={form.linkedTreeName}
                    onChange={e=>setForm(f=>({...f,linkedTreeName:e.target.value}))}
                    style={{ ...iStyle,borderColor:"rgba(212,160,23,0.4)" }}/>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ display:"block",fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6A00",fontWeight:500,marginBottom:5 }}>Link del árbol a vincular</label>
                  <input placeholder="Pega aquí el link del otro árbol" value={form.linkedTreeUrl}
                    onChange={e=>setForm(f=>({...f,linkedTreeUrl:e.target.value}))}
                    style={{ ...iStyle,borderColor:"rgba(212,160,23,0.4)" }}/>
                  <div style={{ fontSize:10,color:"rgba(93,58,26,0.4)",marginTop:4 }}>Pide el link a ese familiar con el botón 🔗 Compartir de su árbol</div>
                </div>
              </>
            )}

            <div style={{ display:"flex",gap:8,marginTop:18 }}>
              <Btn onClick={()=>setShowAddModal(false)} style={{ flex:1,padding:11 }}>Cancelar</Btn>
              <Btn onClick={addMember} primary style={{ flex:1,padding:11 }}>Agregar ✦</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const iStyle = { width:"100%",padding:"9px 11px",border:"1.5px solid rgba(139,111,71,0.25)",borderRadius:2,background:"rgba(245,240,232,0.5)",fontFamily:"'Jost',sans-serif",fontSize:13,color:"#2D1B0E",outline:"none" };
const inputStyle = iStyle;

function Btn({ children, onClick, primary, color, style={} }) {
  return (
    <button onClick={onClick} style={{ padding:"7px 14px",border:"1.5px solid",borderColor:color||(primary?"#5D3A1A":"rgba(139,111,71,0.35)"),borderRadius:2,background:color||(primary?"#5D3A1A":"transparent"),color:primary?"#FFF8F0":"#5D3A1A",fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:500,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",...style }}>
      {children}
    </button>
  );
}
