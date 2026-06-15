"use client";

import { useState } from "react";

export function ListingImage({
  imageUrl,
  productName,
  alt,
}: {
  imageUrl?: string | null;
  productName: string;
  alt: string;
}) {
  const fallback = getProductFallback(productName);
  const [source, setSource] = useState(imageUrl?.trim() || fallback);

  return (
    <div className="aspect-video w-full min-w-0 overflow-hidden rounded-xl bg-[#f3f3f1]">
      <img
        src={source}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => {
          if (source !== fallback) setSource(fallback);
        }}
      />
    </div>
  );
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
