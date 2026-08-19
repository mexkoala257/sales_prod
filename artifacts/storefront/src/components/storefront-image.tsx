import { useEffect, useState } from 'react';

interface StorefrontImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackLabel?: string;
}

export function StorefrontImage({
  src,
  alt,
  className = 'h-full w-full object-cover',
  fallbackClassName = 'storefront-image-placeholder',
  fallbackLabel = 'No image',
}: StorefrontImageProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <div className={fallbackClassName}>{fallbackLabel}</div>;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />;
}