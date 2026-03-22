import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ── Cifrado XOR + base64 ──────────────────────────────────────────────────────
function encrypt(text, key) {
  let result = "";
  for (let i = 0; i < text.length; i++)
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return btoa(unescape(encodeURIComponent(result)));
}
function decrypt(encoded, key) {
  try {
    const text = decodeURIComponent(escape(atob(encoded)));
    let result = "";
    for (let i = 0; i < text.length; i++)
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    return result;
  } catch { return ""; }
}

const FRASES = [
  "Lo que no podemos decir en vida, el fuego lo lleva al infinito.",
  "Soltar no es olvidar. Es amar desde la libertad.",
  "Las cenizas se van, el amor permanece.",
  "Hoy te libero, y al hacerlo, me libero yo también.",
  "El fuego transforma, nunca destruye lo que fue real.",
  "Que este amor encuentre su camino, más allá del tiempo.",
  "Al viento van tus palabras, cargadas de verdad y ternura.",
];

// ── Fade de volumen ───────────────────────────────────────────────────────────
function fadeVolume(audioEl, from, to, durationMs, onDone) {
  if (!audioEl) { onDone && onDone(); return; }
  const steps   = 20;
  const stepMs  = durationMs / steps;
  const stepVol = (to - from) / steps;
  let current   = from;
  let count      = 0;
  const id = setInterval(() => {
    count++;
    current += stepVol;
    audioEl.volume = Math.min(1, Math.max(0, current));
    if (count >= steps) {
      clearInterval(id);
      audioEl.volume = to;
      onDone && onDone();
    }
  }, stepMs);
  return id;
}

export default function SoltarConAmor({ member, myId, treeId, onClose, mainAudioRef, mainPlaying }) {
  const [phase, setPhase]           = useState("loading");
  const [content, setContent]       = useState("");
  const [savedLetter, setSavedLetter] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [frase]                     = useState(() => FRASES[Math.floor(Math.random() * FRASES.length)]);
  const textareaRef                 = useRef(null);
  const soltarAudioRef              = useRef(null);
  const fadeTimerRef                = useRef(null);

  // ── Al abrir: fade out música principal, fade in música soltar ───────────────
  useEffect(() => {
    // Fade out música principal
    if (mainAudioRef?.current && mainPlaying) {
      fadeVolume(mainAudioRef.current, mainAudioRef.current.volume, 0.04, 1200);
    }

    // Iniciar música soltar con amor
    const audio = soltarAudioRef.current;
    if (audio) {
      audio.loop   = true;
      audio.volume = 0;
      audio.play().catch(() => {});
      fadeVolume(audio, 0, 0.35, 1500);
    }

    return () => {
      // Al cerrar: restaurar música principal
      if (mainAudioRef?.current && mainPlaying) {
        fadeVolume(mainAudioRef.current, mainAudioRef.current.volume, 0.3, 1000);
      }
      // Fade out música soltar
      if (soltarAudioRef.current) {
        fadeVolume(soltarAudioRef.current, soltarAudioRef.current.volume, 0, 800, () => {
          if (soltarAudioRef.current) soltarAudioRef.current.pause();
        });
      }
      clearInterval(fadeTimerRef.current);
    };
  }, []);

  // ── Cargar borrador ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadDraft() {
      const { data } = await supabase
        .from("letters")
        .select("*")
        .eq("member_id", member.id)
        .eq("creator_id", myId)
        .single();
      if (data) {
        setSavedLetter(data);
        setContent(decrypt(data.content_encrypted, myId));
      }
      setPhase("write");
    }
    loadDraft();
  }, [member.id, myId]);

  useEffect(() => {
    if (phase === "write" && textareaRef.current)
      setTimeout(() => textareaRef.current?.focus(), 300);
  }, [phase]);

  // ── Guardar borrador ──────────────────────────────────────────────────────────
  const saveDraft = async () => {
    if (!content.trim()) return;
    setSaving(true);
    const encrypted = encrypt(content, myId);
    if (savedLetter) {
      await supabase.from("letters").update({ content_encrypted: encrypted }).eq("id", savedLetter.id);
    } else {
      const { data } = await supabase.from("letters").insert({
        tree_id: treeId, member_id: member.id,
        creator_id: myId, content_encrypted: encrypted,
        recipient_name: member.name,
      }).select().single();
      if (data) setSavedLetter(data);
    }
    setSaving(false);
  };

  // ── Quemar ────────────────────────────────────────────────────────────────────
  const burnLetter = async () => {
    setPhase("burn");
    if (content.trim()) {
      const encrypted = encrypt(content, myId);
      if (savedLetter) {
        await supabase.from("letters").update({ content_encrypted: encrypted }).eq("id", savedLetter.id);
      } else {
        await supabase.from("letters").insert({
          tree_id: treeId, member_id: member.id,
          creator_id: myId, content_encrypted: encrypted,
          recipient_name: member.name,
        });
      }
    }
    // Aumentar volumen música al quemar
    if (soltarAudioRef.current) fadeVolume(soltarAudioRef.current, soltarAudioRef.current.volume, 0.5, 600);
    setTimeout(() => setPhase("ash"), 2800);
    setTimeout(async () => {
      if (savedLetter) await supabase.from("letters").delete().eq("id", savedLetter.id);
      else await supabase.from("letters").delete().eq("member_id", member.id).eq("creator_id", myId);
      setPhase("peace");
      // Bajar música en la fase de paz
      if (soltarAudioRef.current) fadeVolume(soltarAudioRef.current, soltarAudioRef.current.volume, 0.2, 1000);
    }, 4200);
  };

  const deleteDraft = async () => {
    if (savedLetter) {
      await supabase.from("letters").delete().eq("id", savedLetter.id);
      setSavedLetter(null);
    }
    setContent("");
  };

  return (
    <>
      <style>{`
        @keyframes flicker1{0%,100%{transform:scaleY(1) scaleX(1) rotate(-1deg);opacity:0.9;}25%{transform:scaleY(1.15) scaleX(0.92) rotate(1deg);opacity:1;}50%{transform:scaleY(0.95) scaleX(1.05) rotate(-0.5deg);opacity:0.85;}75%{transform:scaleY(1.1) scaleX(0.95) rotate(1.5deg);opacity:0.95;}}
        @keyframes flicker2{0%,100%{transform:scaleY(0.9) scaleX(1.05) rotate(1deg);opacity:0.8;}33%{transform:scaleY(1.2) scaleX(0.9) rotate(-1.5deg);opacity:1;}66%{transform:scaleY(0.85) scaleX(1.08) rotate(0.5deg);opacity:0.75;}}
        @keyframes flicker3{0%,100%{transform:scaleY(1.05) scaleX(0.95);opacity:0.6;}40%{transform:scaleY(0.8) scaleX(1.1) rotate(2deg);opacity:0.9;}70%{transform:scaleY(1.15) scaleX(0.88) rotate(-1deg);opacity:0.5;}}
        @keyframes burnPage{0%{opacity:1;transform:scaleY(1) translateY(0);filter:brightness(1);}20%{filter:brightness(1.3) sepia(0.3);}40%{filter:brightness(1.6) sepia(0.7) saturate(1.5);}60%{opacity:0.7;transform:scaleY(0.85) translateY(10px);filter:brightness(2) sepia(1) saturate(2);}80%{opacity:0.3;transform:scaleY(0.5) translateY(30px);filter:brightness(2.5) sepia(1);}100%{opacity:0;transform:scaleY(0) translateY(60px);}}
        @keyframes ashFall{0%{opacity:1;transform:translateY(0) rotate(0deg);}100%{opacity:0;transform:translateY(80px) rotate(45deg);}}
        @keyframes fadeInPeace{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        @keyframes shimmer{0%,100%{opacity:0.6;}50%{opacity:1;}}
        @keyframes rise{0%{transform:translateY(0) scaleX(1);opacity:0.5;}100%{transform:translateY(-60px) scaleX(0.2);opacity:0;}}
        .flame{position:absolute;bottom:0;border-radius:50% 50% 20% 20% / 60% 60% 30% 30%;transform-origin:bottom center;}
        .f1{width:60px;height:100px;background:linear-gradient(to top,#FF4500,#FF8C00,#FFD700);animation:flicker1 0.4s ease-in-out infinite;left:50%;margin-left:-30px;}
        .f2{width:45px;height:80px;background:linear-gradient(to top,#FF6B00,#FFA500,#FFEC8B);animation:flicker2 0.3s ease-in-out infinite 0.1s;left:50%;margin-left:-22px;}
        .f3{width:30px;height:55px;background:linear-gradient(to top,#FF8C00,#FFD700,#FFFACD);animation:flicker3 0.35s ease-in-out infinite 0.05s;left:50%;margin-left:-15px;}
        .f4{width:20px;height:35px;background:linear-gradient(to top,#FFA500,#FFE082,#FFFFF0);animation:flicker1 0.25s ease-in-out infinite 0.15s;left:50%;margin-left:-10px;}
        .burn-text{animation:burnPage 2.8s ease-in forwards;}
        .ash-p{width:4px;height:6px;background:rgba(80,80,80,0.6);border-radius:2px;position:absolute;animation:ashFall 1.5s ease-in forwards;}
        .smoke-p{width:8px;height:8px;border-radius:50%;background:rgba(180,180,180,0.3);position:absolute;animation:rise 2s ease-out infinite;}
      `}</style>

      {/* Audio soltar con amor */}
      <audio ref={soltarAudioRef} src="/musica_soltar_amor.mp3" preload="auto" style={{ display:"none" }}/>

      <div
        onClick={phase==="peace" ? onClose : undefined}
        style={{ position:"fixed",inset:0,background:"rgba(15,7,3,0.82)",backdropFilter:"blur(8px)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",fontFamily:"'Jost',sans-serif" }}>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500&family=Caveat:wght@400;500&display=swap" rel="stylesheet"/>

        {/* LOADING */}
        {phase==="loading" && (
          <div style={{ color:"rgba(255,240,210,0.5)",fontSize:16,fontFamily:"'Cormorant Garamond',serif",letterSpacing:1 }}>
            🕯️ Preparando el espacio...
          </div>
        )}

        {/* ESCRIBIR */}
        {phase==="write" && (
          <div onClick={e=>e.stopPropagation()} style={{ width:"100%",maxWidth:500,maxHeight:"92vh",overflowY:"auto" }}>
            <div style={{ background:"linear-gradient(135deg,#FDF8F0 0%,#F9F1E2 40%,#F5EBD4 100%)",border:"1px solid rgba(180,140,80,0.3)",borderRadius:4,boxShadow:"0 0 80px rgba(255,100,0,0.12), 0 20px 60px rgba(0,0,0,0.6)",position:"relative",overflow:"hidden" }}>
              {/* Textura líneas papel */}
              <div style={{ position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(180,140,80,0.07) 28px)",pointerEvents:"none" }}/>

              {/* Header */}
              <div style={{ padding:"20px 24px 14px",borderBottom:"1px solid rgba(180,140,80,0.2)",display:"flex",alignItems:"center",gap:12 }}>
                <div style={{ fontSize:28 }}>💌</div>
                <div>
                  <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:400,color:"#3D2B1F",letterSpacing:0.5 }}>Soltar con amor</div>
                  <div style={{ fontSize:11,color:"rgba(93,58,26,0.55)",marginTop:2 }}>
                    Para <em style={{ fontStyle:"italic",color:"#8B6F47" }}>{member.name}</em>
                    {member.year && <span> · ✦ {member.year}</span>}
                  </div>
                </div>
                <button onClick={onClose}
                  style={{ marginLeft:"auto",background:"transparent",border:"none",fontSize:18,color:"rgba(93,58,26,0.4)",cursor:"pointer",padding:"4px 8px" }}>✕</button>
              </div>

              {/* Saludo */}
              <div style={{ padding:"16px 24px 0",fontFamily:"'Cormorant Garamond',serif",fontSize:16,fontWeight:400,color:"rgba(93,58,26,0.65)",fontStyle:"italic" }}>
                Querido/a {member.name.split(" ")[0]},
              </div>

              {/* Área de escritura */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={e=>setContent(e.target.value)}
                placeholder={"Escribe lo que llevas guardado en el corazón...\n\nEste espacio es tuyo. Nadie más puede leer estas palabras.\nCuando estés listo/a, el fuego las llevará donde necesitan ir."}
                style={{ width:"100%",minHeight:200,padding:"12px 24px",background:"transparent",border:"none",outline:"none",fontFamily:"'Caveat',cursive",fontSize:17,color:"#3D2B1F",lineHeight:1.8,resize:"vertical",boxSizing:"border-box" }}
              />

              {/* Firma */}
              <div style={{ padding:"0 24px 8px",fontFamily:"'Cormorant Garamond',serif",fontSize:15,color:"rgba(93,58,26,0.55)",fontStyle:"italic",textAlign:"right" }}>
                Con amor,<br/>
                <span style={{ fontSize:13,color:"rgba(93,58,26,0.35)" }}>{new Date().toLocaleDateString("es-BO",{day:"numeric",month:"long",year:"numeric"})}</span>
              </div>

              {/* Info cifrado */}
              <div style={{ margin:"0 24px 12px",padding:"8px 12px",background:"rgba(139,111,71,0.07)",border:"1px solid rgba(139,111,71,0.14)",borderRadius:2,fontSize:10,color:"rgba(93,58,26,0.45)",display:"flex",gap:6,alignItems:"center" }}>
                <span>🔒</span>
                <span>Esta carta se guarda cifrada. Solo tú puedes leerla. Al quemar, desaparece para siempre.</span>
              </div>

              {/* Botones */}
              <div style={{ padding:"12px 24px 20px",display:"flex",gap:8,flexWrap:"wrap" }}>
                <button onClick={saveDraft} disabled={!content.trim()||saving}
                  style={{ flex:1,padding:"10px 6px",background:"transparent",border:"1.5px solid rgba(139,111,71,0.35)",borderRadius:2,fontFamily:"'Jost',sans-serif",fontSize:11,color:"#8B6F47",cursor:"pointer",letterSpacing:"0.8px",textTransform:"uppercase" }}>
                  {saving?"Guardando...":"🖊️ Guardar borrador"}
                </button>
                {savedLetter && (
                  <button onClick={deleteDraft}
                    style={{ padding:"10px 12px",background:"transparent",border:"1.5px solid rgba(180,60,60,0.3)",borderRadius:2,fontFamily:"'Jost',sans-serif",fontSize:11,color:"rgba(180,60,60,0.6)",cursor:"pointer" }}>
                    🗑️
                  </button>
                )}
                <button onClick={burnLetter} disabled={!content.trim()}
                  style={{ flex:2,padding:"10px 6px",background:content.trim()?"linear-gradient(135deg,#CC3300,#FF6600)":"rgba(139,111,71,0.1)",border:"none",borderRadius:2,fontFamily:"'Jost',sans-serif",fontSize:11,color:content.trim()?"#FFF8F0":"rgba(93,58,26,0.3)",cursor:content.trim()?"pointer":"default",letterSpacing:"1px",textTransform:"uppercase",fontWeight:500,boxShadow:content.trim()?"0 4px 20px rgba(255,100,0,0.3)":"none",transition:"all 0.3s" }}>
                  🔥 Quemar y soltar
                </button>
              </div>

              {savedLetter && (
                <div style={{ padding:"0 24px 14px",fontSize:10,color:"rgba(139,111,71,0.45)",textAlign:"center" }}>
                  ✓ Borrador guardado · solo tú puedes leerlo
                </div>
              )}
            </div>
          </div>
        )}

        {/* QUEMANDO */}
        {phase==="burn" && (
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:0,width:"100%",maxWidth:500 }}>
            <div className="burn-text"
              style={{ width:"100%",background:"linear-gradient(135deg,#FDF8F0,#F5EBD4)",border:"1px solid rgba(180,140,80,0.3)",borderRadius:4,padding:"24px",fontFamily:"'Caveat',cursive",fontSize:17,color:"#3D2B1F",lineHeight:1.8,maxHeight:200,overflow:"hidden",position:"relative" }}>
              <div style={{ position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 27px,rgba(180,140,80,0.08) 28px)" }}/>
              <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontStyle:"italic",color:"rgba(93,58,26,0.6)",marginBottom:8 }}>Querido/a {member.name.split(" ")[0]},</div>
              <div style={{ position:"relative",zIndex:1 }}>{content.slice(0,140)}{content.length>140?"...":""}</div>
            </div>
            <div style={{ position:"relative",display:"flex",justifyContent:"center",alignItems:"flex-end",height:120,width:"100%" }}>
              <div style={{ position:"absolute",bottom:110 }}>
                {[...Array(4)].map((_,i)=>(
                  <div key={i} className="smoke-p" style={{ left:`${-15+i*10}px`,animationDelay:`${i*0.4}s`,animationDuration:`${1.5+i*0.3}s` }}/>
                ))}
              </div>
              <div className="flame f1"/><div className="flame f2"/>
              <div className="flame f3"/><div className="flame f4"/>
            </div>
            <div style={{ color:"rgba(255,200,100,0.65)",fontSize:13,letterSpacing:"1px",marginTop:8,fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",animation:"shimmer 1.5s ease-in-out infinite" }}>
              El fuego lleva tus palabras...
            </div>
          </div>
        )}

        {/* CENIZAS */}
        {phase==="ash" && (
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:20,width:"100%",maxWidth:400 }}>
            <div style={{ position:"relative",height:120,width:300 }}>
              {[...Array(14)].map((_,i)=>(
                <div key={i} className="ash-p" style={{
                  left:`${80+Math.random()*140}px`,
                  bottom:`${20+Math.random()*50}px`,
                  animationDelay:`${Math.random()*0.8}s`,
                  animationDuration:`${1+Math.random()*0.8}s`,
                  transform:`rotate(${Math.random()*360}deg)`,
                  width:`${3+Math.random()*5}px`,height:`${2+Math.random()*4}px`,
                }}/>
              ))}
              <div style={{ width:90,height:14,background:"radial-gradient(ellipse,rgba(100,100,100,0.4),transparent)",borderRadius:"50%",position:"absolute",bottom:0,left:"50%",marginLeft:-45 }}/>
            </div>
            <div style={{ color:"rgba(200,180,150,0.6)",fontSize:14,letterSpacing:"0.5px",fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic" }}>
              Las cenizas se elevan...
            </div>
          </div>
        )}

        {/* PAZ */}
        {phase==="peace" && (
          <div onClick={onClose}
            style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:24,maxWidth:420,textAlign:"center",animation:"fadeInPeace 1.2s ease-out forwards",cursor:"pointer" }}>
            <div style={{ fontSize:52,animation:"shimmer 3s ease-in-out infinite" }}>🕊️</div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:300,color:"rgba(255,240,210,0.9)",letterSpacing:1,lineHeight:1.3 }}>
              Soltado con amor
            </div>
            <div style={{ fontFamily:"'Cormorant Garamond',serif",fontSize:17,fontStyle:"italic",color:"rgba(255,220,150,0.7)",lineHeight:1.7,padding:"0 16px" }}>
              "{frase}"
            </div>
            <div style={{ width:60,height:1,background:"rgba(255,200,100,0.25)" }}/>
            <div style={{ fontSize:11,color:"rgba(255,200,100,0.35)",letterSpacing:"1px",textTransform:"uppercase" }}>
              Tu carta ha sido liberada para siempre
            </div>
            <div style={{ fontSize:11,color:"rgba(255,200,100,0.2)",marginTop:8 }}>Toca para cerrar</div>
          </div>
        )}
      </div>
    </>
  );
}
