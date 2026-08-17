import { useGetB2BMatrix, useCreateB2BOrder, WholesaleOrderInputPaymentTerms } from '@workspace/api-client-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';

export default function B2BMatrix() {
  const { data: catalog, isLoading } = useGetB2BMatrix();
  const createOrder = useCreateB2BOrder();
  const [, setLocation] = useLocation();

  // quantities[productId][variantId] = amount
  const [quantities, setQuantities] = useState<Record<number, Record<number, number>>>({});

  const handleQuantityChange = (productId: number, variantId: number, val: string) => {
    const amount = parseInt(val) || 0;
    setQuantities(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [variantId]: Math.max(0, amount)
      }
    }));
  };

  const cartSummary = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    const items: Array<{ productId: number, variantId: number, quantity: number, unitPrice: number }> = [];

    if (!catalog) return { totalItems, totalCost, items };

    catalog.forEach(product => {
      product.variants.forEach(variant => {
        const q = quantities[product.id]?.[variant.id] || 0;
        if (q > 0) {
          totalItems += q;
          totalCost += q * product.wholesalePrice;
          items.push({
            productId: product.id,
            variantId: variant.id,
            quantity: q,
            unitPrice: product.wholesalePrice
          });
        }
      });
    });

    return { totalItems, totalCost, items };
  }, [catalog, quantities]);

  const handleSubmitOrder = () => {
    if (cartSummary.items.length === 0) return;
    
    createOrder.mutate({
      data: {
        paymentTerms: WholesaleOrderInputPaymentTerms.net30,
        items: cartSummary.items
      }
    }, {
      onSuccess: () => {
        setLocation('/b2b/orders');
      }
    });
  };

  if (isLoading) return <div className="animate-pulse">Loading matrix grid...</div>;

  // Flatten catalog into rows based on product to render matrix. 
  // For simplicity, we just list products and variants in rows.
  return (
    <div className="flex h-full gap-6 items-start">
      <div className="flex-1 bg-white border shadow-sm overflow-hidden flex flex-col h-[calc(100vh-10rem)]">
        <div className="p-4 border-b bg-zinc-50 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-lg font-serif">Batch Order Matrix</h2>
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Rapid Procurement</span>
        </div>
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-zinc-50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[300px]">Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead className="text-right">W/S Price</TableHead>
                <TableHead className="text-center w-[120px]">Quantity</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalog?.map(product => (
                product.variants.map((variant, idx) => {
                  const q = quantities[product.id]?.[variant.id] || 0;
                  const lineTotal = q * product.wholesalePrice;
                  return (
                    <TableRow key={`${product.id}-${variant.id}`} className={idx === product.variants.length - 1 ? 'border-b-2' : ''}>
                      <TableCell className="font-medium text-sm">
                        {idx === 0 ? product.name : ''}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-zinc-600">
                        {variant.color} {variant.size ? `/ ${variant.size}` : ''} ({variant.sku})
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        ${product.wholesalePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="p-2">
                        <Input 
                          type="number" 
                          min="0"
                          value={q || ''} 
                          onChange={(e) => handleQuantityChange(product.id, variant.id, e.target.value)}
                          className="h-8 rounded-none font-mono text-center px-1"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {q > 0 ? `$${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="w-80 shrink-0">
        <Card className="rounded-none sticky top-6 shadow-md border-zinc-300">
          <CardHeader className="bg-zinc-900 text-white border-b border-zinc-800">
            <CardTitle className="text-lg font-serif">Purchase Order</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-baseline border-b pb-4">
                <span className="text-sm font-medium">Total Units</span>
                <span className="text-xl font-mono">{cartSummary.totalItems}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-medium">Order Value</span>
                <span className="text-2xl font-mono font-bold tracking-tighter">${cartSummary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="p-6 pt-0">
              <Button 
                onClick={handleSubmitOrder} 
                disabled={cartSummary.totalItems === 0 || createOrder.isPending}
                className="w-full h-12 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider transition-colors"
              >
                {createOrder.isPending ? 'Transmitting...' : 'Submit Order'}
              </Button>
              <p className="text-[10px] text-center mt-3 text-muted-foreground font-mono uppercase tracking-wide">Standard Net 30 Terms Apply</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

