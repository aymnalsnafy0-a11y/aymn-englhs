/**
 * اختبارات قواعد Firestore على المحاكي (لا تمس مشروع Firebase الحقيقي):
 *   npm run test:rules
 */
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore'
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
    await setDoc(doc(db, 'owners/o1'), { role: 'owner' })
    await setDoc(doc(db, 'teachers/t1'), { name: 'أ. أيمن' })
    await setDoc(doc(db, 'teachers/t2'), { name: 'أ. سالم' })
    await setDoc(doc(db, 'teacherInvites/FREE2345'), { label: 'معلم جديد', usedBy: null, days: 0 })
    await setDoc(doc(db, 'teacherInvites/MNTH2345'), { label: 'شهر', usedBy: null, days: 30 })
    await setDoc(doc(db, 'teachers/old1'), { name: 'منتهي', expiresAt: Timestamp.fromMillis(Date.now() - 864e5) })
    await setDoc(doc(db, 'classes/OLD111'), { name: 'فصل المنتهي', teacherUid: 'old1' })
    await setDoc(doc(db, 'teacherInvites/USED2345'), { label: 'مستخدم', usedBy: 't2' })
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

const days = (n: number) => Timestamp.fromMillis(Date.now() + n * 864e5)
const redeem = (uid: string, code: string, expiresAt: Timestamp | null = null) => {
  const db = as(uid)
  const batch = writeBatch(db)
  batch.set(doc(db, `teachers/${uid}`), { name: 'معلم', invite: code, expiresAt })
  batch.update(doc(db, `teacherInvites/${code}`), { usedBy: uid, usedName: 'معلم', usedAt: 1 })
  return batch.commit()
}

describe('roles', () => {
  it('nobody can make themself an owner from the site', async () => {
    await assertFails(setDoc(doc(as('x1'), 'owners/x1'), { role: 'owner' }))
    await assertSucceeds(getDoc(doc(as('o1'), 'owners/o1')))
    await assertFails(getDoc(doc(as('x1'), 'owners/o1')))
  })

  it('only the owner creates and lists teacher codes', async () => {
    await assertSucceeds(setDoc(doc(as('o1'), 'teacherInvites/NEWC2345'), { label: 'x', usedBy: null, days: 60 }))
    await assertFails(setDoc(doc(as('o1'), 'teacherInvites/NEWE2345'), { label: 'x', usedBy: null }))
    await assertFails(setDoc(doc(as('t1'), 'teacherInvites/NEWD2345'), { label: 'x', usedBy: null, days: 0 }))
    await assertSucceeds(getDocs(collection(as('o1'), 'teacherInvites')))
    await assertFails(getDocs(collection(as('t1'), 'teacherInvites')))
    await assertSucceeds(getDoc(doc(as('s9'), 'teacherInvites/FREE2345')))
  })

  it('a valid unused code makes you a teacher, once', async () => {
    await assertSucceeds(redeem('n1', 'FREE2345'))
    await assertFails(redeem('n2', 'FREE2345'))
    await assertFails(redeem('n3', 'USED2345'))
    await assertFails(redeem('n4', 'NOPE2345'))
  })

  it('a timed code cannot grant more time than the owner set', async () => {
    await assertFails(redeem('m1', 'MNTH2345', null))
    await assertFails(redeem('m1', 'MNTH2345', days(90)))
    await assertSucceeds(redeem('m1', 'MNTH2345', days(30)))
  })

  it('a teacher cannot extend their own time; the owner can', async () => {
    await assertFails(updateDoc(doc(as('old1'), 'teachers/old1'), { expiresAt: days(365) }))
    await assertSucceeds(updateDoc(doc(as('old1'), 'teachers/old1'), { name: 'اسم جديد' }))
    await assertSucceeds(updateDoc(doc(as('o1'), 'teachers/old1'), { expiresAt: days(30) }))
    await assertSucceeds(getDocs(collection(as('old1'), 'classes/OLD111/members')))
  })

  it('an expired teacher loses their classes and cannot create new ones, until renewed with a new code', async () => {
    await assertFails(getDocs(collection(as('old1'), 'classes/OLD111/members')))
    await assertFails(setDoc(doc(as('old1'), 'classes/NEW777'), { name: 'x', teacherUid: 'old1' }))
    await assertSucceeds(redeem('old1', 'MNTH2345', days(30)))
    await assertSucceeds(getDocs(collection(as('old1'), 'classes/OLD111/members')))
  })

  it('becoming a teacher without a code, or marking a code without becoming a teacher, fails', async () => {
    await assertFails(setDoc(doc(as('n5'), 'teachers/n5'), { name: 'منتحل', invite: 'FREE2345' }))
    await assertFails(updateDoc(doc(as('n6'), 'teacherInvites/FREE2345'), { usedBy: 'n6' }))
    await assertFails(setDoc(doc(as('n7'), 'teachers/n7'), { name: 'x' }))
  })

  it('the owner lists and revokes teachers; a revoked teacher loses the class', async () => {
    await assertSucceeds(getDocs(collection(as('o1'), 'teachers')))
    await assertFails(getDocs(collection(as('t1'), 'teachers')))
    await assertSucceeds(deleteDoc(doc(as('o1'), 'teachers/t1')))
    await assertFails(getDocs(collection(as('t1'), 'classes/ABC123/members')))
    await assertFails(setDoc(doc(as('t1'), 'classes/NEW444'), { name: 'جديد', teacherUid: 't1' }))
  })

  it('the owner sees every class and its results', async () => {
    await assertSucceeds(getDocs(collection(as('o1'), 'classes')))
    await assertSucceeds(getDocs(collection(as('o1'), 'classes/ABC123/members')))
    await assertSucceeds(getDocs(collection(as('o1'), 'classes/ABC123/assignments/a1/results')))
  })
})

describe('classes', () => {
  it('a teacher creates a class only in their own name; students cannot create classes', async () => {
    await assertSucceeds(setDoc(doc(as('t1'), 'classes/NEW111'), { name: 'جديد', teacherUid: 't1' }))
    await assertFails(setDoc(doc(as('t1'), 'classes/NEW222'), { name: 'مزيّف', teacherUid: 't2' }))
    await assertFails(setDoc(doc(anon(), 'classes/NEW333'), { name: 'x', teacherUid: 'x' }))
    await assertFails(setDoc(doc(as('s1'), 'classes/NEW555'), { name: 'x', teacherUid: 's1' }))
    await assertSucceeds(setDoc(doc(as('o1'), 'classes/NEW666'), { name: 'فصل المالك', teacherUid: 'o1' }))
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
