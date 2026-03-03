import { useState, useRef, useEffect } from "react";
import type { Client, NetTerms } from "../types";

const DEFAULT_COLOR = "#006b51";

/* ── Modal for creating / editing a client ── */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (draft: Omit<Client, "id">) => Client;
  onCreated: (client: Client) => void;
  onUpdate?: (id: string, partial: Partial<Omit<Client, "id">>) => void;
  editClient?: Client | null;
}

export function ClientModal({
  open,
  onClose,
  onAdd,
  onCreated,
  onUpdate,
  editClient,
}: ModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [themeColor, setThemeColor] = useState(DEFAULT_COLOR);
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>();
  const [hourlyRate, setHourlyRate] = useState(200);
  const [netTerms, setNetTerms] = useState<NetTerms>(30);
  const fileRef = useRef<HTMLInputElement>(null);

  const isEdit = !!editClient;

  // Populate fields when editing
  useEffect(() => {
    if (editClient) {
      setName(editClient.name);
      setAddress(editClient.address);
      setThemeColor(editClient.themeColor);
      setLogoDataUrl(editClient.logoDataUrl);
      setHourlyRate(editClient.hourlyRate);
      setNetTerms(editClient.netTerms);
    } else {
      setName("");
      setAddress("");
      setThemeColor(DEFAULT_COLOR);
      setLogoDataUrl(undefined);
      setHourlyRate(200);
      setNetTerms(30);
    }
  }, [editClient, open]);

  if (!open) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    if (!name.trim()) return;
    if (isEdit && onUpdate) {
      onUpdate(editClient.id, {
        name: name.trim(),
        address: address.trim(),
        themeColor,
        logoDataUrl,
        hourlyRate,
        netTerms,
      });
      onClose();
    } else {
      const client = onAdd({
        name: name.trim(),
        address: address.trim(),
        themeColor,
        logoDataUrl,
        hourlyRate,
        netTerms,
      });
      setName("");
      setAddress("");
      setThemeColor(DEFAULT_COLOR);
      setLogoDataUrl(undefined);
      setHourlyRate(200);
      setNetTerms(30);
      onCreated(client);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-xl w-[400px] max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4">
        <h3 className="text-base font-bold text-dark">
          {isEdit ? "Edit Client" : "New Client"}
        </h3>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-gray-500">Client Name *</span>
          <input
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Consulting"
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-gray-500">Address</span>
          <textarea
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 resize-none"
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={"1302 El Camino Real\nSuite 100\nSan Francisco, CA 94105"}
          />
        </label>

        {/* Logo upload */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-gray-500">Square Logo</span>
          <div className="flex items-center gap-3">
            {logoDataUrl ? (
              <img
                src={logoDataUrl}
                alt="Logo preview"
                className="w-10 h-10 rounded-md object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-md bg-gray-200 flex items-center justify-center text-[10px] text-gray-400">
                No logo
              </div>
            )}
            <button
              className="text-[12px] text-brand hover:underline"
              onClick={() => fileRef.current?.click()}
            >
              {logoDataUrl ? "Change" : "Upload"}
            </button>
            {logoDataUrl && (
              <button
                className="text-[12px] text-gray-400 hover:text-red-500"
                onClick={() => setLogoDataUrl(undefined)}
              >
                Remove
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Theme color */}
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-gray-500">Theme Color</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0"
            />
            <input
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 w-28 font-mono"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              placeholder="#006b51"
            />
          </div>
        </label>

        {/* Hourly rate + Payment terms */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-500">Hourly Rate ($)</span>
            <input
              type="number"
              min="0"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
              value={hourlyRate || ""}
              onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-500">Payment Terms</span>
            <select
              className="appearance-none border border-gray-200 rounded-lg px-3 pr-8 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M4.5%206l3.5%203.5L11.5%206%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat"
              value={netTerms}
              onChange={(e) => setNetTerms(Number(e.target.value) as NetTerms)}
            >
              <option value={15}>Net 15</option>
              <option value={30}>Net 30</option>
              <option value={45}>Net 45</option>
              <option value={60}>Net 60</option>
            </select>
          </label>
        </div>

        <div className="flex gap-2 mt-2">
          <button
            className="flex-1 bg-brand text-white font-semibold rounded-lg px-4 py-2.5 text-sm hover:bg-brand/90 transition-colors disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            {isEdit ? "Save Changes" : "Create Client"}
          </button>
          <button
            className="px-4 py-2.5 text-sm text-gray-500 hover:text-dark transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable client card row ── */

function ClientCard({
  client,
  active,
  onClick,
  onEdit,
  arrow,
  compact = false,
  showAddress = true,
}: {
  client: Client;
  active?: boolean;
  onClick: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  arrow?: "up" | "down";
  compact?: boolean;
  showAddress?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 border cursor-pointer transition-colors ${
        compact ? "rounded-lg p-2" : "rounded-xl px-3 py-2"
      } ${
        active
          ? "bg-[#edf3ee] border-[#d2ddd2]"
          : "bg-white/90 border-[#dde7dd] hover:bg-[#f1f6f1]"
      }`}
      onClick={onClick}
    >
      {client.logoDataUrl ? (
        <img
          src={client.logoDataUrl}
          alt=""
          className={`${compact ? "w-5 h-5" : "w-8 h-8"} rounded-md object-cover shrink-0`}
        />
      ) : (
        <div
          className={`${compact ? "w-5 h-5" : "w-8 h-8"} rounded-md shrink-0`}
          style={{ backgroundColor: client.themeColor }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className={`${compact ? "text-[13px]" : "text-sm"} font-semibold text-dark truncate`}>
          {client.name}
        </div>
        {showAddress && (
          <div className="text-[11px] text-gray-400 truncate">
            {client.address.split("\n")[0]}
          </div>
        )}
      </div>
      {onEdit && (
        <button
          className={`${compact ? "text-[10px]" : "text-[11px]"} text-[#7a8a80] hover:text-brand shrink-0 transition-colors`}
          onClick={onEdit}
        >
          Edit
        </button>
      )}
      {arrow && (
        <span className="text-gray-400 text-[10px] shrink-0">
          {arrow === "up" ? "\u25B2" : "\u25BC"}
        </span>
      )}
    </div>
  );
}

/* ── Inline client picker (card-based custom dropdown) ── */

interface PickerProps {
  clients: Client[];
  selectedClient: Client | null;
  onSelect: (client: Client) => void;
  onOpenCreate: () => void;
  onOpenEdit: (client: Client) => void;
  compact?: boolean;
  showAddress?: boolean;
}

export function ClientPicker({
  clients,
  selectedClient,
  onSelect,
  onOpenCreate,
  onOpenEdit,
  compact = false,
  showAddress = true,
}: PickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (clients.length === 0) {
    return (
      <button
        className={`w-full border border-dashed border-[#d1ddd1] ${
          compact ? "rounded-lg p-2 text-[12px]" : "rounded-xl px-4 py-3 text-sm"
        } text-[#6e7d74] hover:border-brand hover:text-brand transition-colors`}
        onClick={onOpenCreate}
      >
        + Create your first client
      </button>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Selected client card / trigger */}
      {selectedClient ? (
        <ClientCard
          client={selectedClient}
          active={open}
          compact={compact}
          showAddress={showAddress}
          onClick={() => setOpen(!open)}
          onEdit={(e) => {
            e.stopPropagation();
            onOpenEdit(selectedClient);
          }}
          arrow={open ? "up" : "down"}
        />
      ) : (
        <div
          className={`flex items-center justify-between bg-white/90 border border-[#dde7dd] ${
            compact ? "rounded-lg p-2" : "rounded-xl px-3 py-2"
          } cursor-pointer hover:bg-[#f1f6f1] transition-colors`}
          onClick={() => setOpen(!open)}
        >
          <span className={`${compact ? "text-[13px]" : "text-sm"} text-[#7a8a80]`}>Select a client...</span>
          <span className="text-[#7a8a80] text-[10px]">
            {open ? "\u25B2" : "\u25BC"}
          </span>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className={`absolute z-20 left-0 right-0 mt-1 bg-white/95 border border-[#d7e1d7] ${compact ? "rounded-lg" : "rounded-xl"} shadow-[0_12px_26px_rgba(15,23,42,0.10)] overflow-hidden`}>
          <div className="flex flex-col gap-1 p-2 max-h-[280px] overflow-y-auto">
            {clients.map((c) => (
              <ClientCard
                key={c.id}
                client={c}
                active={selectedClient?.id === c.id}
                compact={compact}
                showAddress={showAddress}
                onClick={() => {
                  onSelect(c);
                  setOpen(false);
                }}
                onEdit={(e) => {
                  e.stopPropagation();
                  onOpenEdit(c);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          <div className="border-t border-[#e4ece4] p-2">
            <button
              className="w-full text-left border border-[#d5dfd5] rounded-lg px-3 py-2 text-sm text-[#6e7d74] hover:text-brand hover:bg-[#f1f6f1] transition-colors"
              onClick={() => {
                onOpenCreate();
                setOpen(false);
              }}
            >
              + Create a new client
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
