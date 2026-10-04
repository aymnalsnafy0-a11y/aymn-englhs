/**
 * نفس مشروع Firebase الذي يستخدمه موقع «دروس الصينية» (حساب واحد للموقعين).
 * إعدادات الويب هذه عامة بطبيعتها؛ الحماية في قواعد Firestore (كل متعلم يقرأ ويكتب بياناته فقط).
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAcA8JJ43RIg7o3lrv5mK_5DUVzxCPNG3Y',
  authDomain: 'chinese-lessons-38ce0.firebaseapp.com',
  projectId: 'chinese-lessons-38ce0',
  storageBucket: 'chinese-lessons-38ce0.firebasestorage.app',
  messagingSenderId: '105280877994',
  appId: '1:105280877994:web:34aa1a15b26cb8b36e67d3',
}

/** مستندات الإنجليزي داخل learners/{uid}/state/ — منفصلة عن مستند الصيني «main». */
export const DOCS = {
  core: 'english',
  progress: 'english-progress',
  stories: 'english-stories',
  wordlist: 'english-wordlist',
} as const
