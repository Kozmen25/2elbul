"use client";

import { Check, Scale } from "lucide-react";
import { useCompare } from "@/components/compare-context";

type CompareButtonProps = {
  listingId: string;
  productName: string;
  compact?: boolean;
};

export function CompareButton({
  listingId,
  productName,
  compact = false,
}: CompareButtonProps) {
  const { isSelected, addToSelection, removeFromSelection } = useCompare();
  const selected = isSelected(listingId);

  function handleClick() {
    if (selected) {
      removeFromSelection(listingId);
      return;
    }
    addToSelection({ listingId, productName });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={selected}
      aria-label={selected ? "Karşılaştırmadan çıkar" : "Karşılaştırmaya ekle"}
      title={selected ? "Karşılaştırmadan çıkar" : "Karşılaştırmaya ekle"}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border font-bold transition ${
        compact ? "size-10" : "px-3 py-2 text-sm"
      } ${
        selected
          ? "border-[#3B66E0]/30 bg-[#E4ECFF] text-[#2A4FBF]"
          : "border-black/10 bg-white text-black/55 hover:border-[#3B66E0]/35 hover:text-[#3B66E0]"
      }`}
    >
      {selected ? <Check size={18} /> : <Scale size={18} />}
      {!compact && (selected ? "Seçildi" : "Karşılaştır")}
    </button>
  );
}
