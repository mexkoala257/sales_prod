import { useState } from 'react';
import { type Category, type StorefrontDiscoveryTile } from '@workspace/api-client-react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui';

type DiscoverySort = 'featured' | 'price-asc' | 'price-desc' | 'name';

const sortChoices: Array<{ value: DiscoverySort; label: string }> = [
  { value: 'featured', label: 'Featured picks' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name: A to Z' },
];

type DiscoveryTileEditorProps = {
  tiles: StorefrontDiscoveryTile[];
  categories?: Category[];
  categoriesLoading?: boolean;
  onChange: (tiles: StorefrontDiscoveryTile[]) => void;
};

export function DiscoveryTileEditor({
  tiles,
  categories = [],
  categoriesLoading = false,
  onChange,
}: DiscoveryTileEditorProps) {
  const [tileChoice, setTileChoice] = useState('');
  const availableCategories = categories.filter(
    (category) => !tiles.some((tile) => tile.type === 'category' && tile.categoryId === category.id),
  );
  const availableSortChoices = sortChoices.filter(
    (choice) => !tiles.some((tile) => tile.type === 'sort' && tile.sort === choice.value),
  );

  const addTile = () => {
    if (!tileChoice || tiles.length >= 12) return;

    if (tileChoice.startsWith('category:')) {
      const categoryId = Number(tileChoice.slice('category:'.length));
      const category = categories.find((item) => item.id === categoryId);
      if (!category) return;
      onChange([...tiles, {
        id: `category-${category.id}`,
        type: 'category',
        categoryId: category.id,
        label: category.name,
        visible: true,
      }]);
    } else if (tileChoice.startsWith('sort:')) {
      const sort = tileChoice.slice('sort:'.length) as DiscoverySort;
      const choice = sortChoices.find((item) => item.value === sort);
      if (!choice) return;
      onChange([...tiles, {
        id: `sort-${sort}`,
        type: 'sort',
        sort,
        label: choice.label,
        visible: true,
      }]);
    }
    setTileChoice('');
  };

  const moveTile = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= tiles.length) return;
    const next = [...tiles];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  };

  return (
    <Card className="rounded-none shadow-sm">
      <CardHeader>
        <CardTitle>Discovery Tiles</CardTitle>
        <p className="text-sm text-muted-foreground">Choose the categories or product views shoppers see first. Arrange them, tailor the labels, or hide a tile without deleting it.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            aria-label="Add discovery tile"
            value={tileChoice}
            onChange={(event) => setTileChoice(event.target.value)}
            className="h-10 flex-1 rounded-none border border-input bg-background px-3 text-sm"
            disabled={categoriesLoading || tiles.length >= 12}
          >
            <option value="">Choose a category or product view</option>
            {availableCategories.length > 0 && <optgroup label="Categories">
              {availableCategories.map((category) => <option key={category.id} value={`category:${category.id}`}>{category.name}</option>)}
            </optgroup>}
            {availableSortChoices.length > 0 && <optgroup label="Product views">
              {availableSortChoices.map((choice) => <option key={choice.value} value={`sort:${choice.value}`}>{choice.label}</option>)}
            </optgroup>}
          </select>
          <Button type="button" variant="outline" className="rounded-none" onClick={addTile} disabled={!tileChoice || tiles.length >= 12}>Add tile</Button>
        </div>
        {tiles.length === 0 ? (
          <p className="rounded-none border border-dashed p-4 text-sm text-muted-foreground">No tiles are curated yet. Your storefront will safely use its existing category or product discovery fallback.</p>
        ) : (
          <div className="space-y-2">
            {tiles.map((tile, index) => (
              <div key={tile.id} className="grid gap-3 border p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                <div className="flex items-center gap-1" aria-label={`Reorder ${tile.label}`}>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => moveTile(index, -1)} disabled={index === 0} aria-label={`Move ${tile.label} up`}><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => moveTile(index, 1)} disabled={index === tiles.length - 1} aria-label={`Move ${tile.label} down`}><ArrowDown className="h-4 w-4" /></Button>
                </div>
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground"><span className="font-medium uppercase tracking-wide">{tile.type === 'category' ? 'Category' : 'Product view'}</span><span>•</span><span>{tile.type === 'category' ? categories.find((category) => category.id === tile.categoryId)?.name || 'Unavailable category' : sortChoices.find((choice) => choice.value === tile.sort)?.label}</span></div>
                  <Input value={tile.label} onChange={(event) => onChange(tiles.map((item) => item.id === tile.id ? { ...item, label: event.target.value } : item))} aria-label={`Label for ${tile.label}`} maxLength={80} className="h-9 rounded-none" />
                </div>
                <div className="flex justify-end gap-1">
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-none" onClick={() => onChange(tiles.map((item) => item.id === tile.id ? { ...item, visible: !item.visible } : item))} aria-label={`${tile.visible ? 'Hide' : 'Show'} ${tile.label}`} title={tile.visible ? 'Hide tile' : 'Show tile'}>{tile.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-none text-destructive hover:text-destructive" onClick={() => onChange(tiles.filter((item) => item.id !== tile.id))} aria-label={`Remove ${tile.label}`} title="Remove tile"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{tiles.length}/12 tiles configured. Hidden tiles stay saved and can be shown again later.</p>
      </CardContent>
    </Card>
  );
}