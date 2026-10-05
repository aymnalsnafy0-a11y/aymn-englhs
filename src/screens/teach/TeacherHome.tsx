import { Button, Card, Screen } from '../../components/ui'
import { useCloudStatus } from '../../data/cloud'
import { myTeacherClasses } from '../../data/classroom'
import { allClasses, listTeachers, useProfile } from '../../data/roles'
import { roster } from '../../data/roster'
import { useAsync } from '../../lib/useAsync'
import { StudentStatus } from './StudentsScreen'
import { SharedCard } from './Teachers'

/** الرئيسية للمعلم والمالك: نظرة عامة، من يحتاج متابعة، واختصارات. */
export function TeacherHome({
  go,
  openStudent,
  learn,
}: {
  go: (tab: 'classes' | 'students' | 'teachers') => void
  openStudent: (code: string) => void
  learn: () => void
}) {
  const cloud = useCloudStatus()
  const { profile } = useProfile()
  const owner = !!profile?.owner
  const name = cloud.name || profile?.teacherName || (cloud.email ?? '').split('@')[0]
  const data = useAsync(async () => {
    const [list, classes, teachers] = await Promise.all([
      roster(owner ? '*' : undefined),
      owner ? allClasses() : myTeacherClasses(),
      owner ? listTeachers() : Promise.resolve([]),
    ])
    return { list, classes, teachers }
  }, [owner])

  const d = data.data
  const linked = d?.list.filter((e) => e.student) ?? []
  const waiting = d?.list.filter((e) => !e.student) ?? []
  // يحتاجون متابعة: لم يدخلوا منذ 3 أيام أو أكثر، أو لم يبدؤوا.
  const behind = linked
    .filter((e) => !e.student!.lastSeen || Date.now() - e.student!.lastSeen >= 3 * 864e5)
    .sort((a, b) => (a.student!.lastSeen ?? 0) - (b.student!.lastSeen ?? 0))

  return (
    <Screen>
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">{owner ? 'لوحة المالك' : 'لوحة المعلم'}</p>
          <h1 className="text-2xl font-bold [overflow-wrap:anywhere]">أهلًا {name} 👋</h1>
        </div>
        <Button variant="secondary" className="shrink-0 min-h-9 text-sm" onClick={learn}>
          تعلّمي ←
        </Button>
      </header>

      {profile?.teacher && !owner && profile.teacherExpiresAt !== null && (
        <p className="mb-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          صلاحيتك كمعلم حتى {new Date(profile.teacherExpiresAt).toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      <div className={`mb-4 grid gap-2 text-center ${owner ? 'grid-cols-4' : 'grid-cols-3'}`}>
        {[
          { n: linked.length, label: 'طالب', tab: 'students' as const },
          { n: d?.classes.length ?? 0, label: 'فصل', tab: 'classes' as const },
          { n: waiting.length, label: 'لم يدخل بعد', tab: 'students' as const },
          ...(owner ? [{ n: d?.teachers.length ?? 0, label: 'معلم', tab: 'teachers' as const }] : []),
        ].map((x) => (
          <button key={x.label} type="button" onClick={() => go(x.tab)} className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 hover:ring-teal-600 dark:bg-slate-900 dark:ring-slate-800">
            <p className="text-2xl font-bold tabular-nums text-teal-700 dark:text-teal-400">{d ? x.n : '…'}</p>
            <p className="text-xs text-slate-500">{x.label}</p>
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Button onClick={() => go('students')}>+ طالب جديد</Button>
        <Button variant="secondary" onClick={() => go('classes')}>
          + فصل جديد
        </Button>
      </div>

      <Card className="mb-4">
        <h2 className="mb-2 font-bold">يحتاجون متابعة</h2>
        {!d ? (
          <p className="text-sm text-slate-500">جارٍ التحميل…</p>
        ) : behind.length === 0 ? (
          <p className="text-sm text-slate-500">{linked.length ? '👏 كل طلابك نشطون هذه الأيام.' : 'أضف طلابك من «طالب جديد» وأرسل لكل واحد رمزه.'}</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {behind.slice(0, 6).map((e) => (
              <li key={e.code.code}>
                <button
                  type="button"
                  onClick={() => openStudent(e.code.code)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-start odd:bg-slate-50 hover:bg-slate-100 dark:odd:bg-slate-800/50"
                >
                  <span className="font-medium">{e.code.name}</span>
                  <StudentStatus e={e} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {owner && <SharedCard />}
    </Screen>
  )
}
