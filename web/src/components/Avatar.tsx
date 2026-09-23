"use client";

import Image from "next/image";
import { useState } from "react";

/**
 * Google Drive's "uc?export=view" links (saved by older uploads) no longer
 * render in <img> tags. Rewrite any Drive link to the thumbnail endpoint.
 */
export function drivePhotoUrl(url?: string) {
  if (!url) return url;
  const match = url.match(/drive\.google\.com\/.*(?:[?&]id=|\/d\/)([\w-]+)/);
  return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400` : url;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "");
}

export function Avatar({
  name,
  photoUrl,
  size = 34,
  className = "",
}: {
  name: string;
  photoUrl?: string;
  size?: number;
  className?: string;
}) {
  const src = drivePhotoUrl(photoUrl);
  const [failedSrc, setFailedSrc] = useState<string>();
  if (src && src !== failedSrc) {
    return (
      <Image
        src={src}
        onError={() => setFailedSrc(src)}
        alt={name}
        width={size}
        height={size}
        unoptimized
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-green-100 font-bold text-green-800 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </div>
  );
}
