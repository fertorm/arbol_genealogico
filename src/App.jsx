import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { supabase } from "./supabase";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import SoltarConAmor from "./SoltarConAmor";
import NexusView from "./NexusView";

const MUSIC_URL = "/musica.mp3";
const PAN_STEP  = 120;

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
  "Bisabuelos":["Bisabuelo/a"],"Abuelos":["Abuelo/a"],
  "Padres":["Padre/Madre","Tío/Tía"],"Mi gen.":["Yo","Hermano/a","Pareja","Primo/a"],
  "Hijos":["Hijo/a"],"Nietos":["Nieto/a"],"Otros":["Otro"],
};
const COLORS = {
  "Bisabuelo/a":["#FAC775","#633806"],"Abuelo/a":["#9FE1CB","#085041"],
  "Padre/Madre":["#7BB3D4","#0C447C"],"Tío/Tía":["#F5C4B3","#712B13"],
  "Yo":["#AFA9EC","#3C3489"],"Hermano/a":["#B5D4F4","#0C447C"],
  "Pareja":["#F4C0D1","#72243E"],"Hijo/a":["#C0DD97","#27500A"],
  "Nieto/a":["#9FE1CB","#085041"],"Primo/a":["#FAC775","#633806"],"Otro":["#D3D1C7","#444441"],
};
const CONN = {
  "padre-hijo":      {stroke:"#8B6F47",dash:"",    label:"hijo/a de",    curve:true },
  "pareja":          {stroke:"#D4537E",dash:"6,3", label:"pareja de",    curve:false},
  "hermano":         {stroke:"#378ADD",dash:"2,4", label:"hno/a de",     curve:false},
  "abuelo-nieto":    {stroke:"#1D9E75",dash:"8,3", label:"nieto/a de",   curve:true },
  "bisabuelo-nieto": {stroke:"#9B59B6",dash:"10,4",label:"bisnieto/a de",curve:true },
  "tio-sobrino":     {stroke:"#E67E22",dash:"4,3", label:"sobrino/a de", curve:false},
};
const CONN_BTNS = [
  ["padre-hijo","↓ Hijo"],["pareja","♥ Pareja"],["hermano","≡ Hno"],
  ["abuelo-nieto","↓↓ Nieto"],["bisabuelo-nieto","↓↓↓ Bisnieto"],["tio-sobrino","↗ Sobrino"],
];

function getTreeIdFromUrl(){return new URLSearchParams(window.location.search).get("tree");}
function setTreeIdInUrl(id){const u=new URL(window.location);u.searchParams.set("tree",id);window.history.pushState({},"",u);}
function clearTreeFromUrl(){const u=new URL(window.location);u.searchParams.delete("tree");window.history.pushState({},"",u);}
function extractUUID(str){const m=str.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);return m?m[0]:null;}

// ── HomeScreen ────────────────────────────────────────────────────────────────
function HomeScreen({onOpen,onCreate}){
  const [recent,setRecent]=useState(getRecentTrees());
  const [joinId,setJoinId]=useState("");
  const [joining,setJoining]=useState(false);
  const [err,setErr]=useState("");
  const handleJoin=async()=>{
    const raw=joinId.trim();if(!raw)return;
    const id=extractUUID(raw)||raw;
    setJoining(true);setErr("");
    const{data}=await supabase.from("trees").select("id,name").eq("id",id).single();
    setJoining(false);
    if(data)onOpen(data.id,data.name);else setErr("No se encontró ese árbol. Verifica el link.");
  };
  return(
    <div style={{width:"100vw",minHeight:"100vh",background:"radial-gradient(ellipse at 60% 20%,#EDE4D0,#F5F0E8 60%,#E8E0D0)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Jost',sans-serif",padding:"24px 16px"}}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@300;400;500&display=swap" rel="stylesheet"/>
      <div style={{width:"100%",maxWidth:480}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontSize:48,marginBottom:10}}>🌳</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:300,color:"#3D2B1F",letterSpacing:1}}>Árbol <em style={{fontStyle:"italic",color:"#8B6F47"}}>Genealógico</em></div>
          <div style={{fontSize:12,color:"rgba(93,58,26,0.45)",marginTop:6}}>Conecta tu historia familiar</div>
        </div>
        <button onClick={onCreate} style={{width:"100%",padding:"16px",background:"#5D3A1A",color:"#FFF8F0",border:"none",borderRadius:3,fontFamily:"'Jost',sans-serif",fontSize:13,fontWeight:500,letterSpacing:"1.5px",textTransform:"uppercase",cursor:"pointer",marginBottom:14}}>+ Crear nuevo árbol</button>
        <div style={{background:"rgba(255,252,245,0.7)",border:"1.5px solid rgba(139,111,71,0.2)",borderRadius:3,padding:"16px",marginBottom:recent.length>0?14:0}}>
          <div style={{fontSize:10,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6F47",fontWeight:500,marginBottom:10}}>Continuar árbol existente</div>
          <div style={{display:"flex",gap:8}}>
            <input value={joinId} onChange={e=>{setJoinId(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&handleJoin()} placeholder="Pega el link o ID del árbol"
              style={{flex:1,padding:"9px 11px",border:"1.5px solid rgba(139,111,71,0.25)",borderRadius:2,background:"rgba(245,240,232,0.5)",fontFamily:"'Jost',sans-serif",fontSize:12,color:"#2D1B0E",outline:"none"}}/>
            <button onClick={handleJoin} disabled={joining}
              style={{padding:"9px 14px",background:"rgba(139,111,71,0.15)",border:"1.5px solid rgba(139,111,71,0.35)",borderRadius:2,color:"#5D3A1A",fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:500,letterSpacing:"0.8px",textTransform:"uppercase",cursor:"pointer"}}>
              {joining?"...":"Abrir"}
            </button>
          </div>
          {err&&<div style={{fontSize:11,color:"#B43C3C",marginTop:8}}>{err}</div>}
        </div>
        {recent.length>0&&(
          <div style={{background:"rgba(255,252,245,0.7)",border:"1.5px solid rgba(139,111,71,0.2)",borderRadius:3,overflow:"hidden"}}>
            <div style={{padding:"12px 16px 8px",fontSize:10,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6F47",fontWeight:500}}>Mis árboles recientes</div>
            {recent.map((t,i)=>(
              <div key={t.id} onClick={()=>onOpen(t.id,t.name)}
                style={{display:"flex",alignItems:"center",padding:"12px 16px",borderTop:i===0?"none":"1px solid rgba(139,111,71,0.1)",cursor:"pointer"}}>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17,color:"#2D1B0E"}}>{t.name}</div>
                  <div style={{fontSize:10,color:"rgba(93,58,26,0.4)",marginTop:2}}>Último acceso: {t.date}</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontSize:11,color:"rgba(93,58,26,0.35)"}}>Abrir →</span>
                  <button onClick={e=>{e.stopPropagation();removeRecentTree(t.id);setRecent(getRecentTrees());}}
                    style={{padding:"3px 7px",background:"transparent",border:"1px solid rgba(180,60,60,0.25)",borderRadius:2,fontSize:9,color:"rgba(180,60,60,0.6)",cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{textAlign:"center",marginTop:20,fontSize:10,color:"rgba(93,58,26,0.3)"}}>Todo se guarda automáticamente en la nube ☁️</div>
      </div>
    </div>
  );
}

// ── EditModal ─────────────────────────────────────────────────────────────────
function EditModal({member,onSave,onClose,handlePhotoFile}){
  const[form,setForm]=useState({name:member.name||"",role:member.role||"Otro",year:member.year||"",photo:member.photo||null});
  const[saving,setSaving]=useState(false);
  const handleSave=async()=>{if(!form.name.trim())return;setSaving(true);await onSave(member.id,form);setSaving(false);onClose();};
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(45,27,14,0.38)",backdropFilter:"blur(5px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#FFF8F0",border:"1.5px solid rgba(139,111,71,0.25)",borderRadius:4,padding:24,width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(45,27,14,0.2)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
          <div onClick={()=>document.getElementById("edit-photo-inp").click()}
            style={{width:64,height:64,borderRadius:3,overflow:"hidden",background:"#EDE4D0",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",border:"1.5px dashed rgba(139,111,71,0.3)",position:"relative"}}>
            {form.photo?<img src={form.photo} style={{width:"100%",height:"100%",objectFit:"contain"}}/>:<span style={{fontSize:24}}>👤</span>}
            <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(93,58,26,0.5)",fontSize:8,color:"#FFF",textAlign:"center",padding:"2px 0",fontFamily:"'Jost',sans-serif"}}>📷</div>
          </div>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:300,color:"#2D1B0E"}}>Editar persona</div>
            <div style={{fontSize:11,color:"rgba(93,58,26,0.4)",marginTop:2}}>Toca la foto para cambiarla</div>
          </div>
        </div>
        <input id="edit-photo-inp" type="file" accept="image/*" style={{display:"none"}}
          onChange={e=>{handlePhotoFile(e.target.files[0],photo=>setForm(f=>({...f,photo})));e.target.value="";}}/>
        {[{label:"Nombre completo",el:<input autoFocus value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&handleSave()} placeholder="Nombre completo" style={iStyle}/>},
          {label:"Relación",el:<select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={iStyle}>{ROLES.map(r=><option key={r}>{r}</option>)}</select>},
          {label:"Año de nacimiento",el:<input value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))} placeholder="Ej: 1945" style={iStyle}/>},
        ].map(({label,el})=>(
          <div key={label} style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6F47",fontWeight:500,marginBottom:5}}>{label}</label>
            {el}
          </div>
        ))}
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6F47",fontWeight:500,marginBottom:5}}>Foto</label>
          <div onClick={()=>document.getElementById("edit-photo-inp").click()}
            style={{width:"100%",height:100,border:"1.5px dashed rgba(139,111,71,0.35)",borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",position:"relative",background:"rgba(245,240,232,0.5)"}}>
            {form.photo?<img src={form.photo} style={{maxWidth:"100%",maxHeight:"100px",objectFit:"contain"}}/>:<span style={{fontSize:12,color:"rgba(139,111,71,0.5)"}}>📷 Subir / cambiar foto</span>}
          </div>
          {form.photo&&<button onClick={()=>setForm(f=>({...f,photo:null}))}
            style={{marginTop:6,padding:"4px 10px",background:"transparent",border:"1px solid rgba(180,60,60,0.3)",borderRadius:2,fontSize:10,color:"#B43C3C",cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>✕ Quitar foto</button>}
        </div>
        <div style={{display:"flex",gap:8,marginTop:18}}>
          <Btn onClick={onClose} style={{flex:1,padding:11}}>Cancelar</Btn>
          <Btn onClick={handleSave} primary style={{flex:1,padding:11}}>{saving?"Guardando...":"Guardar cambios"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ── D-pad ─────────────────────────────────────────────────────────────────────
function DPad({onPan,onReset}){
  const pressRef=useRef(null);
  const start=(dir)=>{onPan(dir);pressRef.current=setInterval(()=>onPan(dir),100);};
  const stop=()=>{clearInterval(pressRef.current);pressRef.current=null;};
  const b=(dir,lbl)=>(
    <div onMouseDown={()=>start(dir)} onMouseUp={stop} onMouseLeave={stop}
      onTouchStart={e=>{e.preventDefault();start(dir);}} onTouchEnd={e=>{e.preventDefault();stop();}}
      style={{width:44,height:44,background:"rgba(255,252,245,0.93)",border:"1.5px solid rgba(139,111,71,0.3)",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:"#8B6F47",userSelect:"none",touchAction:"none",boxShadow:"0 2px 8px rgba(93,58,26,0.1)"}}>
      {lbl}
    </div>
  );
  return(
    <div style={{display:"grid",gridTemplateColumns:"44px 44px 44px",gridTemplateRows:"44px 44px 44px",gap:3}}>
      <div/>{b("up","↑")}<div/>
      {b("left","←")}
      <div onMouseDown={onReset} onTouchStart={e=>{e.preventDefault();onReset();}}
        style={{width:44,height:44,background:"rgba(255,252,245,0.93)",border:"1.5px solid rgba(139,111,71,0.3)",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14,color:"#8B6F47",userSelect:"none",touchAction:"none"}}>⊙</div>
      {b("right","→")}
      <div/>{b("down","↓")}<div/>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [screen,setScreen]           = useState("loading");
  const [members,setMembers]         = useState([]);
  const [connections,setConnections] = useState([]);
  const [treeId,setTreeId]           = useState(null);
  const [exporting,setExporting]     = useState(false);
  const [showAddModal,setShowAddModal]= useState(false);
  const [showShare,setShowShare]     = useState(false);
  const [editingMember,setEditingMember] = useState(null);
  const [soltarMember,setSoltarMember]   = useState(null);
  const [showNexus,setShowNexus]     = useState(false);
  const [copied,setCopied]           = useState(false);
  const [connectMode,setConnectMode] = useState(false);
  const [connectFirst,setConnectFirst]= useState(null);
  const [connType,setConnType]       = useState("padre-hijo");
  const [selected,setSelected]       = useState(null);
  const [toast,setToast]             = useState(null);
  const [playing,setPlaying]         = useState(false);
  const [zoom,setZoom]               = useState(1);
  const [pan,setPan]                 = useState({x:0,y:0});
  const [genFilter,setGenFilter]     = useState("Todos");
  const [form,setForm]               = useState({name:"",role:"Padre/Madre",photo:null,year:"",isPortal:false,linkedTreeUrl:"",linkedTreeName:""});

  // ── Core refs ──────────────────────────────────────────────────────────────
  const treeIdRef       = useRef(null);
  const connTypeRef     = useRef("padre-hijo");
  const connectFirstRef = useRef(null);
  const connectModeRef  = useRef(false);
  const membersRef      = useRef([]);
  const zoomRef         = useRef(1);
  const panRef          = useRef({x:0,y:0});
  const canvasRef       = useRef(null);
  const audioRef        = useRef(null);   // música principal
  const wrapperRef      = useRef(null);

  // ── Feature 4: RAF + inertia refs ──────────────────────────────────────────
  const rafPanRef       = useRef(null);
  const pendingPanRef   = useRef(null);
  const velRef          = useRef({x:0,y:0});
  const lastMoveTimeRef = useRef(0);
  const lastMovePanRef  = useRef({x:0,y:0});
  const inertiaRAFRef   = useRef(null);

  // ── Drag / pan refs ────────────────────────────────────────────────────────
  const draggingRef     = useRef(null);
  const dragOffRef      = useRef({x:0,y:0});
  const isPanningRef    = useRef(false);
  const panStartRef     = useRef({x:0,y:0});
  const touchStateRef   = useRef({mode:"idle",draggingId:null,dragOff:{x:0,y:0},panStart:{x:0,y:0},pinchDist:0,pinchMid:{x:0,y:0},hasMoved:false,startX:0,startY:0});

  useEffect(()=>{treeIdRef.current=treeId;},[treeId]);
  useEffect(()=>{connTypeRef.current=connType;},[connType]);
  useEffect(()=>{connectFirstRef.current=connectFirst;},[connectFirst]);
  useEffect(()=>{connectModeRef.current=connectMode;},[connectMode]);
  useEffect(()=>{membersRef.current=members;},[members]);
  useEffect(()=>{zoomRef.current=zoom;},[zoom]);
  useEffect(()=>{panRef.current=pan;},[pan]);

  // Bloquear zoom del browser en móvil
  useEffect(()=>{
    const pZ=(e)=>{if(e.touches&&e.touches.length>1)e.preventDefault();};
    document.addEventListener("touchmove",pZ,{passive:false});
    return()=>{document.removeEventListener("touchmove",pZ);};
  },[]);

  const showToast=(msg,color="#B43C3C")=>{setToast({msg,color});setTimeout(()=>setToast(null),3000);};
  const handlePhotoFile=(file,cb)=>{if(!file)return;const r=new FileReader();r.onload=e=>cb(e.target.result);r.readAsDataURL(file);};
  // TEMP: cualquiera puede editar (restricción desactivada)
  const isMine=m=>true;
  const getTouchDist=(a,b)=>{const dx=a.clientX-b.clientX,dy=a.clientY-b.clientY;return Math.sqrt(dx*dx+dy*dy);};
  const getTouchMid=(a,b)=>({x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2});

  // ── Feature 4: RAF-batched pan setter ─────────────────────────────────────
  const schedulePan = useCallback((newPan)=>{
    pendingPanRef.current = newPan;
    if(!rafPanRef.current){
      rafPanRef.current = requestAnimationFrame(()=>{
        if(pendingPanRef.current){
          setPan(pendingPanRef.current);
          panRef.current = pendingPanRef.current;
        }
        rafPanRef.current = null;
      });
    }
  },[]);

  // ── Feature 4: Inertia ────────────────────────────────────────────────────
  const startInertia = useCallback(()=>{
    if(inertiaRAFRef.current) cancelAnimationFrame(inertiaRAFRef.current);
    const friction = 0.91;
    const tick = ()=>{
      velRef.current.x *= friction;
      velRef.current.y *= friction;
      if(Math.abs(velRef.current.x)<0.4 && Math.abs(velRef.current.y)<0.4){
        inertiaRAFRef.current=null; return;
      }
      setPan(p=>{
        const np={x:p.x+velRef.current.x,y:p.y+velRef.current.y};
        panRef.current=np; return np;
      });
      inertiaRAFRef.current = requestAnimationFrame(tick);
    };
    inertiaRAFRef.current = requestAnimationFrame(tick);
  },[]);

  const stopInertia = ()=>{
    if(inertiaRAFRef.current){ cancelAnimationFrame(inertiaRAFRef.current); inertiaRAFRef.current=null; }
    velRef.current={x:0,y:0};
  };

  // ── Feature 2: Abrir/cerrar Soltar con fade de audio ──────────────────────
  const openSoltar = useCallback((m)=>{
    // Reducir música principal
    if(audioRef.current && playing){
      const fadeOut = setInterval(()=>{
        if(!audioRef.current) return clearInterval(fadeOut);
        audioRef.current.volume = Math.max(0.04, audioRef.current.volume - 0.04);
        if(audioRef.current.volume <= 0.04) clearInterval(fadeOut);
      },80);
    }
    setSoltarMember(m);
  },[playing]);

  const closeSoltar = useCallback(()=>{
    // Restaurar música principal
    if(audioRef.current && playing){
      const fadeIn = setInterval(()=>{
        if(!audioRef.current) return clearInterval(fadeIn);
        audioRef.current.volume = Math.min(0.3, audioRef.current.volume + 0.03);
        if(audioRef.current.volume >= 0.3) clearInterval(fadeIn);
      },80);
    }
    setSoltarMember(null);
  },[playing]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    const id=getTreeIdFromUrl();
    if(id)openTree(id);else setScreen("home");
  },[]);

  const openTree=async(id)=>{
    setScreen("loading");
    const{data:tree}=await supabase.from("trees").select("*").eq("id",id).single();
    if(!tree){setScreen("home");return;}
    const{data:m}=await supabase.from("members").select("*").eq("tree_id",id);
    const{data:c}=await supabase.from("connections").select("*").eq("tree_id",id);
    setTreeId(id);treeIdRef.current=id;
    setMembers(m||[]);membersRef.current=m||[];
    setConnections(c||[]);
    setTreeIdInUrl(id);saveRecentTree(id,tree.name||"Mi Familia");
    setShowNexus(false);
    setScreen("tree");
  };

  const createTree=async()=>{
    setScreen("loading");
    const{data}=await supabase.from("trees").insert({name:"Mi Familia"}).select().single();
    if(data)await openTree(data.id);else setScreen("home");
  };

  const goHome=()=>{
    setTreeId(null);setMembers([]);setConnections([]);
    setConnectMode(false);setConnectFirst(null);setSelected(null);
    clearTreeFromUrl();setScreen("home");
  };

  // ── Realtime ──────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!treeId)return;
    const ch1=supabase.channel("m-"+treeId)
      .on("postgres_changes",{event:"*",schema:"public",table:"members",filter:`tree_id=eq.${treeId}`},p=>{
        if(p.eventType==="INSERT"){setMembers(prev=>{const u=prev.find(x=>x.id===p.new.id)?prev:[...prev,p.new];membersRef.current=u;return u;});}
        else if(p.eventType==="UPDATE"){setMembers(prev=>{const u=prev.map(x=>x.id===p.new.id?{...x,...p.new}:x);membersRef.current=u;return u;});}
        else if(p.eventType==="DELETE"){setMembers(prev=>{const u=prev.filter(x=>x.id!==p.old.id);membersRef.current=u;return u;});}
      }).subscribe();
    const ch2=supabase.channel("c-"+treeId)
      .on("postgres_changes",{event:"*",schema:"public",table:"connections",filter:`tree_id=eq.${treeId}`},p=>{
        if(p.eventType==="INSERT")setConnections(prev=>prev.find(x=>x.id===p.new.id)?prev:[...prev,p.new]);
        else if(p.eventType==="DELETE")setConnections(prev=>prev.filter(x=>x.id!==p.old.id));
      }).subscribe();
    return()=>{supabase.removeChannel(ch1);supabase.removeChannel(ch2);};
  },[treeId]);

  const connectMembers=async(fromId,toId)=>{
    const tid=treeIdRef.current,ct=connTypeRef.current;
    if(!tid||!fromId||!toId||fromId===toId)return;
    const{data:ex}=await supabase.from("connections").select("id").eq("tree_id",tid)
      .or(`and(from_id.eq.${fromId},to_id.eq.${toId}),and(from_id.eq.${toId},to_id.eq.${fromId})`);
    if(ex&&ex.length>0){showToast("⚠️ Ya existe una conexión","#E67E22");return;}
    const{data,error}=await supabase.from("connections").insert({tree_id:tid,from_id:fromId,to_id:toId,type:ct}).select().single();
    if(error)showToast("❌ Error: "+error.message);
    else if(data){setConnections(p=>[...p,data]);showToast("✓ Conexión creada","#2D7A4F");}
  };

  const addMember=async()=>{
    if(!treeId)return;
    const cvs=canvasRef.current,z=zoomRef.current,p=panRef.current;
    const basePos={x:(cvs.clientWidth/2-p.x)/z-77+(Math.random()-0.5)*100,y:(cvs.clientHeight/2-p.y)/z-90+(Math.random()-0.5)*60};
    if(form.isPortal){
      if(!form.linkedTreeName.trim()){showToast("Escribe un nombre para el portal");return;}
      const linkedId=extractUUID(form.linkedTreeUrl||"");
      const{data,error}=await supabase.from("members").insert({tree_id:treeId,name:form.linkedTreeName.trim(),role:"Otro",linked_tree_id:linkedId||null,linked_tree_name:form.linkedTreeName.trim(),creator_id:MY_ID,...basePos}).select().single();
      if(error){showToast("❌ Error: "+error.message);return;}
      if(data){setMembers(p=>[...p,data]);membersRef.current=[...membersRef.current,data];}
    }else{
      if(!form.name.trim())return;
      const{data,error}=await supabase.from("members").insert({tree_id:treeId,name:form.name.trim(),role:form.role,photo:form.photo,year:form.year,creator_id:MY_ID,...basePos}).select().single();
      if(error){showToast("❌ Error: "+error.message);return;}
      if(data){setMembers(p=>[...p,data]);membersRef.current=[...membersRef.current,data];}
    }
    setForm({name:"",role:"Padre/Madre",photo:null,year:"",isPortal:false,linkedTreeUrl:"",linkedTreeName:""});
    setShowAddModal(false);
  };

  const saveMemberEdit=async(id,fields)=>{
    const{error}=await supabase.from("members").update({name:fields.name.trim(),role:fields.role,year:fields.year,photo:fields.photo}).eq("id",id);
    if(error){showToast("❌ Error: "+error.message);return;}
    setMembers(p=>p.map(m=>m.id===id?{...m,...fields,name:fields.name.trim()}:m));
    showToast("✓ Cambios guardados","#2D7A4F");
  };

  const removeMember=async id=>{
    const m=membersRef.current.find(x=>x.id===id);
    if(!isMine(m)){showToast("🔒 Solo puedes eliminar tus propias tarjetas");return;}
    await supabase.from("members").delete().eq("id",id);
    setMembers(p=>p.filter(x=>x.id!==id));
    setConnections(p=>p.filter(x=>x.from_id!==id&&x.to_id!==id));
    setSelected(null);
  };

  const removeConnection=async id=>{
    await supabase.from("connections").delete().eq("id",id);
    setConnections(p=>p.filter(x=>x.id!==id));
  };

  const updateMemberPos=async(id,x,y)=>{
    const m=membersRef.current.find(mem=>mem.id===id);
    if(!m||!isMine(m))return;
    setMembers(p=>p.map(mem=>mem.id===id?{...mem,x,y}:mem));
    await supabase.from("members").update({x,y}).eq("id",id);
  };

  const exportPDF=async()=>{
    setExporting(true);
    try{
      const canvas=await html2canvas(canvasRef.current,{backgroundColor:"#F5F0E8",scale:2,useCORS:true});
      const pdf=new jsPDF("landscape","mm","a4");
      pdf.addImage(canvas.toDataURL("image/png"),"PNG",0,0,297,210);
      pdf.save("arbol-genealogico.pdf");
    }catch(e){console.error(e);}
    setExporting(false);
  };

  const handleDPan=(dir)=>{
    stopInertia();
    const s=PAN_STEP/zoomRef.current;
    setPan(p=>({x:p.x+(dir==="left"?s:dir==="right"?-s:0),y:p.y+(dir==="up"?s:dir==="down"?-s:0)}));
  };

  // ── Mouse ─────────────────────────────────────────────────────────────────
  const getCardIdFromElement=useCallback((el)=>{
    let node=el;
    while(node&&node!==canvasRef.current){if(node.dataset&&node.dataset.cardid)return node.dataset.cardid;node=node.parentElement;}
    return null;
  },[]);

  const startCardDrag=useCallback((id,clientX,clientY)=>{
    stopInertia();
    if(connectModeRef.current){
      const first=connectFirstRef.current;
      if(!first){setConnectFirst(id);connectFirstRef.current=id;return;}
      if(first===id){setConnectFirst(null);connectFirstRef.current=null;return;}
      connectMembers(first,id);
      setConnectFirst(null);connectFirstRef.current=null;
      setConnectMode(false);connectModeRef.current=false;
      return;
    }
    const m=membersRef.current.find(x=>x.id===id);
    setSelected(id);
    if(!m||!isMine(m)||m.linked_tree_id)return;
    draggingRef.current=id;
    dragOffRef.current={x:clientX/zoomRef.current-m.x,y:clientY/zoomRef.current-m.y};
  },[]);

  const onCardMouseDown=useCallback((e,id)=>{e.stopPropagation();startCardDrag(id,e.clientX,e.clientY);},[startCardDrag]);

  const onMouseMove=useCallback(e=>{
    if(draggingRef.current!==null){
      setMembers(p=>p.map(m=>m.id===draggingRef.current?{...m,x:e.clientX/zoomRef.current-dragOffRef.current.x,y:e.clientY/zoomRef.current-dragOffRef.current.y}:m));
    }else if(isPanningRef.current){
      const np={x:e.clientX-panStartRef.current.x,y:e.clientY-panStartRef.current.y};
      // Track velocity
      const now=performance.now(),dt=now-lastMoveTimeRef.current;
      if(dt>0&&dt<80){velRef.current={x:(np.x-lastMovePanRef.current.x)/dt*16,y:(np.y-lastMovePanRef.current.y)/dt*16};}
      lastMoveTimeRef.current=now;lastMovePanRef.current=np;
      setPan(np);
    }
  },[]);

  const onMouseUp=useCallback(e=>{
    if(draggingRef.current!==null){
      updateMemberPos(draggingRef.current,e.clientX/zoomRef.current-dragOffRef.current.x,e.clientY/zoomRef.current-dragOffRef.current.y);
      draggingRef.current=null;
    }else if(isPanningRef.current){
      startInertia();
    }
    isPanningRef.current=false;
  },[startInertia]);

  const onCanvasMouseDown=e=>{
    if(e.target===canvasRef.current||e.target.tagName==="svg"||e.target.tagName==="SVG"){
      setSelected(null);
      if(connectModeRef.current){setConnectFirst(null);connectFirstRef.current=null;return;}
      stopInertia();
      isPanningRef.current=true;
      const np={x:e.clientX-panRef.current.x,y:e.clientY-panRef.current.y};
      panStartRef.current=np;lastMovePanRef.current=panRef.current;lastMoveTimeRef.current=performance.now();
    }
  };

  const onWheel=e=>{e.preventDefault();stopInertia();setZoom(z=>Math.min(3,Math.max(0.2,z-e.deltaY*0.001)));};

  useEffect(()=>{
    window.addEventListener("mousemove",onMouseMove);
    window.addEventListener("mouseup",onMouseUp);
    return()=>{window.removeEventListener("mousemove",onMouseMove);window.removeEventListener("mouseup",onMouseUp);};
  },[onMouseMove,onMouseUp]);

  // ── Touch con RAF + inertia ───────────────────────────────────────────────
  const isInteractive = (el) => {
    const tags = ["BUTTON","INPUT","SELECT","TEXTAREA","A","LABEL"];
    let node = el;
    while (node) {
      if (tags.includes(node.tagName)) return true;
      if (node === document.body) break;
      node = node.parentElement;
    }
    return false;
  };

  const onTouchStartUnified=useCallback(e=>{
    if (isInteractive(e.target)) return;
    // No llamamos preventDefault() en touchstart para no activar ghost-click suppression de iOS.
    // El preventDefault() se aplica solo cuando hay movimiento real (en touchmove/touchend).
    stopInertia();
    const ts=touchStateRef.current;
    ts.hasMoved=false;
    if(e.touches.length===2){
      ts.mode="pinch";ts.draggingId=null;
      ts.pinchDist=getTouchDist(e.touches[0],e.touches[1]);
      ts.pinchMid=getTouchMid(e.touches[0],e.touches[1]);
      ts.startX=e.touches[0].clientX;ts.startY=e.touches[0].clientY;
      return;
    }
    if(e.touches.length===1){
      const t=e.touches[0];
      ts.startX=t.clientX;ts.startY=t.clientY;
      const cardId=getCardIdFromElement(t.target);
      if(cardId){
        if(connectModeRef.current){
          const first=connectFirstRef.current;
          if(!first){setConnectFirst(cardId);connectFirstRef.current=cardId;return;}
          if(first===cardId){setConnectFirst(null);connectFirstRef.current=null;return;}
          connectMembers(first,cardId);
          setConnectFirst(null);connectFirstRef.current=null;
          setConnectMode(false);connectModeRef.current=false;
          return;
        }
        const m=membersRef.current.find(x=>x.id===cardId);
        setSelected(cardId);
        if(m&&isMine(m)&&!m.linked_tree_id){
          ts.mode="drag";ts.draggingId=cardId;
          ts.dragOff={x:t.clientX/zoomRef.current-m.x,y:t.clientY/zoomRef.current-m.y};
        }else{
          ts.mode="pan";
          ts.panStart={x:t.clientX-panRef.current.x,y:t.clientY-panRef.current.y};
          lastMovePanRef.current=panRef.current;lastMoveTimeRef.current=performance.now();
        }
      }else{
        setSelected(null);
        if(connectModeRef.current){setConnectFirst(null);connectFirstRef.current=null;}
        ts.mode="pan";
        ts.panStart={x:t.clientX-panRef.current.x,y:t.clientY-panRef.current.y};
        lastMovePanRef.current=panRef.current;lastMoveTimeRef.current=performance.now();
      }
    }
  },[getCardIdFromElement,startInertia]);

  const onTouchMoveUnified=useCallback(e=>{
    const ts=touchStateRef.current;
    if(e.touches.length===2&&ts.mode==="pinch"){
      // Pinch siempre necesita preventDefault para evitar zoom nativo
      e.preventDefault();
      ts.hasMoved=true;
      const newDist=getTouchDist(e.touches[0],e.touches[1]);
      const newMid=getTouchMid(e.touches[0],e.touches[1]);
      const cvs=canvasRef.current;
      if(ts.pinchDist>0&&cvs){
        const scale=newDist/ts.pinchDist;
        const oldZoom=zoomRef.current;
        const newZoom=Math.min(3,Math.max(0.2,oldZoom*scale));
        const rect=cvs.getBoundingClientRect();
        const mx=newMid.x-rect.left,my=newMid.y-rect.top;
        const wx=(mx-panRef.current.x)/oldZoom,wy=(my-panRef.current.y)/oldZoom;
        const dx=newMid.x-ts.pinchMid.x,dy=newMid.y-ts.pinchMid.y;
        const np={x:(mx-wx*newZoom)+dx,y:(my-wy*newZoom)+dy};
        setZoom(newZoom);
        schedulePan(np);
      }
      ts.pinchDist=newDist;ts.pinchMid=newMid;
      return;
    }
    if(e.touches.length===1){
      const t=e.touches[0];
      // Detectar movimiento real con umbral de 8px para distinguir tap de arrastre
      const dist=Math.hypot(t.clientX-ts.startX,t.clientY-ts.startY);
      if(dist>8) ts.hasMoved=true;
      // Solo aplicar preventDefault cuando hay movimiento real (pan/drag activo)
      if(ts.hasMoved) e.preventDefault();
      if(ts.mode==="drag"&&ts.draggingId){
        setMembers(p=>p.map(m=>m.id===ts.draggingId?{...m,x:t.clientX/zoomRef.current-ts.dragOff.x,y:t.clientY/zoomRef.current-ts.dragOff.y}:m));
        return;
      }
      if(ts.mode==="pan"&&ts.hasMoved){
        const np={x:t.clientX-ts.panStart.x,y:t.clientY-ts.panStart.y};
        // Velocity tracking
        const now=performance.now(),dt=now-lastMoveTimeRef.current;
        if(dt>0&&dt<80){velRef.current={x:(np.x-lastMovePanRef.current.x)/dt*16,y:(np.y-lastMovePanRef.current.y)/dt*16};}
        lastMoveTimeRef.current=now;lastMovePanRef.current=np;
        schedulePan(np);
      }
    }
  },[schedulePan]);

  const onTouchEndUnified=useCallback(e=>{
    const ts=touchStateRef.current;
    // Solo prevenir click si hubo movimiento real (pan/drag), no en taps simples
    if(ts.hasMoved) e.preventDefault();
    if(ts.mode==="drag"&&ts.draggingId&&e.changedTouches.length>0){
      const t=e.changedTouches[0];
      updateMemberPos(ts.draggingId,t.clientX/zoomRef.current-ts.dragOff.x,t.clientY/zoomRef.current-ts.dragOff.y);
    }
    if(ts.mode==="pan") startInertia();
    if(e.touches.length===1){
      ts.mode="pan";ts.draggingId=null;
      ts.panStart={x:e.touches[0].clientX-panRef.current.x,y:e.touches[0].clientY-panRef.current.y};
      return;
    }
    ts.mode="idle";ts.draggingId=null;ts.pinchDist=0;
  },[startInertia]);

  useEffect(()=>{
    const el=canvasRef.current;if(!el)return;
    el.addEventListener("touchstart",onTouchStartUnified,{passive:false});
    el.addEventListener("touchmove",onTouchMoveUnified,{passive:false});
    el.addEventListener("touchend",onTouchEndUnified,{passive:false});
    el.addEventListener("touchcancel",onTouchEndUnified,{passive:false});
    return()=>{
      el.removeEventListener("touchstart",onTouchStartUnified);
      el.removeEventListener("touchmove",onTouchMoveUnified);
      el.removeEventListener("touchend",onTouchEndUnified);
      el.removeEventListener("touchcancel",onTouchEndUnified);
    };
  },[onTouchStartUnified,onTouchMoveUnified,onTouchEndUnified]);

  const toggleMusic=e=>{
    e.stopPropagation();
    if(!audioRef.current)return;
    if(!playing){audioRef.current.volume=0.3;audioRef.current.play().then(()=>setPlaying(true)).catch(()=>{});}
    else{audioRef.current.pause();setPlaying(false);}
  };

  // ── Feature 1: visibilidad Soltar para TODOS ───────────────────────────────
  // (el botón Soltar aparece en todas las tarjetas, propias y ajenas)

  // ── Filtro generación ─────────────────────────────────────────────────────
  const visibleMemberIds = useMemo(()=>new Set(
    genFilter==="Todos"
      ? members.map(m=>m.id)
      : members.filter(m=>{
          if(m.linked_tree_id)return true;
          return(GENERATION_ROLES[genFilter]||[]).includes(m.role);
        }).map(m=>m.id)
  ),[members,genFilter]);

  const shareUrl=`${window.location.origin}${window.location.pathname}?tree=${treeId}`;
  const copyLink=()=>{navigator.clipboard.writeText(shareUrl);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const shareWhatsApp=()=>window.open(`https://wa.me/?text=${encodeURIComponent("🌳 Te invito a ver y editar nuestro árbol genealógico familiar:\n"+shareUrl)}`,"_blank");
  const shareEmail=()=>window.open(`mailto:?subject=${encodeURIComponent("Árbol Genealógico Familiar")}&body=${encodeURIComponent("Hola!\n\nTe comparto el árbol genealógico familiar:\n\n"+shareUrl+"\n\nSaludos!")}`,"_blank");

  if(screen==="loading")return(
    <div style={{width:"100vw",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F5F0E8",fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:"rgba(93,58,26,0.5)",letterSpacing:1}}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@300;400;500&display=swap" rel="stylesheet"/>
      🌳 Cargando...
    </div>
  );
  if(screen==="home")return <HomeScreen onOpen={openTree} onCreate={createTree}/>;

  return(
    <>
      <style>{`html,body{overflow:hidden;overscroll-behavior:none;}*{-webkit-tap-highlight-color:transparent;}`}</style>
      <div ref={wrapperRef} style={{width:"100vw",height:"100vh",background:"radial-gradient(ellipse at 60% 20%,#EDE4D0,#F5F0E8 60%,#E8E0D0)",display:"flex",flexDirection:"column",userSelect:"none",overflow:"hidden",fontFamily:"'Jost',sans-serif"}}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@300;400;500&display=swap" rel="stylesheet"/>
        <audio ref={audioRef} src={MUSIC_URL} loop preload="auto" style={{display:"none"}}/>

        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"rgba(245,240,232,0.92)",backdropFilter:"blur(8px)",borderBottom:"1px solid rgba(139,111,71,0.15)",flexShrink:0,gap:8,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <button onClick={goHome} style={{padding:"6px 12px",border:"1.5px solid rgba(139,111,71,0.25)",borderRadius:2,background:"transparent",color:"rgba(93,58,26,0.5)",fontFamily:"'Jost',sans-serif",fontSize:11,cursor:"pointer"}}>← Inicio</button>
            <div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:300,color:"#3D2B1F",letterSpacing:1}}>Árbol <em style={{fontStyle:"italic",color:"#8B6F47"}}>Genealógico</em></div>
              <div style={{fontSize:10,color:"rgba(93,58,26,0.45)",marginTop:1}}>{members.length} personas · {connections.length} vínculos · <span style={{color:"#5B7B6F"}}>● en vivo</span></div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {connectMode?(
              <>
                <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                  {CONN_BTNS.map(([t,l])=>(
                    <button key={t} onClick={()=>{setConnType(t);connTypeRef.current=t;}}
                      style={{padding:"5px 9px",border:"1.5px solid",borderColor:connType===t?"#8B6F47":"rgba(139,111,71,0.25)",borderRadius:2,background:connType===t?"#8B6F47":"transparent",color:connType===t?"#FFF8F0":"#8B6F47",fontSize:10,cursor:"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:"0.5px",textTransform:"uppercase"}}>{l}</button>
                  ))}
                </div>
                <Btn onClick={()=>{setConnectMode(false);connectModeRef.current=false;setConnectFirst(null);connectFirstRef.current=null;}} color="#8B6F47">✕</Btn>
              </>
            ):(
              <>
                {/* Feature 3: Botón Nexus */}
                <Btn onClick={()=>setShowNexus(true)} style={{borderColor:"rgba(212,160,23,0.4)",color:"#8B6A00"}}>🌐 Nexus</Btn>
                <Btn onClick={()=>{setConnectMode(true);connectModeRef.current=true;setConnectFirst(null);connectFirstRef.current=null;}}>↔ Conectar</Btn>
                <Btn onClick={exportPDF} style={{borderColor:"rgba(139,111,71,0.4)",color:"#5D3A1A"}}>{exporting?"...":"↓ PDF"}</Btn>
                <Btn onClick={()=>setShowShare(true)} style={{borderColor:"rgba(91,123,111,0.4)",color:"#3D6B5A"}}>🔗 Compartir</Btn>
                <Btn onClick={()=>setShowAddModal(true)} primary>+ Agregar</Btn>
              </>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div ref={canvasRef} style={{flex:1,position:"relative",overflow:"hidden",cursor:"grab",touchAction:"none"}}
          onMouseDown={onCanvasMouseDown} onWheel={onWheel}>
          <div style={{position:"absolute",top:0,left:0,transformOrigin:"0 0",transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}}>

            {/* Líneas */}
            <svg style={{position:"absolute",top:0,left:0,width:12000,height:12000,pointerEvents:"none",overflow:"visible"}}>
              <defs><marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5z" fill="rgba(93,58,26,0.4)"/></marker></defs>
              {connections.map(conn=>{
                const fm=members.find(x=>x.id===conn.from_id),tm=members.find(x=>x.id===conn.to_id);
                if(!fm||!tm||!visibleMemberIds.has(fm.id)||!visibleMemberIds.has(tm.id))return null;
                const CW=155,CH=240,x1=fm.x+CW/2,y1=fm.y+CH*0.6,x2=tm.x+CW/2,y2=tm.y+CH*0.6;
                const mx=(x1+x2)/2,my=(y1+y2)/2;
                const s=CONN[conn.type]||CONN["padre-hijo"];
                const d=s.curve?`M${x1} ${y1} C${x1} ${y1+(y2-y1)*0.45},${x2} ${y2-(y2-y1)*0.45},${x2} ${y2}`:`M${x1} ${y1} L${x2} ${y2}`;
                return(
                  <g key={conn.id}>
                    <path d={d} fill="none" stroke={s.stroke} strokeWidth="2" strokeOpacity="0.65" strokeDasharray={s.dash||undefined} markerEnd={s.curve?"url(#arr)":undefined}/>
                    <text x={mx} y={my-8} textAnchor="middle" fontSize="9" fill="rgba(93,58,26,0.45)" fontFamily="Jost,sans-serif">{s.label}</text>
                    <circle cx={mx} cy={my+6} r="9" fill="rgba(245,240,232,0.95)" stroke={s.stroke} strokeWidth="1" strokeOpacity="0.5"
                      style={{cursor:"pointer",pointerEvents:"all"}} onClick={e=>{e.stopPropagation();removeConnection(conn.id);}}/>
                    <text x={mx} y={my+10} textAnchor="middle" fontSize="10" fill="rgba(139,111,71,0.7)" style={{pointerEvents:"none"}}>✕</text>
                  </g>
                );
              })}
            </svg>

            {/* Tarjetas */}
            {members.map(m=>{
              if(!visibleMemberIds.has(m.id))return null;
              const isPortal=!!(m.linked_tree_id);
              const col=COLORS[m.role]||COLORS["Otro"],mine=isMine(m),isFirst=connectFirst===m.id;

              // ── Portal ──────────────────────────────────────────
              if(isPortal)return(
                <div key={m.id} data-cardid={m.id} onMouseDown={e=>onCardMouseDown(e,m.id)}
                  style={{position:"absolute",left:m.x,top:m.y,width:155,background:"linear-gradient(135deg,#FFF8E7,#FFF0C8)",border:`2px solid ${isFirst?"#5B7B6F":"#D4A017"}`,borderRadius:3,boxShadow:"0 4px 20px rgba(212,160,23,0.25)",cursor:"pointer",overflow:"hidden",touchAction:"none"}}>
                  <div style={{padding:"14px 12px",textAlign:"center"}}>
                    <div style={{fontSize:32,marginBottom:6}}>🌳</div>
                    <div style={{fontSize:9,letterSpacing:"1.2px",textTransform:"uppercase",color:"#8B6A00",fontWeight:500,marginBottom:4}}>Árbol vinculado</div>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:400,color:"#5D3A00",lineHeight:1.2}}>{m.name}</div>
                    <div style={{fontSize:9,color:"rgba(93,58,26,0.5)",marginTop:6}}>Toca para abrir →</div>
                  </div>
                  {selected===m.id&&!connectMode&&(
                    <div style={{borderTop:"1px solid rgba(212,160,23,0.3)",background:"rgba(255,248,200,0.6)",padding:"6px 7px",display:"flex",gap:3}}>
                      <button onClick={e=>{e.stopPropagation();openTree(m.linked_tree_id);}}
                        style={{flex:2,padding:5,background:"rgba(212,160,23,0.15)",border:"1px solid rgba(212,160,23,0.4)",borderRadius:2,fontSize:9,color:"#8B6A00",cursor:"pointer",fontFamily:"'Jost',sans-serif",textTransform:"uppercase",fontWeight:500}}>🌳 Abrir árbol</button>
                      {mine&&<button onClick={e=>{e.stopPropagation();removeMember(m.id);}}
                        style={{flex:1,padding:5,background:"transparent",border:"1px solid rgba(180,60,60,0.3)",borderRadius:2,fontSize:9,color:"#B43C3C",cursor:"pointer",fontFamily:"'Jost',sans-serif",textTransform:"uppercase"}}>✕</button>}
                    </div>
                  )}
                </div>
              );

              // ── Tarjeta normal ───────────────────────────────────
              return(
                <div key={m.id} data-cardid={m.id} onMouseDown={e=>onCardMouseDown(e,m.id)}
                  style={{position:"absolute",left:m.x,top:m.y,width:155,
                    background:isFirst?"rgba(240,252,248,0.97)":"rgba(255,252,245,0.94)",
                    border:`1.5px solid ${isFirst?"#5B7B6F":selected===m.id?(mine?"#8B6F47":"#B43C3C"):"rgba(139,111,71,0.2)"}`,
                    borderRadius:3,
                    boxShadow:isFirst?"0 0 0 3px rgba(91,123,111,0.25),0 4px 20px rgba(93,58,26,0.1)":"0 3px 18px rgba(93,58,26,0.08)",
                    cursor:connectMode?"crosshair":(mine?"pointer":"default"),overflow:"hidden",touchAction:"none"}}>

                  {!mine&&<div style={{position:"absolute",top:5,right:5,zIndex:10,background:"rgba(255,252,245,0.9)",borderRadius:2,padding:"1px 5px",fontSize:9,color:"rgba(93,58,26,0.5)",border:"1px solid rgba(139,111,71,0.2)"}}>🔒</div>}
                  {isFirst&&<div style={{position:"absolute",top:5,left:5,zIndex:10,background:"#5B7B6F",borderRadius:2,padding:"1px 6px",fontSize:9,color:"#FFF",fontFamily:"'Jost',sans-serif"}}>① origen</div>}

                  {m.photo?(
                    <div style={{width:"100%",height:140,background:"#EDE4D0",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                      <img src={m.photo} style={{maxWidth:"100%",maxHeight:"140px",width:"100%",height:"100%",objectFit:"contain",display:"block",pointerEvents:"none"}} draggable={false}/>
                    </div>
                  ):(
                    <div style={{width:"100%",height:140,background:"linear-gradient(135deg,#E8DFD0,#D5C9B8)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:40,color:"rgba(139,111,71,0.3)"}}>👤</div>
                  )}

                  <div style={{padding:"9px 11px 10px"}}>
                    <div style={{display:"inline-block",padding:"2px 6px",borderRadius:2,fontSize:8,fontWeight:500,letterSpacing:1,textTransform:"uppercase",color:col[1],background:col[0],marginBottom:5}}>{m.role}</div>
                    <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:400,color:"#2D1B0E",lineHeight:1.2}}>{m.name}</div>
                    {m.year&&<div style={{fontSize:10,color:"rgba(93,58,26,0.4)",marginTop:2}}>✦ {m.year}</div>}
                  </div>

                  {/* ── Botones: Feature 1 — Soltar visible para TODOS ── */}
                  {selected===m.id&&!connectMode&&(
                    <div style={{display:"flex",gap:3,padding:"6px 7px",borderTop:"1px solid rgba(139,111,71,0.12)",background:"rgba(245,240,232,0.5)",flexWrap:"wrap"}}>

                      {/* ✏️ Editar — solo owner */}
                      {mine&&(
                        <button onClick={e=>{e.stopPropagation();setEditingMember(m);}}
                          style={{flex:2,padding:5,background:"rgba(139,111,71,0.08)",border:"1px solid rgba(139,111,71,0.25)",borderRadius:2,fontSize:9,color:"#5D3A1A",cursor:"pointer",fontFamily:"'Jost',sans-serif",textTransform:"uppercase",fontWeight:500}}>
                          ✏️ Editar
                        </button>
                      )}

                      {/* 💌 Soltar — para TODOS */}
                      <button onClick={e=>{e.stopPropagation();openSoltar(m);}}
                        style={{flex:2,padding:5,background:"rgba(255,100,0,0.06)",border:"1px solid rgba(255,100,0,0.2)",borderRadius:2,fontSize:9,color:"#CC4400",cursor:"pointer",fontFamily:"'Jost',sans-serif",textTransform:"uppercase",fontWeight:500}}>
                        💌 Soltar
                      </button>

                      {/* ✕ Eliminar — solo owner */}
                      {mine&&(
                        <button onClick={e=>{e.stopPropagation();removeMember(m.id);}}
                          style={{flex:1,padding:5,background:"transparent",border:"1px solid rgba(180,60,60,0.3)",borderRadius:2,fontSize:9,color:"#B43C3C",cursor:"pointer",fontFamily:"'Jost',sans-serif",textTransform:"uppercase"}}>
                          ✕
                        </button>
                      )}

                      {/* Indicador no-owner */}
                      {!mine&&(
                        <div style={{width:"100%",textAlign:"center",fontSize:9,color:"rgba(93,58,26,0.35)",paddingTop:2}}>
                          🔒 solo lectura
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {members.length===0&&(
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,pointerEvents:"none"}}>
              <div style={{fontSize:52,opacity:0.14}}>🌳</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:300,color:"rgba(93,58,26,0.3)",letterSpacing:1}}>Tu árbol genealógico</div>
              <div style={{fontSize:12,color:"rgba(93,58,26,0.2)"}}>Presiona "+ Agregar" para comenzar</div>
            </div>
          )}
          {connectMode&&(
            <div style={{position:"absolute",bottom:110,left:"50%",transform:"translateX(-50%)",background:"#5D3A1A",color:"#FFF8F0",padding:"9px 18px",borderRadius:2,fontSize:11,letterSpacing:"0.8px",whiteSpace:"nowrap",zIndex:10}}>
              {connectFirst?"① Toca el segundo miembro":"Toca el primer miembro de la conexión"}
            </div>
          )}
          {toast&&(
            <div style={{position:"absolute",top:16,left:"50%",transform:"translateX(-50%)",background:toast.color,color:"#FFF",padding:"10px 20px",borderRadius:2,fontSize:12,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,0.2)",zIndex:50}}>
              {toast.msg}
            </div>
          )}
        </div>

        {/* Barra generación */}
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(245,240,232,0.97)",backdropFilter:"blur(8px)",borderTop:"1px solid rgba(139,111,71,0.15)",padding:"8px 12px 10px",display:"flex",gap:5,overflowX:"auto",zIndex:90,alignItems:"center",WebkitOverflowScrolling:"touch"}}>
          <span style={{fontSize:9,color:"rgba(93,58,26,0.4)",letterSpacing:"0.8px",textTransform:"uppercase",flexShrink:0,marginRight:3}}>Ver:</span>
          {["Todos",...Object.keys(GENERATION_ROLES)].map(g=>(
            <button key={g} onClick={()=>setGenFilter(g)}
              style={{padding:"6px 13px",borderRadius:20,border:`1.5px solid ${genFilter===g?"#8B6F47":"rgba(139,111,71,0.25)"}`,background:genFilter===g?"#8B6F47":"transparent",color:genFilter===g?"#FFF8F0":"rgba(93,58,26,0.6)",fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,transition:"all 0.15s"}}>
              {g}
            </button>
          ))}
        </div>

        {/* D-pad TEMP desactivado */}
        {/* <div style={{position:"fixed",bottom:68,left:12,zIndex:100}}>
          <DPad onPan={handleDPan} onReset={()=>{stopInertia();setZoom(1);setPan({x:0,y:0});}}/>
        </div> */}

        {/* Zoom */}
        <div style={{position:"fixed",bottom:68,right:12,display:"flex",flexDirection:"column",gap:4,zIndex:100}}>
          {[["+",()=>setZoom(z=>Math.min(3,z+0.2))],["−",()=>setZoom(z=>Math.max(0.2,z-0.2))]].map(([l,fn])=>(
            <div key={l} onClick={fn} style={{width:46,height:46,background:"rgba(255,252,245,0.93)",border:"1.5px solid rgba(139,111,71,0.3)",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:22,color:"#8B6F47",boxShadow:"0 2px 8px rgba(93,58,26,0.1)",touchAction:"none"}}>{l}</div>
          ))}
        </div>

        {/* Música */}
        <div onClick={toggleMusic} style={{position:"fixed",bottom:68,left:"50%",transform:"translateX(-50%)",width:46,height:46,background:playing?"#8B6F47":"rgba(255,252,245,0.93)",border:"1.5px solid rgba(139,111,71,0.35)",borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:22,zIndex:100,boxShadow:"0 2px 12px rgba(93,58,26,0.15)",transition:"all 0.2s",touchAction:"none"}}>
          {playing?"🔇":"🎵"}
        </div>

        {/* ── Modals ── */}
        {editingMember&&(
          <EditModal member={editingMember} onSave={saveMemberEdit} onClose={()=>setEditingMember(null)} handlePhotoFile={handlePhotoFile}/>
        )}

        {/* Feature 2: SoltarConAmor con puente de audio */}
        {soltarMember&&(
          <SoltarConAmor
            member={soltarMember}
            myId={MY_ID}
            treeId={treeId}
            onClose={closeSoltar}
            mainAudioRef={audioRef}
            mainPlaying={playing}
          />
        )}

        {/* Feature 3: Nexus */}
        {showNexus&&(
          <NexusView
            currentTreeId={treeId}
            onNavigate={(id)=>{ setShowNexus(false); openTree(id); }}
            onClose={()=>setShowNexus(false)}
          />
        )}

        {/* Compartir */}
        {showShare&&(
          <div onClick={()=>setShowShare(false)} style={{position:"fixed",inset:0,background:"rgba(45,27,14,0.38)",backdropFilter:"blur(5px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
            <div onClick={e=>e.stopPropagation()} style={{background:"#FFF8F0",border:"1.5px solid rgba(139,111,71,0.25)",borderRadius:4,padding:24,width:"100%",maxWidth:420,boxShadow:"0 20px 60px rgba(45,27,14,0.2)"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,color:"#2D1B0E",marginBottom:8}}>Compartir árbol</div>
              <div style={{fontSize:12,color:"rgba(93,58,26,0.5)",marginBottom:14,lineHeight:1.6}}>Comparte este link con tu familia. Cada familiar puede agregar su rama y solo edita sus propias tarjetas.</div>
              <div style={{padding:"10px 12px",background:"rgba(245,240,232,0.8)",border:"1.5px solid rgba(139,111,71,0.2)",borderRadius:2,marginBottom:14,fontSize:11,color:"#5D3A1A",wordBreak:"break-all",fontFamily:"monospace"}}>{shareUrl}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                <button onClick={copyLink} style={{padding:"12px 6px",background:copied?"rgba(45,122,79,0.1)":"rgba(245,240,232,0.8)",border:`1.5px solid ${copied?"rgba(45,122,79,0.4)":"rgba(139,111,71,0.3)"}`,borderRadius:3,cursor:"pointer",fontFamily:"'Jost',sans-serif",fontSize:11,color:copied?"#2D7A4F":"#5D3A1A",textAlign:"center"}}>{copied?"✓ Copiado":"📋 Copiar"}</button>
                <button onClick={shareWhatsApp} style={{padding:"12px 6px",background:"rgba(37,211,102,0.08)",border:"1.5px solid rgba(37,211,102,0.3)",borderRadius:3,cursor:"pointer",fontFamily:"'Jost',sans-serif",fontSize:11,color:"#1a8a47",textAlign:"center"}}>💬 WhatsApp</button>
                <button onClick={shareEmail} style={{padding:"12px 6px",background:"rgba(66,133,244,0.08)",border:"1.5px solid rgba(66,133,244,0.3)",borderRadius:3,cursor:"pointer",fontFamily:"'Jost',sans-serif",fontSize:11,color:"#2a5fc4",textAlign:"center"}}>✉️ Email</button>
              </div>
              <Btn onClick={()=>setShowShare(false)} style={{width:"100%",padding:11}}>Cerrar</Btn>
            </div>
          </div>
        )}

        {/* Agregar */}
        {showAddModal&&(
          <div onClick={()=>setShowAddModal(false)} style={{position:"fixed",inset:0,background:"rgba(45,27,14,0.38)",backdropFilter:"blur(5px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
            <div onClick={e=>e.stopPropagation()} style={{background:"#FFF8F0",border:"1.5px solid rgba(139,111,71,0.25)",borderRadius:4,padding:24,width:"100%",maxWidth:360,boxShadow:"0 20px 60px rgba(45,27,14,0.2)",maxHeight:"92vh",overflowY:"auto"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,color:"#2D1B0E",marginBottom:16}}>Agregar al árbol</div>
              <div style={{display:"flex",gap:6,marginBottom:18}}>
                <button onClick={()=>setForm(f=>({...f,isPortal:false}))}
                  style={{flex:1,padding:"9px 6px",border:`1.5px solid ${!form.isPortal?"#8B6F47":"rgba(139,111,71,0.25)"}`,borderRadius:2,background:!form.isPortal?"#8B6F47":"transparent",color:!form.isPortal?"#FFF8F0":"#8B6F47",fontFamily:"'Jost',sans-serif",fontSize:11,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.5px"}}>
                  👤 Persona
                </button>
                <button onClick={()=>setForm(f=>({...f,isPortal:true}))}
                  style={{flex:1,padding:"9px 6px",border:`1.5px solid ${form.isPortal?"#D4A017":"rgba(212,160,23,0.3)"}`,borderRadius:2,background:form.isPortal?"#D4A017":"transparent",color:form.isPortal?"#FFF":"#8B6A00",fontFamily:"'Jost',sans-serif",fontSize:11,cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.5px"}}>
                  🌳 Portal árbol
                </button>
              </div>
              {!form.isPortal?(
                <>
                  {[{label:"Nombre completo",el:<input autoFocus placeholder="Ej: María Elena Torres" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addMember()} style={iStyle}/>},
                    {label:"Relación",el:<select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={iStyle}>{ROLES.map(r=><option key={r}>{r}</option>)}</select>},
                    {label:"Año de nacimiento",el:<input placeholder="Ej: 1945" value={form.year} onChange={e=>setForm(f=>({...f,year:e.target.value}))} style={iStyle}/>},
                  ].map(({label,el})=>(
                    <div key={label} style={{marginBottom:12}}>
                      <label style={{display:"block",fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6F47",fontWeight:500,marginBottom:5}}>{label}</label>
                      {el}
                    </div>
                  ))}
                  <div style={{marginBottom:12}}>
                    <label style={{display:"block",fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6F47",fontWeight:500,marginBottom:5}}>Foto (opcional)</label>
                    <div onClick={()=>document.getElementById("mpi").click()} style={{width:"100%",height:90,border:"1.5px dashed rgba(139,111,71,0.35)",borderRadius:2,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:12,color:"rgba(139,111,71,0.55)",overflow:"hidden",position:"relative",background:"rgba(245,240,232,0.5)"}}>
                      {form.photo?<img src={form.photo} style={{maxWidth:"100%",maxHeight:"90px",objectFit:"contain"}}/>:"📷 Subir foto"}
                    </div>
                    <input id="mpi" type="file" accept="image/*" style={{display:"none"}} onChange={e=>{handlePhotoFile(e.target.files[0],photo=>setForm(f=>({...f,photo})));e.target.value="";}}/>
                  </div>
                </>
              ):(
                <>
                  <div style={{background:"rgba(255,248,200,0.5)",border:"1.5px solid rgba(212,160,23,0.3)",borderRadius:3,padding:"12px 14px",marginBottom:16,fontSize:11,color:"#6B5000",lineHeight:1.6}}>
                    Crea una tarjeta dorada que al tocarla abrirá el árbol de otro familiar.
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{display:"block",fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6A00",fontWeight:500,marginBottom:5}}>Nombre del portal</label>
                    <input autoFocus placeholder="Ej: Familia Angulo Díaz" value={form.linkedTreeName} onChange={e=>setForm(f=>({...f,linkedTreeName:e.target.value}))} style={{...iStyle,borderColor:"rgba(212,160,23,0.4)"}}/>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{display:"block",fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6A00",fontWeight:500,marginBottom:5}}>Link del árbol a vincular</label>
                    <input placeholder="Pega aquí el link del otro árbol" value={form.linkedTreeUrl} onChange={e=>setForm(f=>({...f,linkedTreeUrl:e.target.value}))} style={{...iStyle,borderColor:"rgba(212,160,23,0.4)"}}/>
                    <div style={{fontSize:10,color:"rgba(93,58,26,0.4)",marginTop:4}}>Pide el link con el botón 🔗 Compartir del otro árbol</div>
                  </div>
                </>
              )}
              <div style={{display:"flex",gap:8,marginTop:18}}>
                <Btn onClick={()=>setShowAddModal(false)} style={{flex:1,padding:11}}>Cancelar</Btn>
                <Btn onClick={addMember} primary style={{flex:1,padding:11}}>Agregar ✦</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

const iStyle={width:"100%",padding:"9px 11px",border:"1.5px solid rgba(139,111,71,0.25)",borderRadius:2,background:"rgba(245,240,232,0.5)",fontFamily:"'Jost',sans-serif",fontSize:13,color:"#2D1B0E",outline:"none"};

function Btn({children,onClick,primary,color,style={}}){
  return(
    <button onClick={onClick} style={{padding:"7px 14px",border:"1.5px solid",borderColor:color||(primary?"#5D3A1A":"rgba(139,111,71,0.35)"),borderRadius:2,background:color||(primary?"#5D3A1A":"transparent"),color:primary?"#FFF8F0":"#5D3A1A",fontFamily:"'Jost',sans-serif",fontSize:11,fontWeight:500,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",...style}}>
      {children}
    </button>
  );
}
