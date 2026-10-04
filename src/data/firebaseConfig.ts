/**
 * مشروع Firebase الخاص بالإنجليزي (engle-e9877) — منفصل عن موقع الصيني.
 * إعدادات الويب هذه عامة بطبيعتها؛ الحماية في قواعد Firestore (كل متعلم يقرأ ويكتب بياناته فقط).
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyB7wLiZDjb1oXX8NjBD5p_19K96Kyfbs7I',
  authDomain: 'engle-e9877.firebaseapp.com',
  projectId: 'engle-e9877',
  storageBucket: 'engle-e9877.firebasestorage.app',
  messagingSenderId: '829672151254',
  appId: '1:829672151254:web:42fa3c8cecceb54bf85177',
}

/** مستندات المتعلم داخل learners/{uid}/state/. */
export const DOCS = {
  core: 'english',
  progress: 'english-progress',
  stories: 'english-stories',
  wordlist: 'english-wordlist',
} as const
