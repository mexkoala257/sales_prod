import { useListAdminOrders, useUpdateOrderStatus } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { getListAdminOrdersQueryKey, OrderStatusUpdateStatus } from '@workspace/api-client-react';
import { useState } from 'react';

export default function AdminOrders() {
  const { data: orders, isLoading } = useListAdminOrders();
  const updateStatus = useUpdateOrderStatus();
  const queryClient = useQueryClient();

  const handleStatusChange = (orderId: string, status: OrderStatusUpdateStatus, step: number) => {
    updateStatus.mutate({ orderId, data: { status, fulfillmentStep: step } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAdminOrdersQueryKey() })
    });
  };

  if (isLoading) return <div className="animate-pulse">Loading orders...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Order Fulfillment</h1>
        <p className="text-muted-foreground mt-1">Manage processing pipeline for B2B and B2C orders.</p>
      </div>

      <div className="bg-card border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Fulfillment Stage</TableHead>
              <TableHead>Quick Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders?.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">#{order.id.toString().padStart(6, '0')}</TableCell>
                <TableCell className="text-sm font-mono">{format(new Date(order.createdAt), 'MMM d, yyyy')}</TableCell>
                <TableCell>{order.type === 'b2b' ? order.b2bCompanyName : order.customerName}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`rounded-none font-mono text-[10px] uppercase ${order.type === 'b2b' ? 'border-blue-500 text-blue-600' : 'border-emerald-500 text-emerald-600'}`}>
                    {order.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">${order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  <div className="w-full max-w-[150px]">
                    <div className="flex justify-between text-[10px] uppercase font-mono mb-1 text-muted-foreground">
                      <span>{order.status}</span>
                      <span>{order.fulfillmentStep}/4</span>
                    </div>
                    <div className="flex h-1.5 w-full bg-muted overflow-hidden">
                      <div className={`h-full ${order.status === 'delivered' ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${(order.fulfillmentStep / 4) * 100}%` }} />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {order.fulfillmentStep === 1 && <Button size="sm" variant="outline" className="rounded-none text-xs h-7" onClick={() => handleStatusChange(order.id.toString(), OrderStatusUpdateStatus.production, 2)}>Start Production</Button>}
                  {order.fulfillmentStep === 2 && <Button size="sm" variant="outline" className="rounded-none text-xs h-7" onClick={() => handleStatusChange(order.id.toString(), OrderStatusUpdateStatus.shipped, 3)}>Mark Shipped</Button>}
                  {order.fulfillmentStep === 3 && <Button size="sm" variant="outline" className="rounded-none text-xs h-7" onClick={() => handleStatusChange(order.id.toString(), OrderStatusUpdateStatus.delivered, 4)}>Mark Delivered</Button>}
                  {order.fulfillmentStep === 4 && <span className="text-xs text-muted-foreground font-mono">COMPLETED</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
