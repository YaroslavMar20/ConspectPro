import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  where, 
  orderBy,
  getDoc,
  or
} from 'firebase/firestore';
import { db, handleFirestoreError } from './firebase';
import { Note, NoteSize, OperationType } from '../types';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';

const NOTES_COLLECTION = 'notes';

export const createNote = async (ownerId: string, topic?: string, size?: NoteSize) => {
  const path = NOTES_COLLECTION;
  try {
    const docRef = await addDoc(collection(db, path), {
      title: topic || 'Новый конспект',
      content: '',
      ownerId,
      collaboratorEmails: [],
      topic: topic || '',
      targetSize: size || NoteSize.MEDIUM,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateNote = async (noteId: string, updates: Partial<Note>) => {
  const path = `${NOTES_COLLECTION}/${noteId}`;
  try {
    const docRef = doc(db, NOTES_COLLECTION, noteId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteNote = async (noteId: string) => {
  const path = `${NOTES_COLLECTION}/${noteId}`;
  try {
    await deleteDoc(doc(db, NOTES_COLLECTION, noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const subscribeToNotes = (userId: string, email: string, callback: (notes: Note[]) => void) => {
  const q = query(
    collection(db, NOTES_COLLECTION),
    or(
      where('ownerId', '==', userId),
      where('collaboratorEmails', 'array-contains', email)
    ),
    orderBy('updatedAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Note)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, NOTES_COLLECTION);
  });
};

export const subscribeToNote = (noteId: string, callback: (note: Note | null) => void) => {
  const path = `${NOTES_COLLECTION}/${noteId}`;
  return onSnapshot(doc(db, NOTES_COLLECTION, noteId), (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as Note);
    } else {
      callback(null);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

// Simplified HTML to Docx conversion
export const exportToWord = async (note: Note) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = note.content;
  
  const children = Array.from(tempDiv.childNodes);
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: note.title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 400 }
    })
  ];

  children.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      let text = el.innerText || '';
      let heading;
      
      switch(el.tagName) {
        case 'H1': heading = HeadingLevel.HEADING_1; break;
        case 'H2': heading = HeadingLevel.HEADING_2; break;
        case 'H3': heading = HeadingLevel.HEADING_3; break;
      }

      paragraphs.push(new Paragraph({
        children: [new TextRun(text)],
        heading: heading,
        spacing: { after: 200 }
      }));
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        paragraphs.push(new Paragraph({
          children: [new TextRun(text)],
          spacing: { after: 200 }
        }));
      }
    }
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${note.title || 'conspect'}.docx`);
};
