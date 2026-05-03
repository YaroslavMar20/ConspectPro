import React, { useState, useEffect, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuillImproved = ReactQuill as any;
import { Note, NoteSize } from '../types';
import { updateNote, exportToWord } from '../lib/noteService';
import { rephraseSelection, checkPlagiarism } from '../lib/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Save, 
  Download, 
  Trash2, 
  Sparkles, 
  Search, 
  UserPlus, 
  X, 
  Maximize2, 
  Minimize2,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useLanguage } from '../lib/LanguageContext';

interface EditorProps {
  note: Note;
  onDelete: () => void;
}

export default function Editor({ note, onDelete }: EditorProps) {
  const { t, language } = useLanguage();
  const [content, setContent] = useState(note.content);
  const [title, setTitle] = useState(note.title);
  const [isSaving, setIsSaving] = useState(false);
  const [isRephrasing, setIsRephrasing] = useState(false);
  const [isCheckingPlagiarism, setIsCheckingPlagiarism] = useState(false);
  const [plagiarismResult, setPlagiarismResult] = useState<{ score: number, feedback: string } | null>(null);
  const [collaborationEmail, setCollaborationEmail] = useState('');
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const quillRef = useRef<any>(null);

  // Sync content from note when it changes externally (collaboration)
  useEffect(() => {
    if (note.content !== content) {
      setContent(note.content);
    }
    if (note.title !== title) {
      setTitle(note.title);
    }
  }, [note.content, note.title]);

  const handleSave = async () => {
    setIsSaving(true);
    await updateNote(note.id, { content, title });
    setIsSaving(false);
  };

  const handleRephrase = async () => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const selection = quill.getSelection();
    if (!selection || selection.length === 0) {
      alert('Пожалуйста, выделите текст для перефразирования');
      return;
    }

    const selectedText = quill.getText(selection.index, selection.length);
    const instruction = prompt(language === 'ru' ? 'Как изменить текст? (например: "упрости", "сделай более формальным")' : 'How to change text? (e.g. "simplify", "make more formal")');
    if (!instruction) return;

    setIsRephrasing(true);
    try {
      const newText = await rephraseSelection(selectedText, instruction);
      if (newText) {
        quill.deleteText(selection.index, selection.length);
        quill.insertText(selection.index, newText);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsRephrasing(false);
    }
  };

  const handleCheckPlagiarism = async () => {
    setIsCheckingPlagiarism(true);
    try {
      const text = quillRef.current?.getEditor().getText() || '';
      const result = await checkPlagiarism(text);
      setPlagiarismResult(result);
    } catch (error) {
      console.error(error);
    } finally {
      setIsCheckingPlagiarism(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!collaborationEmail) return;
    const newCollaborators = [...(note.collaboratorEmails || []), collaborationEmail];
    await updateNote(note.id, { collaboratorEmails: newCollaborators });
    setCollaborationEmail('');
    setShowCollabModal(false);
  };

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      ['link', 'clean']
    ],
  };

  return (
    <div className="flex flex-col h-full bg-[#0F0F0F] rounded-t-xl overflow-hidden border border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#141414]">
        <div className="flex-1 flex items-center gap-3">
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 w-full text-white placeholder:text-white/20"
            placeholder={t.untitled + "..."}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowCollabModal(true)}
            className="p-2 hover:bg-white/5 rounded-md transition-colors relative group"
            title={t.collaborate}
          >
            <UserPlus className="w-4 h-4 text-white/60" />
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#1A1A1A] text-white text-[9px] rounded-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">{t.collaboration}</span>
          </button>
          
          <button 
            onClick={handleCheckPlagiarism}
            disabled={isCheckingPlagiarism}
            className="p-2 hover:bg-white/5 rounded-md transition-colors relative group"
          >
            {isCheckingPlagiarism ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <Search className="w-4 h-4 text-white/60" />}
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#1A1A1A] text-white text-[9px] rounded-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">{t.checkPlagiarism}</span>
          </button>

          <button 
            onClick={handleRephrase}
            disabled={isRephrasing}
            className="p-2 hover:bg-white/5 rounded-md transition-colors relative group"
          >
            {isRephrasing ? <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> : <Sparkles className="w-4 h-4 text-white/60" />}
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-[#1A1A1A] text-white text-[9px] rounded-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">{t.aiRephrase}</span>
          </button>

          <div className="w-px h-6 bg-white/10 mx-1" />

          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/10"
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            <span>{t.save}</span>
          </button>

          <button 
            onClick={() => exportToWord(note)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 text-white text-xs font-bold rounded-lg hover:bg-white/10 transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>{t.word}</span>
          </button>

          <button 
            onClick={onDelete}
            className="p-2 hover:bg-red-900/20 text-red-400 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden relative bg-[#0F0F0F]">
        <ReactQuillImproved 
          ref={quillRef}
          theme="snow"
          value={content}
          onChange={setContent}
          modules={quillModules}
          className="h-full custom-scrollbar"
        />

        {/* Floating results (plagiarism) */}
        <AnimatePresence>
          {plagiarismResult && (
            <motion.div 
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="absolute right-6 top-6 w-72 bg-[#1A1A1A] backdrop-blur-md shadow-2xl border border-white/10 rounded-2xl p-5 z-20"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {t.checkPlagiarism}
                </h3>
                <button onClick={() => setPlagiarismResult(null)} className="text-white/20 hover:text-white/40">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-2xl font-bold text-emerald-400">{plagiarismResult.score}%</span>
                    <span className="text-[10px] text-white/40 uppercase font-bold tracking-tighter mb-1">{t.unique}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${plagiarismResult.score}%` }}
                      className="h-full bg-emerald-500"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-white/60 italic leading-relaxed">"{plagiarismResult.feedback}"</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCollabModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#141414] border border-white/10 rounded-3xl shadow-2xl p-8 w-full max-w-md"
            >
              <div className="flex justify-between mb-8">
                <h3 className="text-xl font-bold text-white tracking-tight">{t.collaboration}</h3>
                <button 
                  onClick={() => setShowCollabModal(false)}
                  className="p-1 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-8">
                <div>
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3 block">{t.inviteColleague}</label>
                  <div className="flex gap-2">
                    <input 
                      type="email" 
                      value={collaborationEmail}
                      onChange={(e) => setCollaborationEmail(e.target.value)}
                      placeholder="colleague@university.edu"
                      className="flex-1 px-4 py-3 bg-[#1A1A1A] border border-white/5 rounded-xl text-sm focus:border-blue-500 focus:outline-none text-white placeholder:text-white/20"
                    />
                    <button 
                      onClick={handleAddCollaborator}
                      className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      {t.inviteBtn}
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-4">{t.participants}</h4>
                  <div className="flex flex-col gap-2">
                    {note.collaboratorEmails?.map(email => (
                      <div key={email} className="px-4 py-3 bg-[#1A1A1A] border border-white/5 rounded-xl text-xs text-white/80 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px]">
                            {email[0].toUpperCase()}
                          </div>
                          {email}
                        </div>
                        <span className="text-[10px] bg-white/5 text-white/30 px-2 py-0.5 rounded">Editor</span>
                      </div>
                    ))}
                    {(!note.collaboratorEmails || note.collaboratorEmails.length === 0) && (
                      <p className="text-sm text-white/20 italic text-center py-4 bg-white/5 rounded-xl border border-dashed border-white/10">{t.noCollaborators}</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
