import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

export interface ParsedAddress {
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  lat?: number;
  lng?: number;
  formatted: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (parsed: ParsedAddress) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address…",
  className,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loaded, setLoaded] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

  // Load Google Maps script
  useEffect(() => {
    if (!apiKey) return; // graceful degradation — no key, no autocomplete

    if ((window as any).google?.maps?.places) {
      setLoaded(true);
      return;
    }

    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener("load", () => setLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, [apiKey]);

  const stableOnSelect = useCallback(onSelect, []);

  // Initialize autocomplete
  useEffect(() => {
    if (!loaded || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      types: ["address"],
      fields: ["address_components", "formatted_address", "geometry"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.address_components) return;

      const get = (type: string) =>
        place.address_components?.find((c) => c.types.includes(type))?.long_name ?? "";
      const getShort = (type: string) =>
        place.address_components?.find((c) => c.types.includes(type))?.short_name ?? "";

      const streetNumber = get("street_number");
      const street = get("route");
      const city =
        get("locality") || get("sublocality_level_1") || get("administrative_area_level_3");
      const county = get("administrative_area_level_2").replace(" County", "");
      const state = getShort("administrative_area_level_1");
      const zip = get("postal_code");

      const parsed: ParsedAddress = {
        address: `${streetNumber} ${street}`.trim(),
        city,
        state,
        zip,
        county,
        lat: place.geometry?.location?.lat(),
        lng: place.geometry?.location?.lng(),
        formatted: place.formatted_address ?? "",
      };

      onChange(parsed.address);
      stableOnSelect(parsed);
    });

    autocompleteRef.current = autocomplete;
  }, [loaded, onChange, stableOnSelect]);

  return (
    <div className="relative">
      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`pl-10 ${className ?? ""}`}
        autoComplete="off"
      />
      {!apiKey && (
        <p className="mt-1 text-[10px] text-muted-foreground/50">Address autocomplete unavailable — enter manually</p>
      )}
    </div>
  );
}
