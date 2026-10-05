import { Card, Screen } from '../../components/ui'
import { useCloudStatus } from '../../data/cloud'
import { useProfile } from '../../data/roles'
import { TeacherSection } from '../classes/Classes'

/** الرئيسية للمعلم والمالك: الفصول وإنشاء فصل. */
export function TeacherHome({ openClass, openOwner }: { openClass: (code: string) => void; openOwner: () => void }) {
  const cloud = useCloudStatus()
  const { profile } = useProfile()
  const name = cloud.name || profile?.teacherName || (cloud.email ?? '').split('@')[0]

  return (
    <Screen>
      <header className="mb-5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500">لوحة المعلم</p>
          <h1 className="text-2xl font-bold [overflow-wrap:anywhere]">أهلًا {name} 👋</h1>
        </div>
        <span className="shrink-0 text-2xl font-bold text-teal-700 dark:text-teal-400">سنافي AE</span>
      </header>

      {profile?.owner && (
        <button type="button" onClick={openOwner} className="mb-4 block w-full text-start">
          <Card className="flex items-center justify-between gap-3 bg-gradient-to-l from-teal-700 to-teal-800 text-white ring-0 dark:from-teal-800 dark:to-teal-900">
            <span>
              <span className="block font-bold">لوحة المالك</span>
              <span className="block text-sm text-teal-100">رموز المعلمين، المعلمون، وكل الفصول</span>
            </span>
            <span aria-hidden="true" className="text-xl">
              ←
            </span>
          </Card>
        </button>
      )}

      {profile?.teacher && !profile.owner && profile.teacherExpiresAt !== null && (
        <p className="mb-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          صلاحيتك كمعلم حتى {new Date(profile.teacherExpiresAt).toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      )}

      <TeacherSection defaultName={name} openClass={openClass} />

      <p className="mt-4 text-center text-sm text-slate-500">
        أعطِ طلابك رمز الفصل: يختارون «أنا طالب» ويسجّلون الدخول ثم يكتبون الرمز.
      </p>
    </Screen>
  )
}
