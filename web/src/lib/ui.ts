export const cls = {
  panel: "rounded-xl bg-white p-5 shadow-sm",
  panelTitle: "mb-3.5 flex items-center justify-between text-[15px] font-bold text-green-800",
  input:
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-100",
  label: "mb-1 block text-[12.5px] font-semibold text-gray-700",
  btn: "inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-green-700 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60",
  btnSecondary:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-[13.5px] font-semibold text-green-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60",
  btnDanger:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-red-600 px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60",
  btnGhost:
    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-transparent bg-transparent px-4 py-2.5 text-[13.5px] font-semibold text-green-800 transition hover:bg-green-50",
  btnSmall: "px-2.5 py-1.5 text-[12.5px]",
  table: "w-full border-collapse text-[13.5px]",
  th: "border-b border-gray-100 px-3 py-2.5 text-left text-[11.5px] font-bold tracking-wide text-gray-500 uppercase",
  td: "border-b border-gray-100 px-3 py-2.5 text-left whitespace-nowrap",
  emptyState: "px-3 py-10 text-center text-[13.5px] text-gray-500",
};

export function joinClass(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}
