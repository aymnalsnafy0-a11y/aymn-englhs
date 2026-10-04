/**
 * اختبارات قواعد Firestore على المحاكي (لا تمس مشروع Firebase الحقيقي):
 *   npm run test:rules
 */
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'siyaq-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  })
})
afterAll(() => env.cleanup())

const as = (uid: string) => env.authenticatedContext(uid).firestore()
const anon = () => env.unauthenticatedContext().firestore()

beforeEach(async () => {
  await env.clearFirestore()
  // فصل للمدرس t1 فيه الطالب s1 وواجب واحد ونتيجة للطالب s1.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'classes/ABC123'), { name: 'فصل أ', teacherUid: 't1', teacherName: 'أ. أيمن' })
    await setDoc(doc(db, 'classes/ABC123/members/s1'), { name: 'سارة' })
    await setDoc(doc(db, 'classes/ABC123/assignments/a1'), { title: 'العائلة', words: [] })
    await setDoc(doc(db, 'classes/ABC123/assignments/a1/results/s1'), { score: 4, total: 5 })
    await setDoc(doc(db, 'classes/ZZZ999'), { name: 'فصل آخر', teacherUid: 't2' })
  })
})

describe('private learner data', () => {
  it('only the owner reads and writes it', async () => {
    await assertSucceeds(setDoc(doc(as('s1'), 'learners/s1/state/english'), { payload: '{}' }))
    await assertSucceeds(getDoc(doc(as('s1'), 'learners/s1/state/english')))
    await assertFails(getDoc(doc(as('s2'), 'learners/s1/state/english')))
    await assertFails(setDoc(doc(as('t1'), 'learners/s1/state/english'), { payload: '{}' }))
    await assertFails(getDoc(doc(anon(), 'learners/s1/state/english')))
  })
})

describe('classes', () => {
  it('a teacher creates a class only in their own name', async () => {
    await assertSucceeds(setDoc(doc(as('t1'), 'classes/NEW111'), { name: 'جديد', teacherUid: 't1' }))
    await assertFails(setDoc(doc(as('t1'), 'classes/NEW222'), { name: 'مزيّف', teacherUid: 't2' }))
    await assertFails(setDoc(doc(anon(), 'classes/NEW333'), { name: 'x', teacherUid: 'x' }))
  })

  it('anyone signed in can open a class by its code, but only the teacher lists their classes', async () => {
    await assertSucceeds(getDoc(doc(as('s9'), 'classes/ABC123')))
    await assertFails(getDoc(doc(anon(), 'classes/ABC123')))
    await assertSucceeds(getDocs(query(collection(as('t1'), 'classes'), where('teacherUid', '==', 't1'))))
    await assertFails(getDocs(collection(as('s1'), 'classes')))
    await assertFails(getDocs(query(collection(as('t1'), 'classes'), where('teacherUid', '==', 't2'))))
  })

  it('only the teacher edits or deletes the class, and cannot hand it to someone else', async () => {
    await assertSucceeds(setDoc(doc(as('t1'), 'classes/ABC123'), { name: 'فصل أ ٢', teacherUid: 't1' }))
    await assertFails(setDoc(doc(as('t1'), 'classes/ABC123'), { name: 'x', teacherUid: 's1' }))
    await assertFails(setDoc(doc(as('s1'), 'classes/ABC123'), { name: 'x', teacherUid: 's1' }))
    await assertFails(deleteDoc(doc(as('s1'), 'classes/ABC123')))
  })
})

describe('members', () => {
  it('a student joins only as themself', async () => {
    await assertSucceeds(setDoc(doc(as('s2'), 'classes/ABC123/members/s2'), { name: 'علي' }))
    await assertFails(setDoc(doc(as('s2'), 'classes/ABC123/members/s3'), { name: 'منتحل' }))
  })

  it('students cannot see the member list; the teacher can, and can remove a student', async () => {
    await assertFails(getDocs(collection(as('s1'), 'classes/ABC123/members')))
    await assertSucceeds(getDoc(doc(as('s1'), 'classes/ABC123/members/s1')))
    await assertSucceeds(getDocs(collection(as('t1'), 'classes/ABC123/members')))
    await assertFails(getDocs(collection(as('t2'), 'classes/ABC123/members')))
    await assertSucceeds(deleteDoc(doc(as('t1'), 'classes/ABC123/members/s1')))
  })
})

describe('assignments and results', () => {
  it('members and the teacher read assignments; outsiders cannot', async () => {
    await assertSucceeds(getDocs(collection(as('s1'), 'classes/ABC123/assignments')))
    await assertSucceeds(getDocs(collection(as('t1'), 'classes/ABC123/assignments')))
    await assertFails(getDocs(collection(as('s9'), 'classes/ABC123/assignments')))
    await assertFails(getDocs(collection(as('t2'), 'classes/ABC123/assignments')))
  })

  it('only the teacher creates assignments', async () => {
    await assertSucceeds(setDoc(doc(as('t1'), 'classes/ABC123/assignments/a2'), { title: 'جديد', words: [] }))
    await assertFails(setDoc(doc(as('s1'), 'classes/ABC123/assignments/a3'), { title: 'غش', words: [] }))
  })

  it('a student writes and reads only their own result', async () => {
    await assertSucceeds(setDoc(doc(as('s1'), 'classes/ABC123/assignments/a1/results/s1'), { score: 5, total: 5 }))
    await assertFails(setDoc(doc(as('s1'), 'classes/ABC123/assignments/a1/results/s2'), { score: 0, total: 5 }))
    await assertFails(setDoc(doc(as('s9'), 'classes/ABC123/assignments/a1/results/s9'), { score: 5, total: 5 }))
    await assertSucceeds(getDoc(doc(as('s1'), 'classes/ABC123/assignments/a1/results/s1')))
  })

  it("students cannot see classmates' results; the teacher sees all", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'classes/ABC123/members/s2'), { name: 'علي' })
    })
    await assertFails(getDoc(doc(as('s2'), 'classes/ABC123/assignments/a1/results/s1')))
    await assertFails(getDocs(collection(as('s2'), 'classes/ABC123/assignments/a1/results')))
    await assertSucceeds(getDocs(collection(as('t1'), 'classes/ABC123/assignments/a1/results')))
  })
})
