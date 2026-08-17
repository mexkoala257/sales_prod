import { useListB2BOrders } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge } from '@/components/ui';
import { format } from 'date-fns';

export default function B2BOrders() {
  const { data: orders, isLoading } = useListB2BOrders();

  if (isLoading) return <div className="animate-pulse">Loading orders...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif tracking-tight">Purchase History</h1>
        <p className="text-muted-foreground mt-1">Track your wholesale orders and production status.</p>
      </div>

      <div className="bg-card border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Terms</TableHead>
              <TableHead>Production Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono font-medium">#{order.id.toString().padStart(6, '0')}</TableCell>
                <TableCell className="text-sm font-mono text-muted-foreground">
                  {format(new Date(order.createdAt), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">${order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="rounded-none font-mono text-[10px] uppercase">
                    {order.paymentTerms}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="w-full max-w-[200px]">
                    <div className="flex justify-between text-[10px] uppercase font-mono mb-1 text-zinc-600">
                      <span>{order.status}</span>
                      <span>{order.fulfillmentStep}/4</span>
                    </div>
                    <div className="flex h-2 w-full bg-zinc-100 overflow-hidden border">
                      <div className={`h-full ${order.status === 'delivered' ? 'bg-emerald-500' : 'bg-zinc-800'}`} style={{ width: `${(order.fulfillmentStep / 4) * 100}%` }} />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {orders?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
