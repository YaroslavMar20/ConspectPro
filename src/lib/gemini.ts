import { GoogleGenAI } from "@google/genai";
import { NoteSize } from "../types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. AI features will be disabled.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export async function generateConspect(topic: string, size: NoteSize, language: string = 'ru', useSearch: boolean = false) {
  const ai = getAI();
  if (!ai) throw new Error("API_KEY_MISSING");

  const model = "gemini-1.5-flash";
  const langName = language === 'ru' ? 'Русский' : language === 'en' ? 'English' : language === 'fr' ? 'Français' : '中文';
  
  const sizeDesc = {
    [NoteSize.SHORT]: "Краткий обзор (около 500 слов), только основные тезисы.",
    [NoteSize.MEDIUM]: "Средний объем (около 1500 слов), подробное раскрытие ключевых моментов.",
    [NoteSize.LONG]: "Развернутая работа (от 3000 слов), глубокий анализ, примеры, подпункты и выводы."
  }[size];

  const prompt = `Ты — профессиональный академический помощник. Твоя задача — составить качественную учебную работу (конспект/реферат) на тему: "${topic}".
  
  Требования к работе:
  1. Язык: ${langName}.
  2. Объем/Глубина: ${sizeDesc}.
  3. Структура: Используй четкую иерархию. Обязательно начни с введения, затем разделы с подзаголовками, и закончи заключением или резюме.
  4. Форматирование: Используй СТРОГО только HTML-тэги (<h1>, <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <blockquote>). НЕ используй Markdown (например, ## или **).
  5. Стиль: Академический, объективный, профессиональный, но понятный.
  ${useSearch ? '6. Использование данных: Используй Google Поиск для получения самой свежей и актуальной информации по теме.' : ''}
  
  Важно: Текст должен выглядеть как готовая завершенная работа, которую можно сразу использовать для учебы.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: useSearch ? [{ googleSearch: {} }] : undefined
      }
    });
    
    if (!response || !response.text) {
      console.error("Gemini Response structure:", response);
      throw new Error("No text returned from Gemini. Model may be busy or restricted in your region.");
    }
    
    return response.text;
  } catch (error: any) {
    console.error("Gemini generation error details:", error);
    if (error?.message?.includes("API_KEY_INVALID")) {
      throw new Error("Invalid Gemini API Key. Please verify your environment variables.");
    }
    throw error;
  }
}

export async function rephraseSelection(text: string, instruction: string) {
  const ai = getAI();
  if (!ai) throw new Error("API_KEY_MISSING");

  const model = "gemini-1.5-flash";
  const prompt = `Перефразируй или измени следующий текст согласно инструкции.
  Инструкция: ${instruction}
  Текст: "${text}"
  Верни только измененный текст без комментариев.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini rephrase error:", error);
    throw error;
  }
}

export async function checkPlagiarism(content: string) {
  const ai = getAI();
  if (!ai) throw new Error("API_KEY_MISSING");

  const model = "gemini-1.5-flash";
  const prompt = `Проверь следующий текст на уникальность и антиплагиат. 
  Оцени уровень оригинальности в процентах (0-100) и дай краткий комментарий, если текст кажется заимствованным.
  Текст: "${content.substring(0, 5000)}" 
  Верни JSON с полями: score (number), feedback (string).`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini plagiarism check error:", error);
    throw error;
  }
}
