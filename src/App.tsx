import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  LayoutDashboard, 
  LogOut, 
  User as UserIcon, 
  Plus, 
  ChevronRight,
  GraduationCap,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TeacherAvatar } from './components/TeacherAvatar';
import { SmartBoard } from './components/SmartBoard';
import { ChatPanel } from './components/ChatPanel';
import { LessonCreator } from './components/LessonCreator';
import { NotesPanel } from './components/NotesPanel';
import { generateLessonScript, askTeacher, generateNotes } from './services/gemini';

// --- Types ---
interface User {
  id: number;
  name: string;
  email: string;
  profileImage: string;
}

interface Lesson {
  id: number;
  topic: string;
  content: string;
  script: string;
  createdAt: string;
}

interface ScriptStep {
  speech: string;
  board: string;
  action: 'explaining' | 'writing' | 'pointing' | 'idle';
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [view, setView] = useState<'dashboard' | 'creator' | 'lesson'>('dashboard');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [script, setScript] = useState<ScriptStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isChatTyping, setIsChatTyping] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // --- Auth Effects ---
  useEffect(() => {
    if (token) {
      fetchProfile();
      fetchLessons();
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setUser(await res.json());
      else logout();
    } catch (e) {
      logout();
    }
  };

  const fetchLessons = async () => {
    try {
      const res = await fetch('/api/lessons', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setLessons(await res.json());
    } catch (e) {}
  };

  const login = async (idToken: string) => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setView('dashboard');
  };

  // --- Lesson Logic ---
  const handleCreateLesson = async (topic: string, file?: File) => {
    setIsLoading(true);
    try {
      let lessonData;
      if (file) {
        const formData = new FormData();
        formData.append('pdf', file);
        formData.append('topic', topic);
        const res = await fetch('/api/lesson/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        lessonData = await res.json();
      } else {
        const res = await fetch('/api/lesson/topic', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ topic })
        });
        lessonData = await res.json();
      }

      // Generate AI Script
      const generatedScript = await generateLessonScript(topic, lessonData.content);
      
      // Update lesson with script
      await fetch(`/api/lesson/${lessonData.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ script: JSON.stringify(generatedScript) })
      });

      const fullLesson = { ...lessonData, script: JSON.stringify(generatedScript) };
      setCurrentLesson(fullLesson);
      setScript(generatedScript);
      setLessons([fullLesson, ...lessons]);
      setView('lesson');
      startLesson(generatedScript);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const startLesson = (steps: ScriptStep[]) => {
    setCurrentStepIndex(0);
    playStep(steps[0]);
  };

  const playStep = (step: ScriptStep) => {
    if (!step) return;
    setIsSpeaking(true);
    
    // Simulate speech duration based on text length
    const duration = Math.max(2000, step.speech.length * 50);
    
    // Use Web Speech API if available
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(step.speech);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsSpeaking(false), duration);
    }
  };

  const nextStep = () => {
    if (currentStepIndex < script.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      playStep(script[nextIdx]);
    } else {
      generateLessonNotes();
    }
  };

  const generateLessonNotes = async () => {
    if (!currentLesson || notes) return;
    const generatedNotes = await generateNotes(currentLesson.content || currentLesson.topic);
    setNotes(generatedNotes);
  };

  const handleSendMessage = async (text: string) => {
    const newUserMsg = { id: Date.now().toString(), text, sender: 'user' };
    setChatMessages(prev => [...prev, newUserMsg]);
    setIsChatTyping(true);

    try {
      const history = chatMessages.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', text: m.text }));
      const response = await askTeacher(currentLesson?.content || currentLesson?.topic || "", text, history);
      
      const aiMsg = { id: (Date.now() + 1).toString(), text: response || "I'm sorry, I couldn't process that.", sender: 'ai' };
      setChatMessages(prev => [...prev, aiMsg]);
      
      // Save to DB
      await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          lessonId: currentLesson?.id, 
          message: text, 
          response: response 
        })
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsChatTyping(false);
    }
  };

  const openLesson = async (lesson: Lesson) => {
    setCurrentLesson(lesson);
    const parsedScript = JSON.parse(lesson.script || "[]");
    setScript(parsedScript);
    setCurrentStepIndex(0);
    setNotes(null);
    setChatMessages([]);
    
    // Fetch chat history
    const res = await fetch(`/api/chat/${lesson.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const history = await res.json();
      setChatMessages(history.map((h: any) => ([
        { id: `u-${h.id}`, text: h.message, sender: 'user' },
        { id: `a-${h.id}`, text: h.response, sender: 'ai' }
      ])).flat());
    }

    setView('lesson');
    if (parsedScript.length > 0) playStep(parsedScript[0]);
  };

  // --- Render Helpers ---
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-emerald-500/20">
            <GraduationCap size={48} className="text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">AI SmartBoard Tutor</h1>
          <p className="text-slate-400 text-lg max-w-md mx-auto">Your personal animated AI teacher for interactive learning and exam preparation.</p>
        </motion.div>

        <button
          onClick={() => login('mock-google-token')}
          className="bg-white text-slate-900 px-8 py-4 rounded-full font-bold flex items-center gap-3 hover:bg-slate-100 transition-all shadow-xl"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Sign in with Google
        </button>
        
        <p className="mt-8 text-slate-500 text-sm">Demo Mode: Click to enter as a guest</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
            <GraduationCap className="text-emerald-400" size={28} />
            <span className="font-bold text-xl tracking-tight">SmartBoard AI</span>
          </div>

          <div className="flex items-center gap-6">
            <button 
              onClick={() => setView('dashboard')}
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${view === 'dashboard' ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>
            <div className="h-6 w-px bg-slate-800" />
            <div className="flex items-center gap-3">
              <img src={user?.profileImage || "https://picsum.photos/seed/user/100/100"} className="w-8 h-8 rounded-full border border-slate-700" alt="Profile" />
              <div className="hidden sm:block">
                <p className="text-xs font-semibold">{user?.name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">Student</p>
              </div>
              <button onClick={logout} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Welcome back, {user?.name?.split(' ')[0]}!</h2>
                  <p className="text-slate-400">Ready to master a new topic today?</p>
                </div>
                <button
                  onClick={() => setView('creator')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all"
                >
                  <Plus size={20} />
                  New Lesson
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lessons.map((lesson) => (
                  <motion.div
                    key={lesson.id}
                    whileHover={{ y: -4 }}
                    onClick={() => openLesson(lesson)}
                    className="bg-slate-800/40 border border-slate-700 p-6 rounded-2xl cursor-pointer hover:border-emerald-500/50 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-slate-700/50 rounded-xl text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                        <BookOpen size={24} />
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <Clock size={12} />
                        {new Date(lesson.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-2 line-clamp-1">{lesson.topic}</h3>
                    <p className="text-slate-400 text-sm mb-6 line-clamp-2">
                      {lesson.content ? lesson.content.substring(0, 100) + '...' : 'Interactive AI-generated lesson.'}
                    </p>
                    <div className="flex items-center text-emerald-400 text-sm font-bold gap-1 group-hover:gap-2 transition-all">
                      Resume Lesson
                      <ChevronRight size={16} />
                    </div>
                  </motion.div>
                ))}
                {lessons.length === 0 && (
                  <div className="col-span-full py-20 text-center bg-slate-800/20 rounded-3xl border-2 border-dashed border-slate-800">
                    <BookOpen size={48} className="mx-auto mb-4 text-slate-700" />
                    <p className="text-slate-500">No lessons yet. Start your first one!</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'creator' && (
            <motion.div
              key="creator"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-12"
            >
              <div className="text-center mb-12">
                <h2 className="text-4xl font-bold mb-4">Create Your Lesson</h2>
                <p className="text-slate-400">Choose a topic or upload a PDF to begin your personalized learning journey.</p>
              </div>
              <LessonCreator onCreateLesson={handleCreateLesson} isLoading={isLoading} />
            </motion.div>
          )}

          {view === 'lesson' && currentLesson && (
            <motion.div
              key="lesson"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-12 gap-6 h-[calc(100vh-160px)]"
            >
              {/* Left Column: Teacher & Chat */}
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">AI Teacher Live</span>
                  </div>
                  <TeacherAvatar isSpeaking={isSpeaking} action={script[currentStepIndex]?.action || 'idle'} />
                  <div className="mt-4 text-center">
                    <p className="text-sm text-slate-300 italic line-clamp-2 min-h-[40px]">
                      "{script[currentStepIndex]?.speech}"
                    </p>
                  </div>
                </div>
                
                <div className="flex-1 min-h-0">
                  <ChatPanel 
                    messages={chatMessages} 
                    onSendMessage={handleSendMessage} 
                    isTyping={isChatTyping} 
                  />
                </div>
              </div>

              {/* Right Column: SmartBoard & Notes */}
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
                <div className="flex-1 min-h-0 relative">
                  <SmartBoard 
                    content={script[currentStepIndex]?.board || ""} 
                    isWriting={script[currentStepIndex]?.action === 'writing'} 
                  />
                  
                  {/* Controls */}
                  <div className="absolute bottom-6 right-6 flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-mono">
                      Step {currentStepIndex + 1} of {script.length}
                    </span>
                    <button
                      onClick={nextStep}
                      disabled={currentStepIndex === script.length - 1 && !!notes}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-full font-bold shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      {currentStepIndex === script.length - 1 ? 'Finish Lesson' : 'Next Step'}
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>

                {notes && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: '300px', opacity: 1 }}
                    className="h-[300px]"
                  >
                    <NotesPanel notes={notes} topic={currentLesson.topic} />
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Styles for Scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
}
