import { describe, expect, it } from 'vitest'
import { assignmentReport, assignmentState, formatCode, generateCode, nextResult, normalizeCode, studentHomework, type Assignment } from './classroom'
import { seededRng } from './quiz'

const dayOf = (ts: number) => new Date(ts).toISOString().slice(0, 10)
const at = (day: string) => Date.parse(`${day}T12:00:00Z`)

describe('codes', () => {
  it('generates readable 6-char codes without ambiguous letters', () => {
    const code = generateCode(seededRng(1))
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    expect(formatCode('ABC234')).toBe('ABC-234')
  })
  it('normalizes what students type', () => {
    expect(normalizeCode('abc-234')).toBe('ABC234')
    expect(normalizeCode(' AbC 234 ')).toBe('ABC234')
    expect(normalizeCode('ABC23')).toBeNull()
    expect(normalizeCode('ABC10Z')).toBeNull() // 1 و0 ليست في الأبجدية
  })
  it('handles the longer teacher codes', () => {
    const code = generateCode(seededRng(2), 8)
    expect(code).toHaveLength(8)
    expect(formatCode('ABCD2345')).toBe('ABCD-2345')
    expect(normalizeCode('abcd-2345', 8)).toBe('ABCD2345')
    expect(normalizeCode('ABC-234', 8)).toBeNull()
  })
})

describe('assignment state', () => {
  const a = { dueAt: '2026-10-10' }
  it('todo, overdue, done, late', () => {
    expect(assignmentState(a, undefined, '2026-10-09', dayOf)).toBe('todo')
    expect(assignmentState(a, undefined, '2026-10-11', dayOf)).toBe('overdue')
    expect(assignmentState(a, { completedAt: at('2026-10-10') }, '2026-10-12', dayOf)).toBe('done')
    expect(assignmentState(a, { completedAt: at('2026-10-12') }, '2026-10-12', dayOf)).toBe('late')
    expect(assignmentState({}, undefined, '2030-01-01', dayOf)).toBe('todo')
  })
})

describe('report', () => {
  const a: Assignment = { id: 'a1', title: 'العائلة', words: [], createdAt: 0, dueAt: '2026-10-10' }
  const members = [
    { uid: 's1', name: 'سارة' },
    { uid: 's2', name: 'علي' },
    { uid: 's3', name: 'منى' },
  ]
  const results = [
    { uid: 's1', name: 'سارة', score: 4, total: 5, wrong: ['brother'], completedAt: at('2026-10-09'), attempts: 1, best: 4 },
    { uid: 's2', name: 'علي', score: 2, total: 5, wrong: ['brother', 'sister', 'aunt'], wrongQ: [3, 1], completedAt: at('2026-10-11'), attempts: 2, best: 3 },
    { uid: 's4', name: 'خالد (غادر)', score: 5, total: 5, wrong: [], completedAt: at('2026-10-08'), attempts: 1, best: 5 },
  ]
  const r = assignmentReport(a, members, results, '2026-10-12', dayOf)

  it('counts who finished and averages their scores', () => {
    expect(r.done).toBe(3)
    expect(r.members).toBe(4)
    expect(r.average).toBe(Math.round((80 + 40 + 100) / 3))
  })
  it('puts students who still owe work first', () => {
    expect(r.rows.map((x) => [x.name, x.state])).toEqual([
      ['منى', 'overdue'],
      ['علي', 'late'],
      ['خالد (غادر)', 'done'],
      ['سارة', 'done'],
    ])
  })
  it('ranks the most-missed words and lesson questions', () => {
    expect(r.missed[0]).toEqual({ word: 'brother', count: 2 })
    expect(r.missed).toHaveLength(3)
    expect(r.missedQuestions).toEqual([
      { index: 1, count: 1 },
      { index: 3, count: 1 },
    ])
  })
})

describe('nextResult', () => {
  it('keeps the latest attempt, the best score and the attempt count', () => {
    const first = nextResult(undefined, { uid: 's', name: 'س', score: 3, total: 5, wrong: ['x'], completedAt: 1 })
    const second = nextResult(first, { uid: 's', name: 'س', score: 2, total: 5, wrong: ['x', 'y'], completedAt: 2 })
    expect(second).toMatchObject({ score: 2, best: 3, attempts: 2 })
  })
})

describe('studentHomework', () => {
  const a1: Assignment = { id: 'a1', title: 'العائلة', words: [], createdAt: 0, dueAt: '2026-10-10' }
  const a2: Assignment = { id: 'a2', title: 'درس الزوم', words: [], createdAt: 1 }
  const results = {
    a1: [{ uid: 's1', name: 'سارة', score: 3, total: 4, wrong: [], completedAt: at('2026-10-09'), attempts: 1, best: 3 }],
    a2: [],
  }
  it('summarizes one student across all assignments', () => {
    const hw = studentHomework('s1', [a1, a2], results, '2026-10-12', dayOf)
    expect(hw.done).toBe(1)
    expect(hw.total).toBe(2)
    expect(hw.average).toBe(75)
    expect(hw.items.map((i) => [i.title, i.state, i.score])).toEqual([
      ['العائلة', 'done', 3],
      ['درس الزوم', 'todo', undefined],
    ])
  })
  it('has no average before any submission', () => {
    expect(studentHomework('s9', [a1], results, '2026-10-12', dayOf).average).toBeNull()
  })
})
