
export enum EquipmentType {
  EXTINGUISHER = 'Fire Extinguisher',
  CO2_EXTINGUISHER = 'CO2 Fire Extinguisher',
  HOSE_REEL = 'Fire Hose Reel',
  HYDRANT = 'Fire Hydrant',
  FIRE_BLANKET = 'Fire Blanket',
  SMOKE_DETECTOR = 'Smoke Detector',
  FIRE_DOOR = 'Fire Door',
  BOOSTER_CONNECTION = 'Booster Connection'
}

export enum TaskType {
  INSTALLATION = 'New Installation',
  MAINTENANCE = 'Maintenance',
  INSPECTION = 'Inspection',
  RECHARGE = 'Recharge',
  FAULT = 'Report Fault',
  ASSIGN_QR = 'Assign QR Tag',
  LINK_CLIENT = 'Link to Site',
  PRESSURE_TEST = 'Pressure Test',
  FLOW_TEST = 'Flow Rate Test',
  REPLACE_EQUIPMENT = 'Replace Equipment',
  CONDEMNATION = 'Condemnation',
  DISCARD = 'Final Disposal'
}

export enum SANSCode {
  SANS_1475_1 = 'SANS 1475-1',
  SANS_1475_2 = 'SANS 1475-2',
  SANS_10105_1 = 'SANS 10105-1',
  SANS_1186_1 = 'SANS 1186-1'
}

export interface SyncEvent {
  id: string;
  table: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  timestamp: string;
  details: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  required: boolean;
}

export interface EquipmentDefinition {
  type: EquipmentType;
  standard: SANSCode;
  checklists: Record<TaskType, ChecklistItem[] | undefined>;
}

export interface InspectionRecord {
  id: string;
  equipmentId: string;
  equipment_id?: string;
  asset_id?: string;
  equipmentType: EquipmentType;
  equipment_type?: EquipmentType;
  taskType: TaskType;
  task_type?: TaskType;
  inspectorName: string;
  inspector_name?: string;
  inspectorSignature?: string; 
  inspector_signature?: string;
  technicianId?: string;
  technician_id?: string;
  date: string; 
  status: 'Pass' | 'Fail' | 'Service Required' | 'Condemned' | 'Discarded' | 'pass' | 'fail' | 'conditional';
  findings: any;
  notes?: string;
  recommendations?: string;
  photos?: string[];
  recordedMass?: string; 
  recorded_mass?: string;
  flow_pressure_kpa?: string;
  pressure_kpa?: string;
  flow_lpm?: string;
  calculatedFlowLpm?: string;
  calculated_flow_lpm?: string;
  manufactureDate?: string;
  manufacture_date?: string;
  lastPressureTestDate?: string;
  last_pressure_test_date?: string;
  sealSerialNumber?: string;
  seal_serial_number?: string;
  testedToKpa?: string;
  tested_to_kpa?: string;
  hydrantType?: 'Wheel' | 'Tamperproof';
  hydrant_type?: 'Wheel' | 'Tamperproof';
  pressureTestOption?: 'now' | 'later';
  pressure_test_option?: 'now' | 'later';
  signature?: string;
  subUserId?: string;
  sub_user_id?: string;
  created_at?: string;
}

export interface FaultReport {
  id: string;
  equipmentId: string;
  equipment_id?: string;
  asset_id?: string;
  reporterName?: string;
  reporterContact?: string;
  reportedBy?: string;
  reportedDate?: string;
  description: string;
  timestamp?: string;
  status: 'Open' | 'Resolved' | 'open' | 'in-progress' | 'resolved';
  photos?: string[];
  assignedTechnicianId?: string;
  assigned_technician_id?: string;
  resolutionNotes?: string;
  resolution_notes?: string;
  resolutionPhotos?: string[];
  resolution_photos?: string[];
  resolutionDate?: string;
  resolution_date?: string;
  severity?: 'Critical' | 'Urgent' | 'Standard' | 'low' | 'medium' | 'high' | 'critical';
  slaDeadline?: string;
  sla_deadline?: string;
  subUserId?: string;
  sub_user_id?: string;
  created_at?: string;
}

export interface Equipment {
  id: string;
  serialNumber: string;
  type: EquipmentType;
  size?: string; 
  manufacturer?: string;
  make?: string;
  model?: string;
  capacity?: string;
  manufactureDate?: string; 
  manufactureDateUnknown?: boolean;
  location: string;
  unitNumber?: string; 
  lastInspectionDate: string | null; 
  lastServiceDate?: string;
  nextServiceDate: string; 
  lastPressureTestDate?: string; 
  nextPressureTestDate?: string; 
  pressureTestDateUnknown?: boolean;
  isPressureTestNonCompliant?: boolean;
  client_id?: string | null;
  clientId?: string | null;
  qrCode?: string;
  photos?: string[]; 
  sealSerialNumber?: string;
  isArchived?: boolean;
  archivedAt?: string;
  status?: 'active' | 'inactive' | 'faulty';
  created_at?: string;
}

export interface Client {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  siteName?: string;
  building?: string;
  address: string;
  email?: string;
  cellphone?: string;
  createdAt: string;
  created_at?: string;
  portalPin?: string;
  portalPaused?: boolean;
  portalAccessGranted?: boolean;
  slaAmount?: string;
  isArchived?: boolean;
  archivedAt?: string;
  technicianId?: string;
  notes?: string;
}

export interface SubUser {
  id: string;
  name: string;
  pin: string;
  signature?: string;
  saqccCardPhoto?: string;
  saqccCards?: { [year: string]: string };
}

export interface Technician {
  id: string;
  userid?: string; 
  name: string;
  saqcc: string;
  saqccNumber?: string;
  email: string;
  pin?: string; 
  phone?: string;
  cellphone?: string;
  signature?: string; 
  saqccCardPhoto?: string;
  saqccCards?: { [year: string]: string } | string[];
  subUsers?: SubUser[];
  role?: 'admin' | 'technician' | 'manager';
  specialization?: string;
  created_at?: string;
}

export interface AdvisorResponse {
  text: string;
  sources: any[];
}

export interface SavedReport {
  id: string;
  client_id: string;
  type: string;
  date: string;
  data: {
    equipment: Equipment[];
    records: InspectionRecord[];
    faults: FaultReport[];
  };
  created_at: string;
}
