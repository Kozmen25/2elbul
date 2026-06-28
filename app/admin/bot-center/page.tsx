import { Bot } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-ui";
import { BotCenterClient } from "./bot-center-client";

export default function AdminBotCenterPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Bot kontrol paneli"
        title="Bot Merkezi"
        description="Cron URL'si yazmadan arama kuyruğunu, kaynak senkronizasyonunu, fiyat alarmlarını ve günlük cron akışını güvenli şekilde çalıştırın."
        action={
          <span className="grid size-12 place-items-center rounded-2xl bg-[#fff1e7] text-[#ff6b00]">
            <Bot size={24} />
          </span>
        }
      />
      <BotCenterClient />
    </>
  );
}
