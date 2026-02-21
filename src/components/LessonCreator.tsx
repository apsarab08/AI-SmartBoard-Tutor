import React, { useState } from 'react';
import { Upload, BookOpen, Sparkles, FileText } from 'lucide-react';
import { motion } from 'motion/react';

interface LessonCreatorProps {
  onCreateLesson: (topic: string, file?: File) => void;
  isLoading: boolean;
}

export const LessonCreator: React.FC<LessonCreatorProps> = ({ onCreateLesson, isLoading }) => {
  const [topic, setTopic] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'topic' | 'pdf'>('topic');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'topic' && topic.trim()) {
      onCreateLesson(topic);
    } else if (mode === 'pdf' && file) {
      onCreateLesson(topic || file.name, file);
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-slate-800/50 p-8 rounded-2xl border border-slate-700 shadow-xl">
      <div className="flex gap-4 mb-8">
        <button
          onClick={() => setMode('topic')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
            mode === 'topic' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          <Sparkles size={18} />
          Topic Mode
        </button>
        <button
          onClick={() => setMode('pdf')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
            mode === 'pdf' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          <FileText size={18} />
          PDF Mode
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">
            {mode === 'topic' ? 'What do you want to learn today?' : 'Lesson Topic (Optional)'}
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={mode === 'topic' ? "e.g. Quantum Physics for Beginners" : "e.g. History of Rome"}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl py-3 px-4 text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
            required={mode === 'topic'}
          />
        </div>

        {mode === 'pdf' && (
          <div className="relative">
            <label className="block text-sm font-medium text-slate-400 mb-2">Upload Study Material</label>
            <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              file ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-700 hover:border-slate-600'
            }`}>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className={`mx-auto mb-4 ${file ? 'text-emerald-400' : 'text-slate-500'}`} size={32} />
              <p className="text-sm text-slate-400">
                {file ? file.name : 'Drag and drop your PDF here or click to browse'}
              </p>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || (mode === 'topic' && !topic) || (mode === 'pdf' && !file)}
          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <Sparkles size={20} />
            </motion.div>
          ) : (
            <BookOpen size={20} />
          )}
          {isLoading ? 'AI Teacher Preparing Lesson...' : 'Start Learning Session'}
        </button>
      </form>
    </div>
  );
};
