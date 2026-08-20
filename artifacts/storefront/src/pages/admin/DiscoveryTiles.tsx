import { useEffect, useState } from 'react';
import {
  getGetAdminDiscoveryTilesQueryKey,
  useGetAdminDiscoveryTiles,
  useListAdminCategories,
  useUpdateAdminDiscoveryTiles,
  type StorefrontDiscoveryTile,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import { DiscoveryTileEditor } from '@/components/DiscoveryTileEditor';

export default function AdminDiscoveryTiles() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useGetAdminDiscoveryTiles();
  const { data: categories, isLoading: categoriesLoading } = useListAdminCategories();
  const updateTiles = useUpdateAdminDiscoveryTiles();
  const [tiles, setTiles] = useState<StorefrontDiscoveryTile[]>([]);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config) setTiles(config.discoveryTiles);
  }, [config]);

  const save = () => {
    setSaveError('');
    setSaved(false);
    updateTiles.mutate(
      { data: { discoveryTiles: tiles } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetAdminDiscoveryTilesQueryKey(), updated);
          setSaved(true);
        },
        onError: (error) => {
          setSaveError(error instanceof Error ? error.message : 'Unable to save discovery tiles. Please try again.');
        },
      },
    );
  };

  if (isLoading) return <div className="animate-pulse">Loading storefront merchandising...</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Storefront Discovery</h1>
          <p className="mt-1 text-muted-foreground">Choose what shoppers discover first on your home page.</p>
        </div>
        <Button className="rounded-none" onClick={save} disabled={updateTiles.isPending}>
          {updateTiles.isPending ? 'Saving…' : 'Save discovery tiles'}
        </Button>
      </div>
      {saveError && <p role="alert" className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{saveError}</p>}
      {saved && <p role="status" className="border border-emerald-500/40 bg-emerald-50 p-3 text-sm text-emerald-700">Discovery tiles saved. Your storefront will reflect this selection.</p>}
      <DiscoveryTileEditor tiles={tiles} categories={categories} categoriesLoading={categoriesLoading} onChange={(next) => { setTiles(next); setSaved(false); }} />
    </div>
  );
}