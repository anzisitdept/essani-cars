import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface Client {
    id: string;
    name: string;
    phone: string;
    [key: string]: any;
}

interface ClientSelectorProps {
    clients: Client[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export function ClientSelector({ clients, value, onChange, placeholder = "Select Client..." }: ClientSelectorProps) {
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const selectedClient = clients.find((client) => client.id === value);

    const filteredClients = useMemo(() => {
        if (!searchQuery) return clients;
        const lowerQuery = searchQuery.toLowerCase();
        return clients.filter(
            (client) =>
                client.name.toLowerCase().includes(lowerQuery) ||
                (client.phone && client.phone.includes(lowerQuery))
        );
    }, [clients, searchQuery]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-white font-normal hover:bg-slate-50 border-slate-200"
                >
                    {selectedClient ? (
                        <span className="truncate">
                            {selectedClient.name} <span className="text-slate-400 text-xs ml-1">{selectedClient.phone}</span>
                        </span>
                    ) : (
                        <span className="text-slate-500">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <Input
                        placeholder="Search by name or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-500 border-none focus-visible:ring-0 px-0"
                    />
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1">
                    {filteredClients.length === 0 ? (
                        <div className="py-6 text-center text-sm text-slate-500 flex flex-col items-center">
                            <User className="h-8 w-8 mb-2 opacity-20" />
                            No client found.
                        </div>
                    ) : (
                        filteredClients.map((client) => (
                            <div
                                key={client.id}
                                onClick={() => {
                                    onChange(client.id);
                                    setOpen(false);
                                    setSearchQuery("");
                                }}
                                className={cn(
                                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-slate-100 cursor-pointer transition-colors",
                                    value === client.id ? "bg-blue-50 text-blue-700" : "text-slate-900"
                                )}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === client.id ? "opacity-100 text-blue-600" : "opacity-0"
                                    )}
                                />
                                <div className="flex flex-col">
                                    <span className="font-medium">{client.name}</span>
                                    <span className="text-xs text-slate-500">{client.phone}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
