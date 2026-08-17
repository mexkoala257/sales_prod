import {
  useGetB2BMatrix,
  useCreateB2BOrder,
  useListB2BArtwork,
  WholesaleOrderInputPaymentTerms,
} from '@workspace/api-client-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Button, Input, Card, CardHeader, CardTitle, CardContent,
} from '@/components/ui';
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ImageIcon, X, Paperclip, FileImage, Check } from 'lucide-react';

export default function B2BMatrix() {
  const { data: catalog, isLoading } = useGetB2BMatrix();
  const { data: artworks = [] } = useListB2BArtwork();
  const createOrder = useCreateB2BOrder();
  const [, setLocation] = useLocation();

  // quantities[productId][variantId] = amount
  const [quantities, setQuantities] = useState<Record<number, Record<number, number>>>({});
  // artworkSelections[productId] = artworkId
  const [artworkSelections, setArtworkSelections] = useState<Record<number, number>>({});
  // which product's artwork picker is open (null = closed)
  const [pickerOpenFor, setPickerOpenFor] = useState<number | null>(null);

  const handleQuantityChange = (productId: number, variantId: number, val: string) => {
    const amount = parseInt(val) || 0;
    setQuantities(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [variantId]: Math.max(0, amount) },
    }));
  };

  const selectArtwork = (productId: number, artworkId: number) => {
    setArtworkSelections(prev => ({ ...prev, [productId]: artworkId }));
    setPickerOpenFor(null);
  };

  const clearArtwork = (productId: number) => {
    setArtworkSelections(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const cartSummary = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    const items: Array<{ productId: number; variantId: number; quantity: number; unitPrice: number; artworkId?: number }> = [];

    if (!catalog) return { totalItems, totalCost, items };

    catalog.forEach(product => {
      const artworkId = artworkSelections[product.id];
      product.variants.forEach(variant => {
        const q = quantities[product.id]?.[variant.id] || 0;
        if (q > 0) {
          totalItems += q;
          totalCost += q * product.wholesalePrice;
          items.push({
            productId: product.id,
            variantId: variant.id,
            quantity: q,
            unitPrice: product.wholesalePrice,
            ...(artworkId != null ? { artworkId } : {}),
          });
        }
      });
    });

    return { totalItems, totalCost, items };
  }, [catalog, quantities, artworkSelections]);

  const handleSubmitOrder = () => {
    if (cartSummary.items.length === 0) return;
    createOrder.mutate(
      { data: { paymentTerms: WholesaleOrderInputPaymentTerms.net30, items: cartSummary.items } },
      { onSuccess: () => setLocation('/b2b/orders') },
    );
  };

  // artwork map for quick lookups
  const artworkById = useMemo(
    () => Object.fromEntries((artworks ?? []).map(a => [a.id, a])),
    [artworks],
  );

  const pickerProduct = pickerOpenFor != null ? catalog?.find(p => p.id === pickerOpenFor) : null;
  const currentArtworkId = pickerOpenFor != null ? artworkSelections[pickerOpenFor] : undefined;

  if (isLoading) return <div className="animate-pulse p-8">Loading matrix grid…</div>;

  return (
    <>
      {/* ── Artwork picker modal ──────────────────────────────────────── */}
      {pickerOpenFor != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setPickerOpenFor(null)}
        >
          <div
            className="bg-white shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-zinc-900 text-white shrink-0">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-zinc-400 mb-0.5">Attach artwork to</p>
                <h2 className="text-lg font-serif">{pickerProduct?.name}</h2>
              </div>
              <button onClick={() => setPickerOpenFor(null)} className="text-zinc-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* body */}
            <div className="flex-1 overflow-y-auto p-6">
              {artworks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-500">
                  <FileImage className="w-12 h-12 text-zinc-200 mb-3" />
                  <p className="font-medium">No artwork in library</p>
                  <p className="text-sm mt-1">Upload files in the Artwork Library tab first.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {artworks.map(art => {
                    const isSelected = currentArtworkId === art.id;
                    return (
                      <button
                        key={art.id}
                        onClick={() => selectArtwork(pickerOpenFor!, art.id)}
                        className={`group relative border-2 transition-all text-left focus:outline-none ${
                          isSelected
                            ? 'border-emerald-600 shadow-md'
                            : 'border-zinc-200 hover:border-zinc-400'
                        }`}
                      >
                        {/* selected tick */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-emerald-600 flex items-center justify-center z-10">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <div className="aspect-square bg-zinc-100 flex items-center justify-center p-3 overflow-hidden">
                          {art.fileType?.includes('image') || art.url?.match(/\.(png|jpe?g|gif|svg|webp)$/i) ? (
                            <img src={art.url} alt={art.name} className="max-w-full max-h-full object-contain" />
                          ) : (
                            <FileImage className="w-10 h-10 text-zinc-300" />
                          )}
                        </div>
                        <div className="p-2 border-t bg-white">
                          <p className="text-xs font-medium truncate" title={art.name}>{art.name}</p>
                          <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase">
                            {art.fileType?.split('/')[1] ?? 'file'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* footer */}
            {currentArtworkId != null && (
              <div className="border-t p-4 bg-zinc-50 flex items-center justify-between shrink-0">
                <span className="text-sm text-zinc-600 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span><strong>{artworkById[currentArtworkId]?.name}</strong> attached</span>
                </span>
                <button
                  onClick={() => { clearArtwork(pickerOpenFor!); setPickerOpenFor(null); }}
                  className="text-xs text-red-500 hover:text-red-700 font-medium underline"
                >
                  Remove artwork
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main layout ───────────────────────────────────────────────── */}
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
                  <TableHead className="w-[240px]">Product</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">W/S Price</TableHead>
                  <TableHead className="text-center w-[110px]">Qty</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                  <TableHead className="w-[180px]">Artwork</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {catalog?.map(product =>
                  product.variants.map((variant, idx) => {
                    const q = quantities[product.id]?.[variant.id] || 0;
                    const lineTotal = q * product.wholesalePrice;
                    const selectedArtworkId = artworkSelections[product.id];
                    const selectedArtwork = selectedArtworkId != null ? artworkById[selectedArtworkId] : undefined;
                    const isFirstRow = idx === 0;
                    const isLastRow = idx === product.variants.length - 1;

                    return (
                      <TableRow
                        key={`${product.id}-${variant.id}`}
                        className={isLastRow ? 'border-b-2' : ''}
                      >
                        {/* Product name — only on first row */}
                        <TableCell className="font-medium text-sm align-top pt-3">
                          {isFirstRow ? product.name : ''}
                        </TableCell>

                        {/* Variant */}
                        <TableCell className="text-xs font-mono text-zinc-600">
                          {[variant.color, variant.size ? `/ ${variant.size}` : '', `(${variant.sku})`]
                            .filter(Boolean).join(' ')}
                        </TableCell>

                        {/* Price */}
                        <TableCell className="text-right font-mono text-xs">
                          ${product.wholesalePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>

                        {/* Qty input */}
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min="0"
                            value={q || ''}
                            onChange={e => handleQuantityChange(product.id, variant.id, e.target.value)}
                            className="h-8 rounded-none font-mono text-center px-1"
                          />
                        </TableCell>

                        {/* Line total */}
                        <TableCell className="text-right font-mono text-sm font-medium">
                          {q > 0 ? `$${lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>

                        {/* Artwork — only on first row, spans visually */}
                        <TableCell className="align-top pt-2">
                          {isFirstRow && (
                            selectedArtwork ? (
                              <div className="flex items-center gap-2 group">
                                {/* thumbnail */}
                                <div className="w-8 h-8 border border-zinc-200 bg-zinc-50 flex items-center justify-center shrink-0 overflow-hidden">
                                  {selectedArtwork.fileType?.includes('image') ||
                                  selectedArtwork.url?.match(/\.(png|jpe?g|gif|svg|webp)$/i) ? (
                                    <img
                                      src={selectedArtwork.url}
                                      alt={selectedArtwork.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <FileImage className="w-4 h-4 text-zinc-300" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-medium truncate leading-tight" title={selectedArtwork.name}>
                                    {selectedArtwork.name}
                                  </p>
                                  <button
                                    onClick={() => setPickerOpenFor(product.id)}
                                    className="text-[10px] text-zinc-400 hover:text-zinc-700 underline leading-tight"
                                  >
                                    Change
                                  </button>
                                </div>
                                <button
                                  onClick={() => clearArtwork(product.id)}
                                  title="Remove artwork"
                                  className="shrink-0 text-zinc-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setPickerOpenFor(product.id)}
                                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors group"
                                title="Attach artwork from library"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                <span className="group-hover:underline">Attach artwork</span>
                              </button>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* ── Order summary sidebar ──────────────────────────────────── */}
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
                  <span className="text-2xl font-mono font-bold tracking-tighter">
                    ${cartSummary.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Artwork summary */}
                {Object.keys(artworkSelections).length > 0 && (
                  <div className="border-t pt-4 space-y-2">
                    <p className="text-xs font-mono uppercase tracking-widest text-zinc-400">Attached Artwork</p>
                    {Object.entries(artworkSelections).map(([pid, aid]) => {
                      const product = catalog?.find(p => p.id === Number(pid));
                      const art = artworkById[aid];
                      if (!product || !art) return null;
                      return (
                        <div key={pid} className="flex items-center gap-2">
                          <ImageIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-medium truncate">{product.name}</p>
                            <p className="text-[10px] text-zinc-400 truncate">{art.name}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-6 pt-0">
                <Button
                  onClick={handleSubmitOrder}
                  disabled={cartSummary.totalItems === 0 || createOrder.isPending}
                  className="w-full h-12 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider transition-colors"
                >
                  {createOrder.isPending ? 'Transmitting…' : 'Submit Order'}
                </Button>
                <p className="text-[10px] text-center mt-3 text-muted-foreground font-mono uppercase tracking-wide">
                  Standard Net 30 Terms Apply
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
