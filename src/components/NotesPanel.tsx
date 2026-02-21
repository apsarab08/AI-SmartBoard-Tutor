import React from 'react';
import { Download, FileText, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';

interface NotesPanelProps {
  notes: string;
  topic: string;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({ notes, topic }) => {
  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(topic, 20, 20);
    doc.setFontSize(12);
    
    const splitText = doc.splitTextToSize(notes, 170);
    doc.text(splitText, 20, 40);
    doc.save(`${topic.replace(/\s+/g, '_')}_notes.pdf`);
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-700 bg-slate-800/80 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <FileText size={16} className="text-emerald-400" />
          Exam Notes
        </h3>
        <button
          onClick={downloadPDF}
          className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <Download size={14} />
          Download PDF
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 prose prose-invert prose-sm max-w-none custom-scrollbar">
        <ReactMarkdown>{notes}</ReactMarkdown>
      </div>
    </div>
  );
};
