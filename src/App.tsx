import { useState, useEffect, KeyboardEvent } from 'react';
import { 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { 
  auth, 
  signInWithGoogle, 
  db 
} from './lib/firebase';
import { 
  createNote, 
  subscribeToNotes, 
  deleteNote,
  updateNote 
} from './lib/noteService';
import { generateConspect } from './lib/gemini';
import { Note, NoteSize } from './types';
import Editor from './components/Editor';
import { 
  Plus, 
  LogOut, 
  FileText, 
  Search, 
  Settings, 
  History, 
  Sparkles, 
  ChevronRight,
  BookOpen,
  ShieldCheck,
  Library,
  Share2,
  Loader2,
  Trash2,
  Clock,
  LayoutDashboard,
  Globe,
  Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { doc, getDocFromServer } from 'firebase/firestore';
import { useLanguage } from './lib/LanguageContext';
import { Language } from './lib/translations';

export default function App() {
  const { t, language, setLanguage } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [quickGenText, setQuickGenText] = useState('');
  const [isQuickGenerating, setIsQuickGenerating] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [mathProblem, setMathProblem] = useState<{ question: string; answer: number } | null>(null);
  const [mathUserAnswer, setMathUserAnswer] = useState('');
  const [mathError, setMathError] = useState(false);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [genTopic, setGenTopic] = useState('');
  const [genSize, setGenSize] = useState<NoteSize>(NoteSize.MEDIUM);

  useEffect(() => {
    // Validate Connection to Firestore
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        // Silently fail or log only if it's a specific offline error
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleQuickGenerate = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isVerified) return;
    if (e.key === 'Enter' && quickGenText.trim() && user && !isQuickGenerating) {
      setIsQuickGenerating(true);
      const topic = quickGenText.trim();
      setQuickGenText('');
      
      try {
        const noteId = await createNote(user.uid, topic, NoteSize.MEDIUM);
        if (noteId) {
          setActiveNoteId(noteId);
          const content = await generateConspect(topic, NoteSize.MEDIUM, language, useSearch);
          if (content) {
            await updateNote(noteId, { content, title: topic });
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsQuickGenerating(false);
      }
    }
  };

  const handleVerify = () => {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    setMathProblem({ question: `${a} + ${b} = ?`, answer: a + b });
    setIsVerifying(true);
    setMathError(false);
    setMathUserAnswer('');
  };

  const checkMathSolution = () => {
    if (mathProblem && parseInt(mathUserAnswer) === mathProblem.answer) {
      setIsVerifying(false);
      setIsVerified(true);
      setMathProblem(null);
    } else {
      setMathError(true);
      setTimeout(() => setMathError(false), 2000);
    }
  };

  const goHome = () => {
    setActiveNoteId(null);
    setSearchTerm('');
  };

  useEffect(() => {
    if (user) {
      const unsubscribe = subscribeToNotes(user.uid, user.email || '', (fetchedNotes) => {
        setNotes(fetchedNotes);
        // If we have an active note but it's not in the new batch (e.g. deleted), clear it
        if (activeNoteId && !fetchedNotes.find(n => n.id === activeNoteId)) {
          setActiveNoteId(null);
        }
      });
      return unsubscribe;
    } else {
      setNotes([]);
      setActiveNoteId(null);
    }
  }, [user]);

  const handleGenerate = async () => {
    if (!genTopic || !user) return;
    
    setIsGenerating(true);
    try {
      const noteId = await createNote(user.uid, genTopic, genSize);
      if (noteId) {
        // Pass language and search option to AI
        const content = await generateConspect(genTopic, genSize, language, useSearch);
        if (content) {
          await updateNote(noteId, { content, title: genTopic });
        }
        setActiveNoteId(noteId);
        setGenTopic('');
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateEmpty = async () => {
    if (!user) return;
    const id = await createNote(user.uid, t.untitled, NoteSize.MEDIUM);
    if (id) setActiveNoteId(id);
  };

  const filteredNotes = notes.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeNote = notes.find(n => n.id === activeNoteId);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200 text-center"
        >
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-600">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">{t.appName}</h1>
          <p className="text-slate-600 mb-8">{t.tagline}</p>
          
          <button 
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm hover:shadow-md"
          >
            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
            {t.signInWithGoogle}
          </button>
          
          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
            <div className="text-left">
              <Sparkles className="w-4 h-4 text-purple-500 mb-1" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t.aiGeneration}</span>
            </div>
            <div className="text-left">
              <Share2 className="w-4 h-4 text-blue-500 mb-1" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">{t.collaboration}</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#0A0A0A] text-[#E5E5E5] font-sans overflow-hidden">
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 0 }}
        className={cn(
          "bg-[#0F0F0F] border-r border-white/5 h-full flex flex-col relative overflow-hidden",
          !isSidebarOpen && "border-none pt-20"
        )}
      >
        {isSidebarOpen && (
          <>
            {/* User Profile */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#141414]">
              {/* ... user profile unchanged ... */}
              <div className="flex items-center gap-3">
                <img src={user.photoURL || ''} className="w-8 h-8 rounded-full border border-white/10" alt="" />
                <div className="flex flex-col">
                  <span className="font-bold text-xs truncate max-w-[120px]">{user.displayName}</span>
                  <span className="text-[10px] text-white/40">{t.proMember}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={goHome}
                  className="p-1.5 hover:bg-blue-600/20 rounded text-blue-400 transition-colors"
                  title={t.home}
                >
                  <Home className="w-4 h-4" />
                </button>
                <div className="relative">
                  <button 
                    onClick={() => setShowLangMenu(!showLangMenu)}
                    className="p-1.5 hover:bg-white/5 rounded text-white/40 hover:text-white transition-colors"
                    title={t.selectLanguage}
                  >
                    <Globe className="w-4 h-4" />
                  </button>
                  <AnimatePresence>
                    {showLangMenu && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute right-0 top-full mt-2 w-32 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                      >
                        {(['ru', 'en', 'fr', 'zh'] as Language[]).map(lang => (
                          <button
                            key={lang}
                            onClick={() => {
                              setLanguage(lang);
                              setShowLangMenu(false);
                            }}
                            className={cn(
                              "w-full px-4 py-2 text-left text-xs font-bold transition-colors",
                              language === lang ? "bg-blue-600 text-white" : "text-white/60 hover:bg-white/5"
                            )}
                          >
                            {lang.toUpperCase()}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button 
                  onClick={() => auth.signOut()}
                  className="p-1.5 hover:bg-white/5 rounded text-white/40 hover:text-red-400 transition-colors"
                  title={t.logout}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation / Actions */}
            <div className="p-4 flex flex-col gap-4">
              <button 
                onClick={handleCreateEmpty}
                className="w-full flex items-center justify-between py-2.5 px-3 bg-white/5 border border-white/10 text-white rounded-lg text-sm hover:bg-white/10 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-400" />
                  <span>{t.newNote}...</span>
                </div>
                <span className="text-[10px] text-white/30 border border-white/10 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">⌘N</span>
              </button>

              {/* Quick Generate Input */}
              <div className="relative group">
                <Sparkles className={cn(
                  "w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 transition-colors",
                  isQuickGenerating ? "text-blue-400 animate-pulse" : "text-white/20 group-focus-within:text-blue-400"
                )} />
                <input 
                  type="text" 
                  value={quickGenText}
                  onChange={(e) => setQuickGenText(e.target.value)}
                  onKeyDown={handleQuickGenerate}
                  disabled={isQuickGenerating || !isVerified}
                  placeholder={!isVerified ? t.verifyHuman : (isQuickGenerating ? t.generatingBtn : t.quickGenPlaceholder)}
                  className="w-full pl-9 pr-4 py-3 bg-[#1A1A1A] border-none rounded-xl text-xs text-white placeholder:text-white/20 focus:ring-1 focus:ring-blue-500/50 shadow-inner"
                />
                {!isQuickGenerating && quickGenText && isVerified && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-blue-500/20 rounded text-[8px] font-bold text-blue-400 border border-blue-500/20">ENTER</div>
                )}
              </div>
              
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t.searchNotes}
                  className="w-full pl-9 pr-4 py-2 bg-[#1A1A1A] border-none rounded-lg text-xs text-white placeholder:text-white/20 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-4 custom-scrollbar">
              <h3 className="px-3 py-2 text-[10px] font-bold text-white/20 uppercase tracking-widest mt-2">{t.library}</h3>
              {filteredNotes.map(note => (
                <button
                  key={note.id}
                  onClick={() => setActiveNoteId(note.id)}
                  className={cn(
                    "w-full flex flex-col items-start px-3 py-3 rounded-md transition-all text-left group border-l-2 border-transparent",
                    activeNoteId === note.id 
                      ? "bg-blue-600/10 border-blue-500 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]" 
                      : "hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className={cn(
                      "font-medium truncate text-sm",
                      activeNoteId === note.id ? "text-white" : "text-white/70"
                    )}>
                      {note.title || t.untitled}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/30 font-medium">
                      {note.updatedAt?.toDate().toLocaleDateString() || t.recently}
                    </span>
                    {note.collaboratorEmails?.length > 0 && (
                      <Share2 className="w-3 h-3 text-blue-400 opacity-60" />
                    )}
                  </div>
                </button>
              ))}
              {filteredNotes.length === 0 && (
                <div className="p-8 text-center bg-[#141414]/50 rounded-xl mt-4 mx-2">
                  <Library className="w-8 h-8 text-white/10 mx-auto mb-2" />
                  <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">{t.emptyLibrary}</p>
                </div>
              )}
            </div>
            {/* Bottom Actions */}
            <div className="p-4 border-t border-white/5 space-y-2">
              <button 
                onClick={() => auth.signOut()}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold text-white/40 hover:text-white hover:bg-white/5 transition-all group"
              >
                <LogOut className="w-4 h-4 group-hover:text-red-400 transition-colors" />
                <span>{t.logout}</span>
              </button>
            </div>
          </>
        )}
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Toggle Sidebar Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute left-6 top-6 z-20 p-2 bg-[#0F0F0F] border border-white/10 rounded-lg shadow-xl hover:bg-[#1A1A1A] transition-colors"
        >
          <LayoutDashboard className="w-4 h-4 text-white/60" />
        </button>

        <AnimatePresence mode="wait">
          {activeNoteId ? (
            <motion.div 
              key={`note-${activeNoteId}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 h-full p-8 pt-20 flex flex-col bg-[#0A0A0A]"
            >
              <div className="max-w-4xl mx-auto w-full h-full flex flex-col shadow-2xl shadow-black/50">
                <Editor 
                  note={activeNote!} 
                  onDelete={() => {
                    if (confirm('Вы уверены, что хотите удалить этот конспект?')) {
                      deleteNote(activeNoteId);
                      setActiveNoteId(null);
                    }
                  }} 
                />
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex items-center justify-center p-8 bg-[#0A0A0A]"
            >
              <div className="max-w-2xl w-full text-center">
                <div className="mb-8 inline-block p-4 bg-blue-600/10 rounded-2xl border border-blue-500/20 text-blue-400">
                  <Sparkles className="w-10 h-10" />
                </div>
                <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">
                  {t.generatePrompt}
                </h2>
                <p className="text-white/40 mb-12 text-lg">
                  {t.generateSub}
                </p>

                <div className="bg-[#0F0F0F] p-8 rounded-3xl border border-white/10 text-left shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <BookOpen className="w-32 h-32" />
                  </div>
                  
                  <div className="space-y-8 relative z-10">
                    <div>
                      <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest block mb-3">{t.topicLabel}</label>
                      <input 
                        type="text" 
                        value={genTopic}
                        onChange={(e) => setGenTopic(e.target.value)}
                        placeholder={t.topicPlaceholder}
                        className="w-full px-5 py-4 bg-[#141414] border border-white/5 rounded-2xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all text-lg text-white"
                      />
                    </div>

                    <div className="flex flex-col md:flex-row gap-8">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest block mb-3">{t.lengthLabel}</label>
                        <div className="flex gap-2">
                          {Object.values(NoteSize).map(size => (
                            <button
                              key={size}
                              onClick={() => setGenSize(size)}
                              className={cn(
                                "flex-1 py-3 px-2 rounded-xl text-[11px] font-bold border transition-all capitalize",
                                genSize === size 
                                  ? "bg-blue-600 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
                                  : "bg-[#141414] border-white/5 text-white/40 hover:border-white/10 hover:text-white/60"
                              )}
                            >
                              {(t as any)[size] || size}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest block mb-3">{t.magicGenerate}</label>
                        <button
                          onClick={() => setUseSearch(!useSearch)}
                          className={cn(
                            "w-full py-3 px-4 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-2",
                            useSearch
                              ? "bg-emerald-600 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                              : "bg-[#141414] border-white/5 text-white/40 hover:border-white/10 hover:text-white/60"
                          )}
                        >
                          <Globe className={cn("w-3.5 h-3.5", useSearch ? "text-white" : "text-white/20")} />
                          {t.useFreshSources}
                        </button>
                      </div>
                    </div>

                    {/* Bot Protection */}
                    <AnimatePresence>
                      {!isVerified && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-4 p-4 bg-[#141414] border border-white/5 rounded-2xl mb-4 transition-all">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <ShieldCheck className={cn("w-5 h-5", isVerifying ? "text-blue-400" : "text-white/20")} />
                                <span className="text-xs font-bold text-white/60">{t.verifyHuman}</span>
                              </div>
                              {!isVerifying && (
                                <button
                                  onClick={handleVerify}
                                  className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-white/5 text-white/40 hover:bg-white/10 border border-white/5 transition-all"
                                >
                                  Verify
                                </button>
                              )}
                            </div>

                            {isVerifying && mathProblem && (
                              <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-3 pt-2 border-t border-white/5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-bold text-white">{t.solveMath}: {mathProblem.question}</span>
                                  {mathError && <span className="text-[10px] text-red-400 animate-bounce">{t.wrongAnswer}</span>}
                                </div>
                                <div className="flex gap-2">
                                  <input 
                                    type="number"
                                    value={mathUserAnswer}
                                    onChange={(e) => setMathUserAnswer(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && checkMathSolution()}
                                    className="flex-1 px-4 py-2 bg-[#0A0A0A] border border-white/10 rounded-lg text-sm text-white focus:border-blue-500 focus:outline-none"
                                  />
                                  <button 
                                    onClick={checkMathSolution}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-blue-700 transition-colors"
                                  >
                                    OK
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button 
                      onClick={handleGenerate}
                      disabled={isGenerating || !genTopic || !isVerified}
                      className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-4 disabled:opacity-50 shadow-xl shadow-blue-900/20"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {t.generatingBtn}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          {t.generateBtn}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-5 bg-[#0F0F0F] rounded-2xl border border-white/5 hover:border-white/10 transition-colors group">
                    <History className="w-5 h-5 text-indigo-400 mb-3 mx-auto group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{t.versionHistory}</span>
                  </div>
                  <div className="p-5 bg-[#0F0F0F] rounded-2xl border border-white/5 hover:border-white/10 transition-colors group">
                    <Search className="w-5 h-5 text-emerald-400 mb-3 mx-auto group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{t.globalSearch}</span>
                  </div>
                  <div className="p-5 bg-[#0F0F0F] rounded-2xl border border-white/5 hover:border-white/10 transition-colors group">
                    <FileText className="w-5 h-5 text-orange-400 mb-3 mx-auto group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">{t.wordIntegration}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
