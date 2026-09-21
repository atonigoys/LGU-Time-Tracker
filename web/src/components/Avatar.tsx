import Image from "next/image";

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
  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
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
