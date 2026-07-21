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
  md: "w-14 h-14",
  lg: "w-20 h-20",
};

const imgSizes = {
  sm: 40,
  md: 56,
  lg: 80,
};

export default function SkinImage({
  src,
  name,
  size = "md",
  rarity,
}: SkinImageProps) {
  const borderColor = rarity ? RARITY_COLORS[rarity] || "#252a31" : "#252a31";

  return (
    <div
      className={`${sizes[size]} relative rounded-md overflow-hidden bg-surface border shrink-0`}
      style={{ borderColor: `${borderColor}40` }}
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
        <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-[8px] text-center p-1">
          {name.split(" | ")[0]?.slice(0, 3)}
        </div>
      )}
    </div>
  );
}
