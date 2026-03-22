import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Info } from "lucide-react";
import { SPECIAL_INSPECTION_TYPES } from "./orderServices";

export interface ServiceSpecificData {
  fastenerManufacturer: string;
  insertingFastenersInto: string;
  fastenersNewExisting: string;
  tileType: string;
  tileShape: string;
  attachmentMethod: string;
  roofCompleted: string;
  permitNumber: string;
  brokenTiles: string;
  brokenTilesNotes: string;
  failedTilesCaps: string;
  failedTilesCapsNotes: string;
  deckAttachment: string;
  specialGridRequirements: string;
  gridDetails: string;
  builtUpRoofSystem: string;
  gravelBallast: string;
  drainageInfo: string;
  inspectionTypes: string[];
  scheduleContactName: string;
  scheduleContactPhone: string;
}

const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, "").slice(0, 10);
  if (numbers.length >= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`;
  if (numbers.length >= 3) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
  return numbers;
};

interface Props {
  selectedServices: string[];
  data: ServiceSpecificData;
  onChange: (data: ServiceSpecificData) => void;
  roofArea: number;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <h4 className="text-sm font-semibold text-primary">{title}</h4>
      {children}
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-hvhz-amber/30 bg-hvhz-amber/5 p-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-hvhz-amber mt-0.5" />
      <p className="text-xs text-hvhz-amber">{children}</p>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-hvhz-teal/30 bg-hvhz-teal/5 p-3">
      <Info className="h-4 w-4 shrink-0 text-hvhz-teal mt-0.5" />
      <p className="text-xs text-hvhz-teal">{children}</p>
    </div>
  );
}

export function ServiceSpecificFields({ selectedServices, data, onChange, roofArea }: Props) {
  const set = (field: keyof ServiceSpecificData, value: any) =>
    onChange({ ...data, [field]: value });

  const toggleInspection = (type: string) => {
    const current = data.inspectionTypes;
    set(
      "inspectionTypes",
      current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type]
    );
  };

  if (selectedServices.length === 0) return null;

  const gridSize = roofArea < 75 ? "5' x 5'" : "10' x 10'";

  return (
    <div className="space-y-4">
      {selectedServices.includes("tas-105") && (
        <Card title="TAS-105 Field Withdrawal Test">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Fastener Manufacturer & Type</Label>
              <Input value={data.fastenerManufacturer} onChange={(e) => set("fastenerManufacturer", e.target.value)} placeholder="e.g., Hilti HWS" />
            </div>
            <div>
              <Label>Inserting Fasteners Into</Label>
              <Input value={data.insertingFastenersInto} onChange={(e) => set("insertingFastenersInto", e.target.value)} placeholder="e.g., concrete deck" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fasteners: New or Existing?</Label>
            <RadioGroup value={data.fastenersNewExisting} onValueChange={(v) => set("fastenersNewExisting", v)} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="new" id="f-new" /><Label htmlFor="f-new" className="font-normal">New</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="existing" id="f-existing" /><Label htmlFor="f-existing" className="font-normal">Existing</Label></div>
            </RadioGroup>
          </div>
          <WarningBox>Client must install screw fasteners to be tested and have them onsite.</WarningBox>
        </Card>
      )}

      {selectedServices.includes("tas-106") && (
        <Card title="TAS-106 Tile Bonding Verification">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Tile Type</Label>
              <Input value={data.tileType} onChange={(e) => set("tileType", e.target.value)} placeholder="e.g., concrete, clay" />
            </div>
            <div>
              <Label>Tile Shape</Label>
              <Input value={data.tileShape} onChange={(e) => set("tileShape", e.target.value)} placeholder="e.g., flat, barrel" />
            </div>
            <div>
              <Label>Attachment Method</Label>
              <Select value={data.attachmentMethod} onValueChange={(v) => set("attachmentMethod", v)}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mortar-Set">Mortar-Set</SelectItem>
                  <SelectItem value="Adhesive-Set">Adhesive-Set</SelectItem>
                  <SelectItem value="Mechanical">Mechanical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Permit #</Label>
              <Input value={data.permitNumber} onChange={(e) => set("permitNumber", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Roof Completed?</Label>
              <RadioGroup value={data.roofCompleted} onValueChange={(v) => set("roofCompleted", v)} className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="rc-y" /><Label htmlFor="rc-y" className="font-normal">Yes</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="no" id="rc-n" /><Label htmlFor="rc-n" className="font-normal">No</Label></div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Broken Tiles?</Label>
              <RadioGroup value={data.brokenTiles} onValueChange={(v) => set("brokenTiles", v)} className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="bt-y" /><Label htmlFor="bt-y" className="font-normal">Yes</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="no" id="bt-n" /><Label htmlFor="bt-n" className="font-normal">No</Label></div>
              </RadioGroup>
            </div>
          </div>
          {data.brokenTiles === "yes" && (
            <div>
              <Label>Broken Tiles Notes</Label>
              <Input value={data.brokenTilesNotes} onChange={(e) => set("brokenTilesNotes", e.target.value)} />
            </div>
          )}
        </Card>
      )}

      {selectedServices.includes("tas-124") && (
        <Card title="TAS-124 Bonded Pull Test">
          <div className="space-y-2">
            <Label>Deck Attachment</Label>
            <RadioGroup value={data.deckAttachment} onValueChange={(v) => set("deckAttachment", v)} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="mechanically-attached" id="da-m" /><Label htmlFor="da-m" className="font-normal">Mechanically Attached</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="fully-adhered" id="da-f" /><Label htmlFor="da-f" className="font-normal">Fully Adhered</Label></div>
            </RadioGroup>
          </div>
        </Card>
      )}

      {selectedServices.includes("tas-126") && (
        <Card title="TAS-126 Roof Moisture Survey">
          <InfoBox>Default Grid Size: {gridSize}</InfoBox>
          <div className="space-y-2">
            <Label>Special Test Grid Requirements?</Label>
            <RadioGroup value={data.specialGridRequirements} onValueChange={(v) => set("specialGridRequirements", v)} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="sg-y" /><Label htmlFor="sg-y" className="font-normal">Yes</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="no" id="sg-n" /><Label htmlFor="sg-n" className="font-normal">No</Label></div>
            </RadioGroup>
          </div>
          {data.specialGridRequirements === "yes" && (
            <div>
              <Label>Grid Details</Label>
              <Input value={data.gridDetails} onChange={(e) => set("gridDetails", e.target.value)} />
            </div>
          )}
          <div>
            <Label>Type of Built-Up Roof System</Label>
            <Input value={data.builtUpRoofSystem} onChange={(e) => set("builtUpRoofSystem", e.target.value)} placeholder="e.g., 4-ply BUR" />
          </div>
          <div className="space-y-2">
            <Label>Gravel or Ballast Rock Covering?</Label>
            <RadioGroup value={data.gravelBallast} onValueChange={(v) => set("gravelBallast", v)} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="gb-y" /><Label htmlFor="gb-y" className="font-normal">Yes</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="no" id="gb-n" /><Label htmlFor="gb-n" className="font-normal">No</Label></div>
            </RadioGroup>
          </div>
        </Card>
      )}

      {selectedServices.includes("drainage") && (
        <Card title="Roof Drainage Data Collection">
          <div>
            <Label>Additional Drainage Information</Label>
            <Textarea value={data.drainageInfo} onChange={(e) => set("drainageInfo", e.target.value)} placeholder="Location of drains, sizes, primary/secondary drain details..." />
          </div>
          <InfoBox>Remember to upload a sketch of primary/secondary drains in the file upload section.</InfoBox>
        </Card>
      )}

      {selectedServices.includes("special-inspection") && (
        <Card title="Special Inspections Details">
          <div className="space-y-2">
            <Label>Inspection Type(s)</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {SPECIAL_INSPECTION_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={data.inspectionTypes.includes(type)}
                    onCheckedChange={() => toggleInspection(type)}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Contact Person to Schedule Access</Label>
              <Input value={data.scheduleContactName} onChange={(e) => set("scheduleContactName", e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={data.scheduleContactPhone} onChange={(e) => set("scheduleContactPhone", formatPhone(e.target.value))} />
            </div>
          </div>
          <WarningBox>Email any pictures if requesting a missed inspection.</WarningBox>
        </Card>
      )}
    </div>
  );
}
