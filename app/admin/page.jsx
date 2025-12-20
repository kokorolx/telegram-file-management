import { requireAdmin } from '../../lib/auth';
import { redirect } from 'next/navigation';
import AdminDashboardClient from '../components/AdminDashboard';
import { auditLogRepository } from '../../lib/repositories/AuditLogRepository';

export default async function AdminPage() {
  const { authorized } = await requireAdmin(new Request('http://localhost/admin', {
    headers: {
        // We'll pass cookies manually if needed, but next/headers is better
    }
  }));

  // Better way to get headers in Next.js Server Components
  const { headers } = await import('next/headers');
  const h = await headers();
  const authCheck = await requireAdmin({
    url: 'http://localhost/admin',
    headers: h
  });

  if (!authCheck.authorized) {
    redirect('/landing');
  }

  // Fetch initial audit logs for the explorer
  const recentLogs = await auditLogRepository.findAll(50);

  return (
    <AdminDashboardClient initialLogs={recentLogs} />
  );
}
