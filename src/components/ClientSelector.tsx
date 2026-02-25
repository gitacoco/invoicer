import { useState, useRef, useEffect } from "react";
import type { Client } from "../types";

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
  const fileRef = useRef<HTMLInputElement>(null);

  const isEdit = !!editClient;

  // Populate fields when editing
  useEffect(() => {
    if (editClient) {
      setName(editClient.name);
      setAddress(editClient.address);
      setThemeColor(editClient.themeColor);
      setLogoDataUrl(editClient.logoDataUrl);
    } else {
      setName("");
      setAddress("");
      setThemeColor(DEFAULT_COLOR);
      setLogoDataUrl(undefined);
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
      });
      onClose();
    } else {
      const client = onAdd({
        name: name.trim(),
        address: address.trim(),
        themeColor,
        logoDataUrl,
      });
      setName("");
      setAddress("");
      setThemeColor(DEFAULT_COLOR);
      setLogoDataUrl(undefined);
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
}: {
  client: Client;
  active?: boolean;
  onClick: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  arrow?: "up" | "down";
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer transition-colors ${
        active
          ? "bg-gray-100 ring-1 ring-brand/30"
          : "bg-gray-50 hover:bg-gray-100"
      }`}
      onClick={onClick}
    >
      {client.logoDataUrl ? (
        <img
          src={client.logoDataUrl}
          alt=""
          className="w-8 h-8 rounded-md object-cover shrink-0"
        />
      ) : (
        <div
          className="w-8 h-8 rounded-md shrink-0"
          style={{ backgroundColor: client.themeColor }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-dark truncate">
          {client.name}
        </div>
        <div className="text-[11px] text-gray-400 truncate">
          {client.address.split("\n")[0]}
        </div>
      </div>
      {onEdit && (
        <button
          className="text-[11px] text-gray-400 hover:text-brand shrink-0 transition-colors"
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
}

export function ClientPicker({
  clients,
  selectedClient,
  onSelect,
  onOpenCreate,
  onOpenEdit,
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
        className="w-full border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:border-brand hover:text-brand transition-colors"
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
          onClick={() => setOpen(!open)}
          onEdit={(e) => {
            e.stopPropagation();
            onOpenEdit(selectedClient);
          }}
          arrow={open ? "up" : "down"}
        />
      ) : (
        <div
          className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => setOpen(!open)}
        >
          <span className="text-sm text-gray-400">Select a client...</span>
          <span className="text-gray-400 text-[10px]">
            {open ? "\u25B2" : "\u25BC"}
          </span>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="flex flex-col gap-1 p-2 max-h-[280px] overflow-y-auto">
            {clients.map((c) => (
              <ClientCard
                key={c.id}
                client={c}
                active={selectedClient?.id === c.id}
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
          <div className="border-t border-gray-100 p-2">
            <button
              className="w-full text-left rounded-lg px-4 py-2.5 text-sm text-gray-500 hover:text-brand hover:bg-gray-50 transition-colors"
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
