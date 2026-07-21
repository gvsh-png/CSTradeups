"use client";

import Image from "next/image";
import { RARITY_COLORS } from "@/lib/constants";

interface SkinImageProps {
  src?: string;
  name: string;
  size?: "sm" | "md" | "lg";
  rarity?: string;
}

const sizes = {
  sm: "w-10 h-10",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

const imgSizes = { sm: 40, md: 48, lg: 64 };

export default function SkinImage({
  src,
  name,
  size = "md",
  rarity,
}: SkinImageProps) {
  const borderColor = rarity ? RARITY_COLORS[rarity] || "#1c1c28" : "#1c1c28";

  return (
    <div
      className={`${sizes[size]} relative rounded overflow-hidden bg-[var(--surface)] border shrink-0`}
      style={{ borderColor: `${borderColor}50` }}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          width={imgSizes[size]}
          height={imgSizes[size]}
          className="object-contain w-full h-full p-0.5"
          unoptimized
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-[7px] font-mono">
          {name.split(" | ")[0]?.slice(0, 3).toUpperCase()}
        </div>
      )}
    </div>
  );
}
