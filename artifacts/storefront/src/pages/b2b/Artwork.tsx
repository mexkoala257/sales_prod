import { useListB2BArtwork, useDeleteB2BArtwork, getListB2BArtworkQueryKey } from '@workspace/api-client-react';
import { Button, Card, CardContent } from '@/components/ui';
import { Trash2, UploadCloud, FileImage } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { customFetch } from '@workspace/api-client-react';

export default function B2BArtwork() {
  const { data: artworks, isLoading } = useListB2BArtwork();
  const deleteArtwork = useDeleteB2BArtwork();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleDelete = (id: string) => {
    if (confirm('Delete this artwork file?')) {
      deleteArtwork.mutate({ artworkId: id }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getListB2BArtworkQueryKey() })
      });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      // 1. Get presigned URL (assuming endpoint exists based on brief)
      const reqRes = await customFetch<{uploadURL: string, objectPath: string}>('/api/storage/uploads/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type })
      });

      // 2. Put file to S3
      await fetch(reqRes.uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      // 3. Register in DB
      await customFetch('/api/b2b/artwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectPath: reqRes.objectPath, name: file.name, fileType: file.type })
      });

      queryClient.invalidateQueries({ queryKey: getListB2BArtworkQueryKey() });
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif tracking-tight">Artwork Library</h1>
          <p className="text-muted-foreground mt-1">Manage brand assets for custom production.</p>
        </div>
        <div>
          <input type="file" ref={fileInputRef} className="hidden" accept=".png,.jpg,.jpeg,.svg" onChange={handleFileChange} />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded-none bg-zinc-900 text-white hover:bg-zinc-800">
            <UploadCloud className="w-4 h-4 mr-2" />
            {uploading ? 'Uploading...' : 'Upload Asset'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse">Loading artwork library...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {artworks?.map(artwork => (
            <Card key={artwork.id} className="rounded-none group relative overflow-hidden">
              <div className="aspect-square bg-zinc-100 flex items-center justify-center p-4">
                {artwork.fileType.includes('image') || artwork.url.match(/\.(jpeg|jpg|gif|png|svg)$/i) ? (
                  <img src={artwork.url} alt={artwork.name} className="max-w-full max-h-full object-contain" />
                ) : (
                  <FileImage className="w-12 h-12 text-zinc-300" />
                )}
              </div>
              <div className="p-3 border-t bg-white">
                <p className="text-xs font-medium truncate" title={artwork.name}>{artwork.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono uppercase mt-1">{(artwork.fileSizeBytes || 0) / 1024 > 1024 ? `${((artwork.fileSizeBytes || 0) / 1024 / 1024).toFixed(2)} MB` : `${((artwork.fileSizeBytes || 0) / 1024).toFixed(0)} KB`}</p>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="destructive" size="icon" className="h-8 w-8 rounded-none shadow-sm" onClick={() => handleDelete(artwork.id.toString())}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
          {artworks?.length === 0 && (
            <div className="col-span-full py-16 text-center border-2 border-dashed border-zinc-200 bg-zinc-50">
              <FileImage className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-zinc-900">No artwork uploaded</h3>
              <p className="text-sm text-zinc-500 mt-1 mb-4">Upload vector files or high-res images for production.</p>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="rounded-none bg-white">Browse Files</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
