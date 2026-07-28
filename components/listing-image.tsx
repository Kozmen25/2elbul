"use client";

import { useState } from "react";
import Link from "next/link";
import type { ListingSource } from "@/lib/listings";

export function ListingImage({
  imageUrl,
  productName,
  alt,
  source,
  listingCount,
  listingUrl,
}: {
  imageUrl?: string | null;
  productName: string;
  alt: string;
  source?: ListingSource | null;
  listingCount?: number;
  listingUrl?: string;
}) {
  const fallback = getProductFallback(productName);
  const [imgSrc, setImgSrc] = useState(imageUrl?.trim() || fallback);

  const wrapper = (
    <div className="relative aspect-video w-full min-w-0 overflow-hidden rounded-xl bg-[#f3f3f1]">
      <img
        src={imgSrc}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => {
          if (imgSrc !== fallback) setImgSrc(fallback);
        }}
      />
      {source && (
        <div className="absolute left-2 top-2 flex size-5 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm">
          <img
            src={getSourceLogoPath(source)}
            alt={source}
            className="size-full"
          />
        </div>
      )}
      {listingCount !== undefined && listingCount > 1 && (
        <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
          +{listingCount - 1}
        </div>
      )}
    </div>
  );

  if (listingUrl) {
    return <Link href={listingUrl}>{wrapper}</Link>;
  }

  return wrapper;
}

function getSourceLogoPath(source: ListingSource): string {
  const slug = source
    .toLocaleLowerCase("tr-TR")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/ /g, "-");
  return `/sources/${slug}.svg`;
}

function getProductFallback(productName: string) {
  const name = productName.toLocaleLowerCase("tr-TR");

  if (
    name.includes("iphone") ||
    name.includes("samsung") ||
    name.includes("telefon")
  ) {
    return "/products/phone.svg";
  }
  if (
    name.includes("rtx") ||
    name.includes("ekran kart") ||
    name.includes("gpu")
  ) {
    return "/products/camera.svg";
  }
  if (
    name.includes("ps5") ||
    name.includes("playstation") ||
    name.includes("xbox") ||
    name.includes("konsol")
  ) {
    return "/products/console.svg";
  }
  if (
    name.includes("macbook") ||
    name.includes("laptop") ||
    name.includes("notebook")
  ) {
    return "/products/laptop.svg";
  }

  return "/products/placeholder.svg";
}
