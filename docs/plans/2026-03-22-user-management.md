# User Management & Roles — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Google OAuth login, 3-role tree access (owner/editor/viewer), pending approval workflow for editor changes, and deceased member indicator.

**Architecture:** Supabase Auth handles Google OAuth. A new `tree_roles` table tracks per-tree roles. The `members` table gets `status`, `deceased`, and `death_year` columns. Anonymous visitors can navigate and use Soltar; editors propose changes that appear as "pending" until the owner approves them.

**Tech Stack:** React 19, Supabase JS v2, Supabase Auth (Google OAuth), Vite 8

---

## Prerequisites (Manual — Do Before Coding)

### Step 1: Enable Google OAuth in Supabase Dashboard
1. Go to your Supabase project → **Authentication** → **Providers** → **Google**
2. Enable Google provider
3. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
4. Create OAuth 2.0 Client ID (Web application)
5. Add Authorized redirect URI: `https://cxjtbupdfxxsvcardxtq.supabase.co/auth/v1/callback`
6. Copy **Client ID** and **Client Secret** back into Supabase Google provider settings
7. Save

### Step 2: Run DB Migrations in Supabase SQL Editor
Go to Supabase → **SQL Editor** and run:

```sql
-- 1. Create tree_roles table
CREATE TABLE IF NOT EXISTS tree_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id    uuid REFERENCES trees(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid NOT NULL,
  role       text NOT NULL CHECK (role IN ('owner','editor','viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tree_id, user_id)
);

-- 2. Add columns to members
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS status     text DEFAULT 'approved' CHECK (status IN ('approved','pending','rejected')),
  ADD COLUMN IF NOT EXISTS deceased   boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS death_year text;

-- 3. Enable RLS on tree_roles
ALTER TABLE tree_roles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read roles (needed to check own role)
CREATE POLICY "tree_roles_select" ON tree_roles FOR SELECT USING (true);

-- Only authenticated users can insert their own role
CREATE POLICY "tree_roles_insert" ON tree_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the owner can update roles
CREATE POLICY "tree_roles_update" ON tree_roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tree_roles tr
      WHERE tr.tree_id = tree_roles.tree_id
        AND tr.user_id = auth.uid()
        AND tr.role = 'owner'
    )
  );
```

### Step 3: Verify tables exist
In Supabase → **Table Editor** confirm:
- `tree_roles` table exists with columns: `id, tree_id, user_id, role, created_at`
- `members` table has new columns: `status, deceased, death_year`

---

## Task 1: Auth Hook — `src/useAuth.js`

**Files:**
- Create: `src/useAuth.js`

**Step 1: Create the hook**

```js
// src/useAuth.js
import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });

  const signOut = () => supabase.auth.signOut();

  return { user, signInWithGoogle, signOut };
}
```

**Step 2: Verify manually**
- Open the app in browser → open DevTools Console
- Run: `await supabase.auth.getSession()` — should return `{ data: { session: null } }` (not logged in yet)

**Step 3: Commit**
```bash
git add src/useAuth.js
git commit -m "feat: add useAuth hook with Google OAuth"
```

---

## Task 2: Wire Auth into App — Replace MY_ID

**Files:**
- Modify: `src/App.jsx` (top of file, lines 1-16)

**Step 1: Import and use the hook**

At the top of `App.jsx`, replace:
```js
function getMyId() {
  let id = localStorage.getItem("arbol-my-id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("arbol-my-id", id); }
  return id;
}
const MY_ID = getMyId();
```

With:
```js
import { useAuth } from './useAuth';
```

**Step 2: Inside the main `App` component (around line 198), add:**
```js
const { user, signInWithGoogle, signOut } = useAuth();
// user === undefined → still loading auth
// user === null      → not logged in (anonymous visitor)
// user === object    → logged in with Google

// Effective ID: use Google user.id if logged in, else fall back to localStorage UUID for legacy
const MY_ID = user?.id ?? (() => {
  let id = localStorage.getItem("arbol-my-id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("arbol-my-id", id); }
  return id;
})();
```

> **Why keep the UUID fallback?** Anonymous visitors still need an ID for Soltar. Logged-in users use their real Supabase user.id.

**Step 3: Verify**
- Open app → `user` should be `null` in anonymous state
- No visible change in UI yet

**Step 4: Commit**
```bash
git add src/App.jsx
git commit -m "feat: wire useAuth into App, replace MY_ID with Google user.id"
```

---

## Task 3: Google Login Button in HomeScreen

**Files:**
- Modify: `src/App.jsx` — `HomeScreen` component (lines 62-120)

**Step 1: Update HomeScreen to accept auth props**

Change the function signature:
```js
function HomeScreen({ onOpen, onCreate, user, onSignIn, onSignOut }) {
```

**Step 2: Add Google login button**

After the closing `</div>` of the "Mis árboles recientes" block and before the footer `<div>` (around line 116), add:

```jsx
{/* Google Auth */}
<div style={{marginTop:16,borderTop:"1px solid rgba(139,111,71,0.15)",paddingTop:16}}>
  {user ? (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"rgba(91,123,111,0.08)",border:"1.5px solid rgba(91,123,111,0.2)",borderRadius:3}}>
      <div>
        <div style={{fontSize:11,color:"#3D6B5A",fontWeight:500,fontFamily:"'Jost',sans-serif"}}>✓ Conectado como</div>
        <div style={{fontSize:12,color:"#2D1B0E",marginTop:2}}>{user.email}</div>
      </div>
      <button onClick={onSignOut} style={{padding:"6px 12px",background:"transparent",border:"1px solid rgba(180,60,60,0.3)",borderRadius:2,fontSize:10,color:"#B43C3C",cursor:"pointer",fontFamily:"'Jost',sans-serif",textTransform:"uppercase"}}>Salir</button>
    </div>
  ) : (
    <button onClick={onSignIn}
      style={{width:"100%",padding:"13px",background:"#FFF",border:"1.5px solid rgba(139,111,71,0.3)",borderRadius:3,fontFamily:"'Jost',sans-serif",fontSize:12,fontWeight:500,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:10,color:"#3D2B1F"}}>
      <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
      Iniciar sesión con Google
    </button>
  )}
</div>
```

**Step 3: Pass auth props in the App render (line ~669)**

Change:
```jsx
if(screen==="home")return <HomeScreen onOpen={openTree} onCreate={createTree}/>;
```
To:
```jsx
if(screen==="home")return <HomeScreen onOpen={openTree} onCreate={createTree} user={user} onSignIn={signInWithGoogle} onSignOut={signOut}/>;
```

**Step 4: Verify manually**
- Open app → Home screen should show "Iniciar sesión con Google" button
- Tap button → redirected to Google login → comes back logged in
- Should show "✓ Conectado como [email]" and a "Salir" button

**Step 5: Commit**
```bash
git add src/App.jsx
git commit -m "feat: add Google login button to HomeScreen"
```

---

## Task 4: Tree Roles — Load and Check Role

**Files:**
- Modify: `src/App.jsx` — inside main `App` component

**Step 1: Add role state**

Near other `useState` declarations (around line 203), add:
```js
const [myRole, setMyRole] = useState('viewer'); // 'owner' | 'editor' | 'viewer'
```

**Step 2: Load role when tree opens**

Inside `openTree` async function (around line 340), after loading members and connections, add:
```js
// Load role for this tree
if (user?.id) {
  const { data: roleRow } = await supabase
    .from('tree_roles')
    .select('role')
    .eq('tree_id', id)
    .eq('user_id', user.id)
    .single();
  setMyRole(roleRow?.role ?? 'viewer');
} else {
  setMyRole('viewer');
}
```

**Step 3: Assign owner when creating a tree**

Inside `createTree` async function (around line 354), after inserting the tree, add:
```js
// Assign owner role if logged in
if (user?.id && data) {
  await supabase.from('tree_roles').insert({
    tree_id: data.id,
    user_id: user.id,
    role: 'owner',
  });
}
```

**Step 4: Update `isMine` to use role**

Replace line 265:
```js
const isMine = m => !m.creator_id || m.creator_id === MY_ID;
```
With:
```js
const isMine = m => myRole === 'owner' || (!m.creator_id || m.creator_id === MY_ID);
const canEdit = myRole === 'owner' || myRole === 'editor';
```

**Step 5: Verify manually**
- Create a new tree while logged in → `tree_roles` table in Supabase should have a row with `role: 'owner'`
- Open an existing shared tree (not yours) → `myRole` should be `'viewer'`

**Step 6: Commit**
```bash
git add src/App.jsx
git commit -m "feat: load and assign tree roles per user"
```

---

## Task 5: Role Badge in Header

**Files:**
- Modify: `src/App.jsx` — Header section (around line 679)

**Step 1: Add role badge**

Inside the header, after the tree title/subtitle div (after line 685), add:
```jsx
{/* Role badge */}
{myRole==='owner'&&<div style={{fontSize:9,letterSpacing:"1px",textTransform:"uppercase",color:"#8B6A00",background:"rgba(201,162,39,0.15)",border:"1px solid rgba(201,162,39,0.3)",borderRadius:2,padding:"2px 7px",fontFamily:"'Jost',sans-serif"}}>👑 Dueño</div>}
{myRole==='editor'&&<div style={{fontSize:9,letterSpacing:"1px",textTransform:"uppercase",color:"#3D6B5A",background:"rgba(77,184,158,0.12)",border:"1px solid rgba(77,184,158,0.3)",borderRadius:2,padding:"2px 7px",fontFamily:"'Jost',sans-serif"}}>✏️ Editor</div>}
{myRole==='viewer'&&<div style={{fontSize:9,letterSpacing:"1px",textTransform:"uppercase",color:"rgba(93,58,26,0.45)",background:"rgba(139,111,71,0.08)",border:"1px solid rgba(139,111,71,0.2)",borderRadius:2,padding:"2px 7px",fontFamily:"'Jost',sans-serif"}}>👁 Visitante</div>}
```

**Step 2: Guard edit buttons by role**

Find the header buttons section (around line 703). The `+ Agregar`, `↔ Conectar` buttons should only show for owner/editor. Wrap them:
```jsx
{canEdit && <Btn onClick={()=>{setConnectMode(true);connectModeRef.current=true;setConnectFirst(null);connectFirstRef.current=null;}}>↔ Conectar</Btn>}
{canEdit && <Btn onClick={()=>setShowAddModal(true)} primary>+ Agregar</Btn>}
```
Leave PDF and Compartir visible to everyone.

**Step 3: Verify**
- Open tree as owner → shows 👑 Dueño badge + all buttons
- Open shared tree as visitor → shows 👁 Visitante + no Agregar/Conectar buttons

**Step 4: Commit**
```bash
git add src/App.jsx
git commit -m "feat: role badge in header, hide edit buttons for viewers"
```

---

## Task 6: Pending Changes for Editors

**Files:**
- Modify: `src/App.jsx` — `addMember` function and member card rendering

**Step 1: Set status on insert**

In `addMember` function (around line 395), when inserting a normal member, change the insert to include `status`:
```js
const status = myRole === 'owner' ? 'approved' : 'pending';

const { data, error } = await supabase.from("members").insert({
  tree_id: treeId,
  name: form.name.trim(),
  role: form.role,
  photo: form.photo,
  year: form.year,
  creator_id: MY_ID,
  status,   // ← new
  ...basePos
}).select().single();
```

Do the same for portal inserts (linked tree members).

**Step 2: Visual style for pending cards**

In the member card render (around line 767), update the card container style to add pending indicator:
```jsx
const isPending = m.status === 'pending';

style={{
  position:"absolute", left:m.x, top:m.y, width:155,
  background: isPending ? "rgba(255,252,230,0.97)" : (isFirst?"rgba(240,252,248,0.97)":"rgba(255,252,245,0.94)"),
  border: `${isPending ? "2px dashed #D4A017" : "1.5px solid"} ${isFirst?"#5B7B6F":selected===m.id?(mine?"#8B6F47":"#B43C3C"):"rgba(139,111,71,0.2)"}`,
  borderRadius:3,
  boxShadow: isFirst?"0 0 0 3px rgba(91,123,111,0.25),0 4px 20px rgba(93,58,26,0.1)":"0 3px 18px rgba(93,58,26,0.08)",
  cursor:connectMode?"crosshair":(mine?"pointer":"default"),
  overflow:"hidden", touchAction:"none"
}}
```

**Step 3: Add "⏳ pendiente" label on pending cards**

Inside the card, right after the role badge div (around line 787), add:
```jsx
{isPending && (
  <div style={{position:"absolute",top:5,left:5,zIndex:10,background:"#D4A017",borderRadius:2,padding:"1px 6px",fontSize:9,color:"#FFF",fontFamily:"'Jost',sans-serif"}}>⏳ pendiente</div>
)}
```

**Step 4: Filter out rejected members from render**

In the members map (around line 739), add:
```js
if (m.status === 'rejected') return null;
```

**Step 5: Verify**
- Log in as an editor (use a different Google account or set role manually in Supabase)
- Add a member → card appears with dashed yellow border + "⏳ pendiente" label
- In Supabase table, `status` column shows `'pending'`

**Step 6: Commit**
```bash
git add src/App.jsx
git commit -m "feat: pending status for editor changes, visual pending card style"
```

---

## Task 7: Approval Modal for Owner

**Files:**
- Modify: `src/App.jsx`

**Step 1: Add pending count state**

Near other useState declarations, add:
```js
const [showApproval, setShowApproval] = useState(false);
```

The pending count is derived:
```js
const pendingMembers = members.filter(m => m.status === 'pending');
```

**Step 2: Add approval/reject functions**

After the `removeMember` function, add:
```js
const approveMember = async (id) => {
  await supabase.from("members").update({ status: 'approved' }).eq("id", id);
  setMembers(p => p.map(m => m.id === id ? { ...m, status: 'approved' } : m));
};

const rejectMember = async (id) => {
  await supabase.from("members").update({ status: 'rejected' }).eq("id", id);
  setMembers(p => p.filter(m => m.id !== id));
};
```

**Step 3: Add "🔔 Pendientes" button in header**

In the header buttons section, after PDF button, add (only for owners):
```jsx
{myRole === 'owner' && pendingMembers.length > 0 && (
  <Btn onClick={() => setShowApproval(true)}
    style={{ borderColor:"rgba(212,160,23,0.5)", color:"#8B6A00", background:"rgba(212,160,23,0.08)" }}>
    🔔 Pendientes ({pendingMembers.length})
  </Btn>
)}
```

**Step 4: Add Approval Modal**

In the modals section (around line 881), add:
```jsx
{/* Approval modal */}
{showApproval && (
  <div onClick={() => setShowApproval(false)}
    style={{position:"fixed",inset:0,background:"rgba(45,27,14,0.38)",backdropFilter:"blur(5px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
    <div onClick={e => e.stopPropagation()}
      style={{background:"#FFF8F0",border:"1.5px solid rgba(139,111,71,0.25)",borderRadius:4,padding:24,width:"100%",maxWidth:420,boxShadow:"0 20px 60px rgba(45,27,14,0.2)",maxHeight:"80vh",overflowY:"auto"}}>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:300,color:"#2D1B0E",marginBottom:16}}>
        🔔 Cambios pendientes ({pendingMembers.length})
      </div>
      {pendingMembers.length === 0 ? (
        <div style={{fontSize:12,color:"rgba(93,58,26,0.45)",textAlign:"center",padding:"20px 0"}}>Sin cambios pendientes</div>
      ) : (
        pendingMembers.map(m => (
          <div key={m.id}
            style={{display:"flex",alignItems:"center",gap:10,padding:"12px 0",borderBottom:"1px solid rgba(139,111,71,0.1)"}}>
            <div style={{flex:1}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:"#2D1B0E"}}>{m.name}</div>
              <div style={{fontSize:10,color:"rgba(93,58,26,0.4)",marginTop:2}}>{m.role}{m.year ? ` · ${m.year}` : ''}</div>
            </div>
            <button onClick={() => approveMember(m.id)}
              style={{padding:"7px 12px",background:"rgba(45,122,79,0.1)",border:"1.5px solid rgba(45,122,79,0.4)",borderRadius:2,fontSize:11,color:"#2D7A4F",cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:500}}>
              ✓ Aprobar
            </button>
            <button onClick={() => rejectMember(m.id)}
              style={{padding:"7px 12px",background:"transparent",border:"1.5px solid rgba(180,60,60,0.3)",borderRadius:2,fontSize:11,color:"#B43C3C",cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>
              ✕
            </button>
          </div>
        ))
      )}
      <Btn onClick={() => setShowApproval(false)} style={{width:"100%",marginTop:16,padding:11}}>Cerrar</Btn>
    </div>
  </div>
)}
```

**Step 5: Verify**
- As editor: add a member → appears with ⏳ label
- As owner: see 🔔 Pendientes (1) button → tap → modal shows pending member
- Tap ✓ Aprobar → card becomes normal
- Tap ✕ → card disappears

**Step 6: Commit**
```bash
git add src/App.jsx
git commit -m "feat: approval modal for owner to approve/reject pending member changes"
```

---

## Task 8: Editor Role Link in Share Modal

**Files:**
- Modify: `src/App.jsx` — Share modal (around line 908)

**Step 1: Create editor share URL**

Near the existing `shareUrl` (line 658), add:
```js
const editorUrl = `${window.location.origin}${window.location.pathname}?tree=${treeId}&role=editor`;
const [copiedEditor, setCopiedEditor] = useState(false);
const copyEditorLink = () => {
  navigator.clipboard.writeText(editorUrl);
  setCopiedEditor(true);
  setTimeout(() => setCopiedEditor(false), 2000);
};
```

**Step 2: Handle editor role from URL on load**

In the URL-reading effect (around line 337), after `openTree(id)`, add:
```js
const roleParam = new URLSearchParams(window.location.search).get('role');
if (roleParam === 'editor' && user?.id) {
  // Upsert editor role (only if not already owner)
  const { data: existing } = await supabase
    .from('tree_roles')
    .select('role')
    .eq('tree_id', id)
    .eq('user_id', user.id)
    .single();
  if (!existing) {
    await supabase.from('tree_roles').insert({ tree_id: id, user_id: user.id, role: 'editor' });
    setMyRole('editor');
  }
}
```

**Step 3: Add editor link section to Share modal**

Inside the Share modal (after the visitor link section), add:
```jsx
{myRole === 'owner' && (
  <div style={{marginTop:14,padding:"12px 14px",background:"rgba(77,184,158,0.06)",border:"1.5px solid rgba(77,184,158,0.25)",borderRadius:3}}>
    <div style={{fontSize:10,letterSpacing:"1px",textTransform:"uppercase",color:"#3D6B5A",fontWeight:500,marginBottom:8}}>✏️ Link de editor (requiere login Google)</div>
    <div style={{padding:"8px 10px",background:"rgba(245,240,232,0.8)",border:"1px solid rgba(139,111,71,0.2)",borderRadius:2,marginBottom:8,fontSize:10,color:"#5D3A1A",wordBreak:"break-all",fontFamily:"monospace"}}>{editorUrl}</div>
    <button onClick={copyEditorLink}
      style={{padding:"8px 14px",background:copiedEditor?"rgba(45,122,79,0.1)":"rgba(77,184,158,0.1)",border:`1.5px solid ${copiedEditor?"rgba(45,122,79,0.4)":"rgba(77,184,158,0.4)"}`,borderRadius:2,fontSize:11,color:copiedEditor?"#2D7A4F":"#3D6B5A",cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:500}}>
      {copiedEditor ? "✓ Copiado" : "📋 Copiar link de editor"}
    </button>
  </div>
)}
```

**Step 4: Verify**
- As owner: open Share modal → see editor link section
- Copy editor link → open in another browser/device with Google login → becomes editor
- As editor: add member → appears as pending

**Step 5: Commit**
```bash
git add src/App.jsx
git commit -m "feat: editor role link in share modal, auto-assign editor role from URL"
```

---

## Task 9: Deceased Indicator

**Files:**
- Modify: `src/App.jsx` — member card render, AddModal form, EditModal

**Step 1: Update AddModal form**

In the Add modal (around line 941), after the "Año de nacimiento" field, add:
```jsx
{/* Fallecido */}
<div style={{marginBottom:12}}>
  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:"#5D3A1A",fontFamily:"'Jost',sans-serif"}}>
    <input type="checkbox"
      checked={form.deceased || false}
      onChange={e => setForm(f => ({ ...f, deceased: e.target.checked }))}
      style={{width:15,height:15,cursor:"pointer"}}/>
    ✝ Persona fallecida
  </label>
</div>
{form.deceased && (
  <div style={{marginBottom:12}}>
    <label style={{display:"block",fontSize:9,letterSpacing:"1.5px",textTransform:"uppercase",color:"#8B6F47",fontWeight:500,marginBottom:5}}>Año de fallecimiento</label>
    <input placeholder="Ej: 1998" value={form.death_year || ''} onChange={e => setForm(f => ({ ...f, death_year: e.target.value }))} style={iStyle}/>
  </div>
)}
```

Also add `deceased: false, death_year: ''` to the initial form state.

**Step 2: Include deceased fields in member insert**

In `addMember` insert (around line 406), add:
```js
deceased: form.deceased || false,
death_year: form.death_year || null,
```

**Step 3: Update EditModal similarly**

In `EditModal` component (around line 123):
- Add `deceased: member.deceased || false, death_year: member.death_year || ''` to initial form state
- Add the same checkbox + death_year field after "Año de nacimiento"

**Step 4: Include in member update**

In `saveMemberEdit` function (around line 415), add to the update fields:
```js
deceased: fields.deceased || false,
death_year: fields.death_year || null,
```

**Step 5: Update card visual for deceased members**

In the member card render (around line 767), add deceased styling:
```jsx
const isDeceased = m.deceased === true;

// Update card style:
style={{
  ...existingStyles,
  border: isPending
    ? "2px dashed #D4A017"
    : `1.5px solid ${isFirst?"#5B7B6F": isDeceased ? "#6B6B6B" : selected===m.id?(mine?"#8B6F47":"#B43C3C"):"rgba(139,111,71,0.2)"}`,
  background: isPending
    ? "rgba(255,252,230,0.97)"
    : isDeceased
    ? "rgba(240,238,235,0.94)"
    : isFirst ? "rgba(240,252,248,0.97)" : "rgba(255,252,245,0.94)",
}}
```

**Step 6: Add ✝ icon on deceased card photo**

In the photo section of the card (around line 778), add:
```jsx
{isDeceased && (
  <div style={{position:"absolute",top:6,right:6,zIndex:10,fontSize:14,color:"#6B6B6B",textShadow:"0 1px 3px rgba(255,255,255,0.8)"}}>✝</div>
)}
```

**Step 7: Show death year in card info**

After the birth year line (around line 789):
```jsx
{m.year && <div style={{fontSize:10,color:"rgba(93,58,26,0.4)",marginTop:2}}>✦ {m.year}</div>}
{isDeceased && m.death_year && <div style={{fontSize:10,color:"rgba(107,107,107,0.7)",marginTop:1}}>✝ {m.death_year}</div>}
```

**Step 8: Verify**
- Add a member → check "✝ Persona fallecida" → enter death year
- Card shows: grey border, muted background, ✝ icon on photo, death year below birth year
- Edit an existing member → can toggle deceased on/off

**Step 9: Commit**
```bash
git add src/App.jsx
git commit -m "feat: deceased indicator on member cards with death year"
```

---

## Task 10: Migration Flow — Claim Existing Trees

**Files:**
- Modify: `src/App.jsx` — HomeScreen and `openTree`

**Step 1: Add claim tree flow in openTree**

In `openTree` function, after loading the tree, check if the current user has a role. If not, and if they were the original creator (via localStorage UUID), offer to claim:

```js
if (user?.id) {
  const { data: roleRow } = await supabase
    .from('tree_roles')
    .select('role')
    .eq('tree_id', id)
    .eq('user_id', user.id)
    .single();

  if (!roleRow) {
    // Check if they created this tree via old UUID system
    const legacyId = localStorage.getItem("arbol-my-id");
    const { data: legacyMembers } = await supabase
      .from('members')
      .select('id')
      .eq('tree_id', id)
      .eq('creator_id', legacyId)
      .limit(1);

    if (legacyMembers && legacyMembers.length > 0) {
      // They have legacy members → auto-claim as owner
      await supabase.from('tree_roles').insert({ tree_id: id, user_id: user.id, role: 'owner' });
      setMyRole('owner');
    } else {
      setMyRole('viewer');
    }
  } else {
    setMyRole(roleRow.role);
  }
}
```

**Step 2: Verify**
- Log in with Google → open an old tree that you created with UUID → should auto-claim as owner
- Open someone else's tree → stays as viewer

**Step 3: Commit**
```bash
git add src/App.jsx
git commit -m "feat: auto-claim ownership of legacy trees for logged-in users"
```

---

## Task 11: Final Push and PR

**Step 1: Push branch**
```bash
git push origin claude/festive-shaw
```

**Step 2: Verify on deployed preview**
- Open preview URL on Android Chrome
- Test: Google login → role badge → add member as editor → approve as owner → deceased card

**Step 3: Merge PR on GitHub**
- Go to GitHub → Pull Requests → merge `claude/festive-shaw`

---

## Quick Reference

| Role | Can navigate | Soltar | Add member | Edit own | Approve |
|------|-------------|--------|-----------|----------|---------|
| Owner | ✅ | ✅ | ✅ approved | ✅ | ✅ |
| Editor | ✅ | ✅ | ✅ pending | ✅ pending | ❌ |
| Visitor (anon) | ✅ | ✅ | ❌ | ❌ | ❌ |
