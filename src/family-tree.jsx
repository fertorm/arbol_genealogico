import { useState, useRef, useCallback, useEffect } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500&display=swap');`;

const ROLES = ["Bisabuelo/a","Abuelo/a","Padre/Madre","Tío/Tía","Yo","Hermano/a","Pareja","Hijo/a","Nieto/a","Primo/a","Otro"];
const ROLE_COLORS = {
  "Bisabuelo/a":"#8B6F47","Abuelo/a":"#7B8B6F","Padre/Madre":"#6F7B8B","Tío/Tía":"#8B7B6F",
  "Yo":"#5B7B6F","Hermano/a":"#6B7B8B","Pareja":"#8B6F7B","Hijo/a":"#7B6F8B",
  "Nieto/a":"#6F8B7B","Primo/a":"#8B8B6F","Otro":"#7B7B7B",
};
const CONN_STYLES = {
  "padre-hijo":{ stroke:"#8B6F47", dash:"none" },
  "pareja":{ stroke:"#8B6F7B", dash:"6,3" },
  "hermano":{ stroke:"#6F7B8B", dash:"2,4" },
  "abuelo-nieto":{ stroke:"#7B8B6F", dash:"8,3" },
};
const CONN_LABELS = { "padre-hijo":"hijo/a de","pareja":"pareja de","hermano":"hermano/a de","abuelo-nieto":"nieto/a de" };

let uid = 1;

function readFile(file) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.readAsDataURL(file);
  });
}

function PhotoPicker({ value, onChange, height = 110 }) {
  const ref = useRef();
  return (
    <div
      style={{
        width:"100%", height,
        border:"1.5px dashed rgba(139,111,71,0.4)",
        borderRadius:2, overflow:"hidden", cursor:"pointer",
        display:"flex", alignItems:"center", justifyContent:"center",
        background:"rgba(245,240,232,0.4)", position:"relative",
      }}
      onClick={() => ref.current.click()}
    >
      {value
        ? <img src={value} alt="" style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}} />
        : <span style={{fontSize:12,color:"rgba(139,111,71,0.55)",letterSpacing:"0.5px",fontFamily:"Jost,sans-serif"}}>📷 Subir foto</span>
      }
      <input ref={ref} type="file" accept="image/*" style={{display:"none"}}
        onChange={async (e) => {
          const file = e.target.files[0];
          if (file) { const d = await readFile(file); onChange(d); }
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function FamilyTree() {
  const [members, setMembers]         = useState([]);
  const [groups,  setGroups]          = useState([]);
  const [connections, setConnections] = useState([]);
  const [modal, setModal]             = useState(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFirst, setConnectFirst] = useState(null);
  const [connType, setConnType]       = useState("padre-hijo");
  const [selected, setSelected]       = useState(null);
  const [dragging, setDragging]       = useState(null);
  const [dragOff,  setDragOff]        = useState({x:0,y:0});
  const [zoom, setZoom]               = useState(1);
  const [pan,  setPan]                = useState({x:0,y:0});
  const [isPanning, setIsPanning]     = useState(false);
  const [panStart,  setPanStart]      = useState({x:0,y:0});
  const [pForm, setPForm] = useState({ name:"", role:"Yo", photo:null, birthYear:"" });
  const [gForm, setGForm] = useState({ name:"", desc:"", photo:null });

  const canvasRef = useRef();

  const getNode = (id) => {
    return members.find(m=>m.id===id) || groups.find(g=>g.id===id) || null;
  };
  const isGroup = (id) => !!groups.find(g=>g.id===id);

  const addPerson = () => {
    if (!pForm.name.trim()) return;
    const id = uid++;
    setMembers(m=>[...m,{ id, name:pForm.name.trim(), role:pForm.role, photo:pForm.photo, birthYear:pForm.birthYear, x:100+Math.random()*400, y:100+Math.random()*250 }]);
    setPForm({name:"",role:"Yo",photo:null,birthYear:""});
    setModal(null);
  };

  const addGroup = () => {
    if (!gForm.name.trim()) return;
    const id = uid++;
    setGroups(g=>[...g,{ id, name:gForm.name.trim(), desc:gForm.desc, photo:gForm.photo, x:100+Math.random()*400, y:100+Math.random()*250 }]);
    setGForm({name:"",desc:"",photo:null});
    setModal(null);
  };

  const removeNode = (id) => {
    setMembers(m=>m.filter(x=>x.id!==id));
    setGroups(g=>g.filter(x=>x.id!==id));
    setConnections(c=>c.filter(x=>x.from!==id&&x.to!==id));
    setSelected(null);
  };

  const updatePhoto = (id, photo) => {
    setMembers(m=>m.map(x=>x.id===id?{...x,photo}:x));
    setGroups(g=>g.map(x=>x.id===id?{...x,photo}:x));
  };

  const onNodeMouseDown = useCallback((e, id) => {
    if (connectMode) {
      e.stopPropagation();
      if (!connectFirst) { setConnectFirst(id); }
      else if (connectFirst !== id) {
        setConnections(c=>[...c,{from:connectFirst,to:id,type:connType}]);
        setConnectFirst(null); setConnectMode(false);
      }
      return;
    }
    e.stopPropagation();
    const node = getNode(id);
    if (!node) return;
    setDragging(id);
    setDragOff({ x: e.clientX/zoom - node.x, y: e.clientY/zoom - node.y });
    setSelected(id);
  }, [connectMode, connectFirst, members, groups, zoom, connType]);

  const onMouseMove = useCallback((e) => {
    if (dragging !== null) {
      const nx = e.clientX/zoom - dragOff.x;
      const ny = e.clientY/zoom - dragOff.y;
      setMembers(m=>m.map(x=>x.id===dragging?{...x,x:nx,y:ny}:x));
      setGroups(g=>g.map(x=>x.id===dragging?{...x,x:nx,y:ny}:x));
    } else if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [dragging, dragOff, zoom, isPanning, panStart]);

  const onMouseUp = useCallback(() => { setDragging(null); setIsPanning(false); }, []);

  const onCanvasDown = (e) => {
    const tag = e.target.tagName.toLowerCase();
    if (tag === "div" || tag === "svg" || e.target === canvasRef.current) {
      setSelected(null);
      if (!connectMode) { setIsPanning(true); setPanStart({x:e.clientX-pan.x,y:e.clientY-pan.y}); }
    }
  };

  useEffect(()=>{
    window.addEventListener("mousemove",onMouseMove);
    window.addEventListener("mouseup",onMouseUp);
    return()=>{ window.removeEventListener("mousemove",onMouseMove); window.removeEventListener("mouseup",onMouseUp); };
  },[onMouseMove,onMouseUp]);

  const totalNodes = members.length + groups.length;

  const CSS = `
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#F5F0E8;}
    .root{width:100vw;height:100vh;background:radial-gradient(ellipse at 60% 20%,#EDE4D0,#F5F0E8 60%,#E8E0D0);font-family:'Jost',sans-serif;overflow:hidden;position:relative;user-select:none;}
    .hdr{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;padding:13px 22px;background:rgba(245,240,232,0.9);backdrop-filter:blur(8px);border-bottom:1px solid rgba(139,111,71,0.15);z-index:100;}
    .title{font-family:'Cormorant Garamond',serif;font-size:23px;font-weight:300;color:#3D2B1F;letter-spacing:1px;}
    .title em{font-style:italic;color:#8B6F47;}
    .sub{font-size:10px;color:rgba(93,58,26,0.4);letter-spacing:.5px;margin-top:1px;}
    .tb{display:flex;gap:7px;align-items:center;flex-wrap:wrap;}
    .btn{padding:7px 15px;border:1.5px solid rgba(139,111,71,0.4);border-radius:2px;background:transparent;color:#5D3A1A;font-family:'Jost',sans-serif;font-size:11px;font-weight:500;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:all .2s;}
    .btn:hover{background:rgba(139,111,71,0.1);border-color:#8B6F47;}
    .btn.act{background:#8B6F47;color:#FFF8F0;border-color:#8B6F47;}
    .btn.pri{background:#5D3A1A;color:#FFF8F0;border-color:#5D3A1A;}
    .btn.pri:hover{background:#7B4F2A;}
    .btn.grp{background:#6B4E8B;color:#FFF8F0;border-color:#6B4E8B;}
    .btn.grp:hover{background:#5B3E7B;}
    .btn:disabled{opacity:.4;cursor:not-allowed;}
    .ctype{display:flex;gap:4px;}
    .chip{padding:4px 9px;border:1.5px solid rgba(139,111,71,0.25);border-radius:1px;font-size:9px;letter-spacing:.8px;text-transform:uppercase;cursor:pointer;color:#8B6F47;background:transparent;font-family:'Jost',sans-serif;transition:all .15s;}
    .chip.on{background:#8B6F47;color:#FFF8F0;border-color:#8B6F47;}
    .cvs{position:absolute;inset:62px 0 0 0;cursor:grab;}
    .cvs:active{cursor:grabbing;}
    .inner{position:absolute;inset:0;}
    .card{position:absolute;width:160px;background:rgba(255,252,245,0.93);border:1.5px solid rgba(139,111,71,0.2);border-radius:3px;box-shadow:0 4px 20px rgba(93,58,26,0.08);cursor:pointer;transition:box-shadow .2s,border-color .2s;overflow:hidden;}
    .gcard{width:200px!important;border-color:rgba(107,78,139,0.25)!important;}
    .card:hover{box-shadow:0 8px 30px rgba(93,58,26,0.13);border-color:rgba(139,111,71,0.45);}
    .card.sel{border-color:#8B6F47!important;box-shadow:0 0 0 3px rgba(139,111,71,0.15),0 8px 28px rgba(93,58,26,0.13)!important;}
    .gcard.sel{border-color:#6B4E8B!important;box-shadow:0 0 0 3px rgba(107,78,139,0.15),0 8px 28px rgba(93,58,26,0.1)!important;}
    .card.ct{border-color:#5B7B6F!important;cursor:crosshair;}
    .cph{width:100%;height:110px;object-fit:cover;display:block;}
    .cpph{width:100%;height:110px;background:linear-gradient(135deg,#E8DFD0,#D5C9B8);display:flex;align-items:center;justify-content:center;font-size:34px;color:rgba(139,111,71,0.35);}
    .cbody{padding:9px 11px 11px;}
    .rtag{display:inline-block;padding:2px 7px;border-radius:1px;font-size:9px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#FFF8F0;margin-bottom:5px;}
    .cname{font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:400;color:#2D1B0E;line-height:1.2;}
    .cyear{font-size:10px;color:rgba(93,58,26,0.4);margin-top:2px;}
    .cact{display:flex;gap:3px;padding:5px 7px;border-top:1px solid rgba(139,111,71,0.12);background:rgba(245,240,232,0.5);}
    .abtn{flex:1;padding:5px 3px;background:transparent;border:1px solid rgba(139,111,71,0.2);border-radius:2px;font-size:10px;color:#8B6F47;cursor:pointer;font-family:'Jost',sans-serif;transition:all .15s;}
    .abtn:hover{background:rgba(139,111,71,0.1);}
    .abtn.del:hover{background:rgba(180,60,60,0.1);color:#B43C3C;border-color:rgba(180,60,60,.3);}
    .ov{position:fixed;inset:0;background:rgba(45,27,14,0.35);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:center;justify-content:center;}
    .modal{background:#FFF8F0;border:1.5px solid rgba(139,111,71,0.25);border-radius:4px;padding:26px;width:360px;box-shadow:0 20px 60px rgba(45,27,14,0.2);max-height:90vh;overflow-y:auto;}
    .mtitle{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:#2D1B0E;margin-bottom:18px;letter-spacing:.5px;}
    .fld{margin-bottom:13px;}
    .fld label{display:block;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#8B6F47;font-weight:500;margin-bottom:5px;}
    .fld input,.fld select{width:100%;padding:9px 11px;border:1.5px solid rgba(139,111,71,0.25);border-radius:2px;background:rgba(245,240,232,0.5);font-family:'Jost',sans-serif;font-size:13px;color:#2D1B0E;outline:none;transition:border-color .2s;}
    .fld input:focus,.fld select:focus{border-color:#8B6F47;}
    .mft{display:flex;gap:7px;margin-top:18px;}
    .mft .btn{flex:1;padding:11px;font-size:10px;}
    .hint{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#5D3A1A;color:#FFF8F0;padding:8px 18px;border-radius:2px;font-size:11px;letter-spacing:.8px;z-index:300;box-shadow:0 4px 18px rgba(45,27,14,0.22);}
    .zctr{position:fixed;bottom:18px;right:18px;display:flex;flex-direction:column;gap:4px;z-index:100;}
    .zbtn{width:33px;height:33px;background:rgba(255,252,245,0.9);border:1.5px solid rgba(139,111,71,0.3);border-radius:2px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;color:#8B6F47;transition:all .15s;}
    .zbtn:hover{background:#8B6F47;color:#FFF8F0;}
    .empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;pointer-events:none;}
    .eic{font-size:46px;opacity:.14;}
    .et{font-family:'Cormorant Garamond',serif;font-size:20px;font-weight:300;color:rgba(93,58,26,.28);letter-spacing:1px;}
    .es{font-size:11px;color:rgba(93,58,26,.2);letter-spacing:.5px;}
    .tsvg{position:absolute;inset:0;pointer-events:none;}
    .clbl{font-size:9px;fill:rgba(93,58,26,.35);font-family:'Jost',sans-serif;letter-spacing:.5px;}
  `;

  return (
    <>
      <style>{FONTS}</style>
      <style>{CSS}</style>

      <div className="root">
        <div className="hdr">
          <div>
            <div className="title">Árbol <em>Genealógico</em></div>
            <div className="sub">{members.length} personas · {groups.length} grupos · {connections.length} vínculos</div>
          </div>
          <div className="tb">
            {connectMode ? (
              <>
                <div className="ctype">
                  {[["padre-hijo","↓ Hijo"],["pareja","♥ Pareja"],["hermano","≡ Hermano"],["abuelo-nieto","↓↓ Nieto"]].map(([v,l])=>(
                    <button key={v} className={`chip ${connType===v?"on":""}`} onClick={()=>setConnType(v)}>{l}</button>
                  ))}
                </div>
                <button className="btn act" onClick={()=>{setConnectMode(false);setConnectFirst(null);}}>✕ Cancelar</button>
              </>
            ) : (
              <>
                <button className="btn" onClick={()=>{setConnectMode(true);setConnectFirst(null);}}>⟵ Conectar</button>
                <button className="btn grp" onClick={()=>setModal("group")}>👨‍👩‍👧 Familia</button>
                <button className="btn pri" onClick={()=>setModal("person")}>+ Persona</button>
              </>
            )}
          </div>
        </div>

        <div className="cvs" ref={canvasRef} onMouseDown={onCanvasDown}
          onWheel={(e)=>{e.preventDefault();setZoom(z=>Math.min(2,Math.max(0.3,z-e.deltaY*.001)));}}>
          <div className="inner" style={{transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,transformOrigin:"0 0"}}>

            <svg className="tsvg" style={{width:"9999px",height:"9999px"}}>
              <defs>
                <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="rgba(93,58,26,0.3)"/>
                </marker>
              </defs>
              {connections.map((c,i)=>{
                const f=getNode(c.from), t=getNode(c.to);
                if(!f||!t) return null;
                const fw=isGroup(f.id)?200:160, tw=isGroup(t.id)?200:160;
                const x1=f.x+fw/2, y1=f.y+100, x2=t.x+tw/2, y2=t.y+100;
                const mx=(x1+x2)/2, my=(y1+y2)/2;
                const s=CONN_STYLES[c.type]||CONN_STYLES["padre-hijo"];
                const curved=c.type==="padre-hijo"||c.type==="abuelo-nieto";
                const cy1=curved?y1+(y2-y1)*0.4:y1, cy2=curved?y2-(y2-y1)*0.4:y2;
                return (
                  <g key={i}>
                    <path d={`M ${x1} ${y1} C ${x1} ${cy1}, ${x2} ${cy2}, ${x2} ${y2}`} fill="none" stroke={s.stroke} strokeWidth="1.5" strokeDasharray={s.dash} strokeOpacity=".5" markerEnd={curved?"url(#arr)":""}/>
                    <text x={mx} y={my-6} textAnchor="middle" className="clbl">{CONN_LABELS[c.type]}</text>
                    <circle cx={mx} cy={my} r="7" fill="rgba(245,240,232,0.9)" stroke={s.stroke} strokeOpacity=".4" strokeWidth="1" style={{cursor:"pointer",pointerEvents:"all"}} onClick={(e)=>{e.stopPropagation();setConnections(x=>x.filter((_,j)=>j!==i));}}/>
                    <text x={mx} y={my+3.5} textAnchor="middle" fill={s.stroke} fontSize="9" fontFamily="Jost" style={{pointerEvents:"none"}}>✕</text>
                  </g>
                );
              })}
            </svg>

            {/* Persons */}
            {members.map(m=>(
              <div key={m.id} className={`card ${selected===m.id?"sel":""} ${connectMode?"ct":""}`}
                style={{left:m.x,top:m.y}} onMouseDown={(e)=>onNodeMouseDown(e,m.id)}>
                {m.photo
                  ? <img src={m.photo} alt={m.name} className="cph" draggable={false}/>
                  : <div className="cpph">👤</div>}
                <div className="cbody">
                  <span className="rtag" style={{background:ROLE_COLORS[m.role]||"#777"}}>{m.role}</span>
                  <div className="cname">{m.name}</div>
                  {m.birthYear && <div className="cyear">✦ {m.birthYear}</div>}
                </div>
                {selected===m.id && !connectMode && (
                  <div className="cact">
                    <button className="abtn" onClick={(e)=>{e.stopPropagation();document.getElementById(`p${m.id}`).click();}}>📷 Foto</button>
                    <button className="abtn del" onClick={(e)=>{e.stopPropagation();removeNode(m.id);}}>✕</button>
                    <input id={`p${m.id}`} type="file" accept="image/*" style={{display:"none"}}
                      onChange={async(e)=>{const f=e.target.files[0];if(f){const d=await readFile(f);updatePhoto(m.id,d);}e.target.value="";}}/>
                  </div>
                )}
              </div>
            ))}

            {/* Groups */}
            {groups.map(g=>(
              <div key={g.id} className={`card gcard ${selected===g.id?"sel":""} ${connectMode?"ct":""}`}
                style={{left:g.x,top:g.y}} onMouseDown={(e)=>onNodeMouseDown(e,g.id)}>
                {g.photo
                  ? <img src={g.photo} alt={g.name} className="cph" style={{height:130}} draggable={false}/>
                  : <div className="cpph" style={{height:130,fontSize:42}}>👨‍👩‍👧‍👦</div>}
                <div className="cbody" style={{textAlign:"center"}}>
                  <span className="rtag" style={{background:"#6B4E8B"}}>Familia</span>
                  <div className="cname" style={{fontSize:17}}>{g.name}</div>
                  {g.desc && <div className="cyear">{g.desc}</div>}
                </div>
                {selected===g.id && !connectMode && (
                  <div className="cact">
                    <button className="abtn" onClick={(e)=>{e.stopPropagation();document.getElementById(`g${g.id}`).click();}}>📷 Foto grupal</button>
                    <button className="abtn del" onClick={(e)=>{e.stopPropagation();removeNode(g.id);}}>✕</button>
                    <input id={`g${g.id}`} type="file" accept="image/*" style={{display:"none"}}
                      onChange={async(e)=>{const f=e.target.files[0];if(f){const d=await readFile(f);updatePhoto(g.id,d);}e.target.value="";}}/>
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalNodes===0 && (
            <div className="empty">
              <div className="eic">🌳</div>
              <div className="et">Tu árbol genealógico</div>
              <div className="es">Agrega personas o grupos familiares para comenzar</div>
            </div>
          )}
        </div>

        <div className="zctr">
          <div className="zbtn" onClick={()=>setZoom(z=>Math.min(2,z+0.1))}>+</div>
          <div className="zbtn" onClick={()=>{setZoom(1);setPan({x:0,y:0});}}>⊙</div>
          <div className="zbtn" onClick={()=>setZoom(z=>Math.max(0.3,z-0.1))}>−</div>
        </div>

        {connectMode && (
          <div className="hint">
            {connectFirst?"✓ Ahora haz clic en el segundo miembro":"Haz clic en el primer miembro de la conexión"}
          </div>
        )}

        {/* Modal: Persona */}
        {modal==="person" && (
          <div className="ov" onClick={()=>setModal(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div className="mtitle">Agregar Persona</div>
              <div className="fld"><label>Nombre completo</label>
                <input type="text" placeholder="Ej: María Elena Torres" value={pForm.name}
                  onChange={e=>setPForm(f=>({...f,name:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&addPerson()} autoFocus/>
              </div>
              <div className="fld"><label>Relación</label>
                <select value={pForm.role} onChange={e=>setPForm(f=>({...f,role:e.target.value}))}>
                  {ROLES.map(r=><option key={r}>{r}</option>)}
                </select>
              </div>
              <div className="fld"><label>Año de nacimiento</label>
                <input type="text" placeholder="Ej: 1945" value={pForm.birthYear}
                  onChange={e=>setPForm(f=>({...f,birthYear:e.target.value}))}/>
              </div>
              <div className="fld"><label>Foto de perfil</label>
                <PhotoPicker value={pForm.photo} onChange={photo=>setPForm(f=>({...f,photo}))} height={100}/>
              </div>
              <div className="mft">
                <button className="btn" onClick={()=>setModal(null)}>Cancelar</button>
                <button className="btn pri" onClick={addPerson} disabled={!pForm.name.trim()}>Agregar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Grupo */}
        {modal==="group" && (
          <div className="ov" onClick={()=>setModal(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div className="mtitle">Agregar Grupo Familiar</div>
              <div className="fld"><label>Nombre del grupo</label>
                <input type="text" placeholder="Ej: Familia Torrico De La Reza" value={gForm.name}
                  onChange={e=>setGForm(f=>({...f,name:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&addGroup()} autoFocus/>
              </div>
              <div className="fld"><label>Descripción (opcional)</label>
                <input type="text" placeholder="Ej: Rama materna · Santa Cruz, Bolivia" value={gForm.desc}
                  onChange={e=>setGForm(f=>({...f,desc:e.target.value}))}/>
              </div>
              <div className="fld"><label>Foto grupal familiar</label>
                <PhotoPicker value={gForm.photo} onChange={photo=>setGForm(f=>({...f,photo}))} height={130}/>
              </div>
              <div className="mft">
                <button className="btn" onClick={()=>setModal(null)}>Cancelar</button>
                <button className="btn grp" onClick={addGroup} disabled={!gForm.name.trim()}>Agregar Grupo</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
