'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ChevronDown, FileText, Folder, LogOut, Menu, MoreHorizontal, Pin, Plus, Search, Settings, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

type DbNote = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  folder: string;
  created_at: string;
  updated_at: string;
};

type Note = DbNote;

const folders = ['Personal', 'Trabajo'];

function relativeDate(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ayer';
  return new Date(date).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('Todas las notas');
  const [dark, setDark] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const loadNotes = useCallback(async (currentUser: User) => {
    setLoadingNotes(true);
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setNotes(data as Note[]);
      setSelected((current) => current && data.some((n) => n.id === current) ? current : data[0]?.id ?? null);
    }
    setLoadingNotes(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (!session) {
        setNotes([]);
        setSelected(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    loadNotes(user);

    const channel = supabase
      .channel(`notes:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${user.id}` }, () => loadNotes(user))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadNotes]);

  useEffect(() => {
    const onFocus = () => { if (user) loadNotes(user); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, loadNotes]);

  const note = notes.find((n) => n.id === selected) ?? null;

  const visible = useMemo(() => notes.filter((n) => {
    const matchesFolder = folder === 'Todas las notas' || (folder === 'Fijadas' ? n.is_pinned : n.folder === folder);
    const q = query.trim().toLowerCase();
    return matchesFolder && (!q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }), [notes, folder, query]);

  const createNote = async () => {
    if (!user) return;
    const targetFolder = folder === 'Todas las notas' || folder === 'Fijadas' ? 'Personal' : folder;
    const { data, error } = await supabase.from('notes').insert({ user_id: user.id, title: 'Nueva nota', content: '', folder: targetFolder }).select().single();
    if (!error && data) {
      setNotes((current) => [data as Note, ...current]);
      setSelected(data.id);
    }
  };

  const updateNote = (changes: Partial<Pick<Note, 'title' | 'content'>>) => {
    if (!note) return;
    const updatedAt = new Date().toISOString();
    setNotes((current) => current.map((n) => n.id === note.id ? { ...n, ...changes, updated_at: updatedAt } : n));
    clearTimeout(saveTimers.current[note.id]);
    saveTimers.current[note.id] = setTimeout(async () => {
      await supabase.from('notes').update({ ...changes, updated_at: updatedAt }).eq('id', note.id).eq('user_id', user?.id);
    }, 450);
  };

  const togglePin = async () => {
    if (!note || !user) return;
    const next = !note.is_pinned;
    setNotes((current) => current.map((n) => n.id === note.id ? { ...n, is_pinned: next } : n));
    await supabase.from('notes').update({ is_pinned: next, updated_at: new Date().toISOString() }).eq('id', note.id).eq('user_id', user.id);
  };

  const deleteNote = async () => {
    if (!note || !user) return;
    await supabase.from('notes').delete().eq('id', note.id).eq('user_id', user.id);
    const remaining = notes.filter((n) => n.id !== note.id);
    setNotes(remaining);
    setSelected(remaining[0]?.id ?? null);
  };

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setAuthMessage('');
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthMessage(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthMessage(error.message);
      else if (!data.session) setAuthMessage('Cuenta creada. Revisa tu correo para confirmar tu cuenta y luego inicia sesión.');
    }
  };

  const signOut = () => supabase.auth.signOut();

  if (authLoading) return <div className="authScreen"><div className="authCard"><div className="brand">notenoté</div><p>Cargando…</p></div></div>;

  if (!user) return (
    <div className="authScreen">
      <form className="authCard" onSubmit={submitAuth}>
        <div className="brand authBrand">notenoté</div>
        <p className="authSubtitle">Tus ideas, en todos tus dispositivos.</p>
        <div className="authTabs">
          <button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => { setAuthMode('login'); setAuthMessage(''); }}>Ingresar</button>
          <button type="button" className={authMode === 'signup' ? 'active' : ''} onClick={() => { setAuthMode('signup'); setAuthMessage(''); }}>Crear cuenta</button>
        </div>
        <label>Correo electrónico<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" /></label>
        <label>Contraseña<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></label>
        <button className="primaryAuth" type="submit">{authMode === 'login' ? 'Ingresar' : 'Crear mi cuenta'}</button>
        {authMessage && <div className="authMessage">{authMessage}</div>}
      </form>
    </div>
  );

  return <main className={dark ? 'app dark' : 'app'}>
    <header className="mobileTop"><button onClick={() => setSidebar((v) => !v)}><Menu size={20}/></button><div className="brand">notenoté</div><button onClick={createNote}><Plus size={20}/></button></header>
    {sidebar && <aside className="sidebar">
      <div className="brandRow"><div className="brand">notenoté</div><button className="iconBtn"><MoreHorizontal size={20}/></button></div>
      <div className="accountRow"><span>{user.email}</span><button onClick={signOut} title="Cerrar sesión"><LogOut size={16}/></button></div>
      <div className="search"><Search size={17}/><input placeholder="Buscar" value={query} onChange={(e) => setQuery(e.target.value)}/>{query && <button onClick={() => setQuery('')}><X size={14}/></button>}</div>
      <button className={'navItem ' + (folder === 'Todas las notas' ? 'active' : '')} onClick={() => setFolder('Todas las notas')}><FileText size={18}/><span>Todas las notas</span><b>{notes.length}</b></button>
      <button className={'navItem ' + (folder === 'Fijadas' ? 'active' : '')} onClick={() => setFolder('Fijadas')}><Pin size={18}/><span>Fijadas</span></button>
      <div className="sectionLabel">CARPETAS</div>
      {folders.map((f) => <button key={f} className={'navItem ' + (folder === f ? 'active' : '')} onClick={() => setFolder(f)}><Folder size={18}/><span>{f}</span></button>)}
      <button className="newFolder"><Plus size={17}/> Nueva carpeta</button>
      <div className="sidebarBottom"><button className="navItem"><Trash2 size={18}/><span>Papelera</span></button><button className="navItem" onClick={() => setDark((v) => !v)}><Settings size={18}/><span>{dark ? 'Modo claro' : 'Modo oscuro'}</span></button></div>
    </aside>}
    <section className="notesList">
      <div className="listHeader"><div><div className="eyebrow">{folder}</div><h1>{folder === 'Todas las notas' ? 'Notas' : folder}</h1></div><button className="newBtn" onClick={createNote}><Plus size={18}/> Nueva</button></div>
      <div className="count">{loadingNotes ? 'Cargando…' : `${visible.length} ${visible.length === 1 ? 'nota' : 'notas'}`}</div>
      <div className="noteCards">{visible.map((n) => <button className={'noteCard ' + (n.id === selected ? 'selected' : '')} key={n.id} onClick={() => setSelected(n.id)}><div className="noteCardTop"><span>{n.title || 'Sin título'}</span>{n.is_pinned && <Pin size={13} fill="currentColor"/>}</div><div className="preview">{n.content || 'Sin contenido'}</div><div className="date">{relativeDate(n.updated_at)}</div></button>)}{visible.length === 0 && <div className="empty"><Search size={30}/><p>{query ? 'No encontramos notas' : 'Aún no tienes notas'}</p><span>{query ? 'Prueba con otra búsqueda.' : 'Crea tu primera nota para empezar.'}</span>{!query && <button className="emptyButton" onClick={createNote}><Plus size={16}/> Nueva nota</button>}</div>}</div>
    </section>
    <section className="editor">
      {note ? <><div className="editorToolbar"><span>Guardado automáticamente</span><div><button title="Fijar" onClick={togglePin} className={note.is_pinned ? 'toolbarActive' : ''}><Pin size={17}/></button><button title="Eliminar" onClick={deleteNote}><Trash2 size={17}/></button><button title="Más"><MoreHorizontal size={19}/></button></div></div><article className="paper"><input className="title" value={note.title} onChange={(e) => updateNote({ title: e.target.value })}/><div className="meta">Editado {relativeDate(note.updated_at)} · {note.folder}</div><textarea className="body" value={note.content} onChange={(e) => updateNote({ content: e.target.value })} placeholder="Empieza a escribir..."/></article></> : <div className="editorEmpty"><FileText size={36}/><p>Selecciona una nota</p></div>}
    </section>
  </main>;
}
