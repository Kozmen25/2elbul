"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  FileJson2,
  Upload,
} from "lucide-react";
import { ChangeEvent, useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  importAdminListings,
  type AdminImportState,
} from "./actions";

const exampleJson = `[
  {
    "product_name": "iPhone 13",
    "title": "iPhone 13 128GB Temiz",
    "price": 21000,
    "city": "İstanbul",
    "source": "Sahibinden",
    "url": "https://example.com",
    "condition": "İkinci El"
  }
]`;

const initialState: AdminImportState = {
  status: "idle",
  message: "",
  imported: 0,
  existing: 0,
  failed: 0,
  errors: [],
};

const columns = [
  "product_name",
  "title",
  "price",
  "city",
  "source",
  "url",
  "condition",
] as const;

type PreviewRecord = Record<string, unknown>;

export function AdminImportForm() {
  const [state, formAction] = useActionState(
    importAdminListings,
    initialState,
  );
  const [jsonValue, setJsonValue] = useState(exampleJson);
  const [fileError, setFileError] = useState("");
  const [fileName, setFileName] = useState("");
  const hasResult = state.status !== "idle";
  const preview = useMemo(() => getPreview(jsonValue), [jsonValue]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileError("");
    setFileName(file.name);

    try {
      const extension = file.name.split(".").pop()?.toLocaleLowerCase("en-US");
      let records: PreviewRecord[];

      if (extension === "csv") {
        const Papa = (await import("papaparse")).default;
        const parsed = Papa.parse<PreviewRecord>(await file.text(), {
          header: true,
          skipEmptyLines: "greedy",
          transformHeader: (header) => header.trim(),
        });

        if (parsed.errors.length > 0) {
          throw new Error(parsed.errors[0]?.message ?? "CSV okunamadı.");
        }
        records = parsed.data;
      } else if (extension === "xlsx") {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) throw new Error("Excel dosyasında sayfa bulunamadı.");

        records = XLSX.utils.sheet_to_json<PreviewRecord>(
          workbook.Sheets[firstSheetName],
          { defval: "" },
        );
      } else {
        throw new Error("Yalnızca .csv veya .xlsx dosyası yükleyebilirsiniz.");
      }

      if (records.length === 0) {
        throw new Error("Dosyada içe aktarılacak kayıt bulunamadı.");
      }

      const missingHeaders = columns.filter(
        (column) =>
          !records.some((record) =>
            Object.prototype.hasOwnProperty.call(record, column),
          ),
      );
      if (missingHeaders.length > 0) {
        throw new Error(`Eksik kolonlar: ${missingHeaders.join(", ")}`);
      }

      setJsonValue(JSON.stringify(records, null, 2));
    } catch (error) {
      console.error("Admin import file parse failed:", error);
      setFileError(
        error instanceof Error ? error.message : "Dosya okunamadı.",
      );
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)]">
      <form
        action={formAction}
        className="min-w-0 rounded-3xl border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)] sm:p-8"
      >
        <label htmlFor="import-json" className="flex items-center gap-2 font-black">
          <FileJson2 size={20} className="text-[#ff6b00]" />
          İlan JSON verisi
        </label>
        <p className="mt-2 text-sm leading-6 text-black/45">
          JSON yapıştırın veya aynı kolonlara sahip CSV/Excel dosyası yükleyin.
          Tek seferde en fazla 500 kayıt işlenir.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-black/10 bg-[#fafaf8] px-4 py-3.5 text-sm font-bold transition hover:border-[#ff6b00]/35">
            <FileText size={18} className="text-[#ff6b00]" />
            CSV yükle
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-black/10 bg-[#fafaf8] px-4 py-3.5 text-sm font-bold transition hover:border-[#ff6b00]/35">
            <FileSpreadsheet size={18} className="text-[#ff6b00]" />
            Excel yükle
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
        </div>

        {fileName && !fileError && (
          <p className="mt-3 text-xs font-semibold text-green-700">
            Dosya okundu: {fileName}
          </p>
        )}
        {fileError && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {fileError}
          </p>
        )}

        <textarea
          id="import-json"
          name="json"
          required
          value={jsonValue}
          onChange={(event) => {
            setJsonValue(event.target.value);
            setFileName("");
            setFileError("");
          }}
          spellCheck={false}
          className="field mt-5 min-h-96 resize-y p-4 font-mono text-sm leading-6"
        />

        <PreviewTable preview={preview} />
        <SubmitButton />
      </form>

      <aside className="min-w-0">
        {hasResult ? (
          <div
            className={`rounded-3xl border p-5 sm:p-6 ${
              state.status === "error" && state.imported === 0
                ? "border-red-200 bg-red-50"
                : "border-black/8 bg-white"
            }`}
          >
            <div className="flex items-start gap-3">
              {state.status === "success" ? (
                <CheckCircle2 className="shrink-0 text-green-600" size={23} />
              ) : (
                <AlertTriangle className="shrink-0 text-red-600" size={23} />
              )}
              <div>
                <h2 className="font-black">Aktarım sonucu</h2>
                <p className="mt-1 text-sm leading-6 text-black/55">
                  {state.message}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <ResultStat label="Eklendi" value={state.imported} />
              <ResultStat label="Zaten vardı" value={state.existing} />
              <ResultStat label="Hatalı" value={state.failed} />
            </div>

            {state.errors.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-black">Hatalı kayıtlar</h3>
                <div className="mt-3 grid gap-2">
                  {state.errors.map((error) => (
                    <div
                      key={`${error.index}-${error.title}`}
                      className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm"
                    >
                      <p className="font-bold">
                        #{error.index + 1} {error.title}
                      </p>
                      <p className="mt-1 break-words text-red-700">
                        {error.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-black/15 bg-white p-6 text-sm leading-6 text-black/50">
            Aktarım sonucu burada gösterilecek. Aynı URL daha önce kaydedildiyse
            ilan tekrar eklenmez.
          </div>
        )}
      </aside>
    </div>
  );
}

function PreviewTable({
  preview,
}: {
  preview: {
    records: PreviewRecord[];
    total: number;
    error: string;
  };
}) {
  return (
    <div className="mt-6 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-black">Önizleme</h2>
        <span className="rounded-full bg-[#fff1e7] px-3 py-1.5 text-xs font-bold text-[#d95700]">
          Toplam {preview.total} kayıt
        </span>
      </div>

      {preview.error ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          {preview.error}
        </p>
      ) : preview.records.length > 0 ? (
        <div className="mt-3 max-w-full overflow-x-auto rounded-xl border border-black/8">
          <table className="min-w-[900px] w-full border-collapse text-left text-xs">
            <thead className="bg-[#fafaf8]">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-3 py-3 font-black">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.records.map((record, index) => (
                <tr key={index} className="border-t border-black/7">
                  {columns.map((column) => (
                    <td
                      key={column}
                      className="max-w-52 truncate px-3 py-3 text-black/60"
                      title={String(record[column] ?? "")}
                    >
                      {String(record[column] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-black/45">Önizlenecek kayıt yok.</p>
      )}
    </div>
  );
}

function getPreview(value: string) {
  if (!value.trim()) {
    return { records: [], total: 0, error: "" };
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return {
        records: [],
        total: 0,
        error: "Önizleme için JSON bir dizi olmalıdır.",
      };
    }

    const records = parsed.filter(
      (record): record is PreviewRecord =>
        Boolean(record) && typeof record === "object" && !Array.isArray(record),
    );
    return {
      records: records.slice(0, 10),
      total: parsed.length,
      error:
        records.length === parsed.length
          ? ""
          : "Bazı kayıtlar JSON nesnesi olmadığı için geçersiz.",
    };
  } catch {
    return {
      records: [],
      total: 0,
      error: "JSON henüz geçerli değil.",
    };
  }
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="orange-button mt-5 w-full py-4 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Upload size={18} />
      {pending ? "İlanlar işleniyor..." : "İlanları içe aktar"}
    </button>
  );
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-xl border border-black/8 bg-white p-3 text-center">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[11px] font-bold leading-4 text-black/45">
        {label}
      </p>
    </div>
  );
}
