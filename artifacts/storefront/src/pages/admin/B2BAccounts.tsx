import { useListB2BClients } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button } from '@/components/ui';
import { Link } from 'wouter';
import { Plus, Edit } from 'lucide-react';

export default function AdminB2BAccounts() {
  const { data: clients, isLoading } = useListB2BClients();

  if (isLoading) return <div className="animate-pulse">Loading B2B accounts...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Wholesale Partners</h1>
          <p className="text-muted-foreground mt-1">Manage B2B procurement access and pricing tiers.</p>
        </div>
        <Link href="/admin/b2b-accounts/new" className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-none">
          <Plus className="w-4 h-4 mr-2" />
          Onboard Partner
        </Link>
      </div>

      <div className="bg-card border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead className="text-right">Discount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients?.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">{client.companyName}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm">{client.contactName}</span>
                    <span className="text-xs text-muted-foreground font-mono">{client.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase border-zinc-300">
                    {client.paymentTerms}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono font-medium text-emerald-600">{client.discountPercent}%</TableCell>
                <TableCell>
                  <Badge variant={client.isActive ? 'default' : 'secondary'} className="rounded-none font-mono text-[10px] uppercase">
                    {client.isActive ? 'Active' : 'Suspended'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/b2b-accounts/${client.id}`} className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground h-9 px-3 rounded-none">
                    <Edit className="w-4 h-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {clients?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No wholesale partners registered.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
