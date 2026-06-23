import { AppLayout } from '@/components/layout/app-layout'
import { BuchhaltungContent } from './buchhaltung-content'

export default function BuchhaltungPage() {
  return (
    <AppLayout title="Buchhaltung">
      <BuchhaltungContent />
    </AppLayout>
  )
}
