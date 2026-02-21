import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateLessonScript = async (topic: string, content?: string) => {
  const model = "gemini-3-flash-preview";
  const prompt = `You are a professional, friendly AI teacher. 
  Topic: ${topic}
  ${content ? `Context from PDF: ${content}` : ""}
  
  Create a teaching script for a classroom lesson. 
  The script should be a sequence of "steps". 
  Each step has:
  1. "speech": What the teacher says.
  2. "board": What appears on the smartboard (Markdown supported).
  3. "action": One of ["explaining", "writing", "pointing", "idle"].
  
  Format the output as a JSON array of steps.
  Make it engaging, clear, and educational.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            speech: { type: Type.STRING },
            board: { type: Type.STRING },
            action: { type: Type.STRING },
          },
          required: ["speech", "board", "action"],
        },
      },
    },
  });

  return JSON.parse(response.text || "[]");
};

export const askTeacher = async (lessonContext: string, question: string, history: {role: string, text: string}[]) => {
  const model = "gemini-3-flash-preview";
  
  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction: `You are the AI teacher for this lesson. 
      Lesson Context: ${lessonContext}
      Answer student doubts clearly and concisely. Stay in character as a helpful teacher.`,
    }
  });

  // Convert history to Gemini format
  const contents = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.text }]
  }));

  const response = await ai.models.generateContent({
    model,
    contents: [
      ...contents,
      { role: 'user', parts: [{ text: question }] }
    ]
  });

  return response.text;
};

export const generateNotes = async (lessonContent: string) => {
  const model = "gemini-3-flash-preview";
  const prompt = `Based on the following lesson content, generate a comprehensive summary and exam notes.
  Use Markdown formatting with clear headings, bullet points, and key terms.
  
  Content: ${lessonContent}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
};
