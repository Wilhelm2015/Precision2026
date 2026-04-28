
import { EquipmentType, SANSCode, EquipmentDefinition, TaskType, ChecklistItem } from './types';

export const isSaqccCardValid = (inspectionDate: string, cardYear: string) => {
  const inspection = new Date(inspectionDate);
  const year = parseInt(cardYear);
  
  // Last day of February of cardYear
  const start = new Date(year, 2, 0); 
  
  // Last day of March of cardYear + 1
  const end = new Date(year + 1, 3, 0);
  
  return inspection >= start && inspection <= end;
}

export const SACAS_PERMIT_NUMBER = 'Prod/1475/00084';
export const QR_PROTOCOL = 'PFSA-1475:';

export const COMPANY_LOGO_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export const FLASH_FIRE_WARNING = 'SANS 1475 REGULATORY ALERT: Maintenance on "Flash Fire" brand equipment is strictly prohibited by South African law. Asset must be condemned.';

export const DISCARD_CHECKLIST: ChecklistItem[] = [
  { id: 'vessel_punctured', label: 'Vessel rendered inoperable', description: 'Cylinder has been drilled or cut to prevent re-pressurization.', required: true },
  { id: 'labels_removed', label: 'Regulatory labels destroyed', description: 'All service and manufacturer labels have been defaced.', required: true },
  { id: 'registry_voided', label: 'Digital Registry Voided', description: 'Unit has been marked as archived in the master fleet ledger.', required: true }
];

export const EQUIPMENT_DEFINITIONS: EquipmentDefinition[] = [
  {
    type: EquipmentType.EXTINGUISHER,
    standard: SANSCode.SANS_1475_1,
    checklists: {
      [TaskType.INSTALLATION]: [
        { id: 'sn_verified', label: 'Serial Number Verification', description: 'Verify physical serial matches tag.', required: true },
        { id: 'bracket_secure', label: 'Mounting Integrity', description: 'Bracket is secure and at regulatory height (1.2m - 1.5m).', required: true },
        { id: 'signage_present', label: 'ID Signage', description: 'SANS 1186-1 signage is visible from 15m.', required: true },
        { id: 'sabs_mark', label: 'SABS Approved Vessel', description: 'Confirm presence of SABS/SANS certification mark on cylinder.', required: true }
      ],
      [TaskType.MAINTENANCE]: [
        { id: 'vessel_condition', label: 'Vessel Structural Audit', description: 'Examine for external corrosion, deep pitting, or dents (SANS 1475 Clause 4).', required: true },
        { id: 'internal_inspect', label: 'Internal Examination', description: 'Disassembled and checked internal lining and medium condition (Clause 5.1).', required: true },
        { id: 'valve_overhaul', label: 'Valve Strip-down', description: 'Valve stripped, cleaned, lubricated, and O-rings replaced.', required: true },
        { id: 'pressure_gauge', label: 'Gauge Verification', description: 'Verified needle is in operative (green) range; glass is clear.', required: true },
        { id: 'safety_pin', label: 'Safety Pin & SANS Seal', description: 'Plastic pull-seal is the correct annual color and pin is secure.', required: true },
        { id: 'hose_nozzle', label: 'Discharge Passage', description: 'Verified hose is free of blockages and rubber is not perished.', required: true },
        { id: 'mass_check', label: 'Weight Verification', description: 'Asset weighed. Mass is within 5% manufacturer tolerance (Clause 5.4).', required: true },
        { id: 'operating_label', label: 'Instruction Labeling', description: 'Instruction label is legible and includes required official languages.', required: true },
        { id: 'service_label', label: 'SANS 1475 Service Label', description: 'New label applied with current year/month and SAQCC reg number.', required: true }
      ],
      [TaskType.PRESSURE_TEST]: [
        { id: 'vessel_stripped', label: 'Hydrostatic Disassembly', description: 'Valves and internal mechanisms removed for hydro-testing.', required: true },
        { id: 'hydro_test', label: 'Hydraulic Pressure Validation', description: 'Vessel tested to test pressure (usually 25-30 Bar) to verify elastic expansion.', required: true },
        { id: 'internal_dry', label: 'Moisture Extraction', description: 'Vessel dried thoroughly to prevent internal oxidation.', required: true }
      ],
      [TaskType.RECHARGE]: [
        { id: 'medium_replaced', label: 'Medium Replenishment', description: 'Charge replaced with fresh accredited SABS/SANS approved agent.', required: true },
        { id: 'seal_renewed', label: 'Tamper Protection', description: 'High-visibility safety seal applied to confirm recharge status.', required: true }
      ],
      [TaskType.INSPECTION]: [
        { id: 'visual_presence', label: 'Presence & Accessibility', description: 'Unit is in assigned location and unobstructed (SANS 10105-1).', required: true },
        { id: 'visual_seal', label: 'Tamper Status', description: 'Visual check that the safety seal and pin are intact.', required: true },
        { id: 'visual_gauge', label: 'Pressure Status', description: 'Needle is visible in the green zone.', required: true },
        { id: 'visual_corrosion', label: 'Surface Condition', description: 'No signs of leakage or significant surface rust.', required: true }
      ],
      [TaskType.FAULT]: [],
      [TaskType.ASSIGN_QR]: [],
      [TaskType.LINK_CLIENT]: [],
      [TaskType.FLOW_TEST]: [],
      [TaskType.REPLACE_EQUIPMENT]: [],
      [TaskType.CONDEMNATION]: [
        { id: 'wall_thinning', label: 'Cylinder Wall Integrity', description: 'Vessel wall thickness below SANS minimum safety margin.', required: true },
        { id: 'unapproved_brand', label: 'Unauthorized Vessel', description: 'Brand or manufacturer not recognized by SABS/SANS (e.g. Flash Fire).', required: true },
        { id: 'dent_limit', label: 'Mechanical Damage', description: 'Dents exceeding 10% of cylinder diameter or deep pitting detected.', required: true }
      ],
      [TaskType.DISCARD]: []
    }
  },
  {
    type: EquipmentType.CO2_EXTINGUISHER,
    standard: SANSCode.SANS_1475_1,
    checklists: {
      [TaskType.INSTALLATION]: [
        { id: 'sn_verified', label: 'Serial Number Verification', description: 'Verify physical serial matches tag.', required: true },
        { id: 'bracket_secure', label: 'Mounting Integrity', description: 'Bracket is secure and at regulatory height (1.2m - 1.5m).', required: true },
        { id: 'signage_present', label: 'ID Signage', description: 'SANS 1186-1 signage is visible from 15m.', required: true },
        { id: 'sabs_mark', label: 'SABS Approved Vessel', description: 'Confirm presence of SABS/SANS certification mark on cylinder.', required: true }
      ],
      [TaskType.MAINTENANCE]: [
        { id: 'vessel_condition', label: 'Vessel Structural Audit', description: 'Examine for external corrosion, deep pitting, or dents (SANS 1475 Clause 4).', required: true },
        { id: 'valve_overhaul', label: 'Valve & Bursting Disc Check', description: 'Valve assembly checked and bursting disc verified intact.', required: true },
        { id: 'safety_pin', label: 'Safety Pin & SANS Seal', description: 'Plastic pull-seal is the correct annual color and pin is secure.', required: true },
        { id: 'horn_hose', label: 'Discharge Horn & Hose', description: 'Verified horn is not cracked and hose is free of blockages.', required: true },
        { id: 'mass_check', label: 'Weight Verification', description: 'Asset weighed. Mass is within 5% manufacturer tolerance (Clause 5.4).', required: true },
        { id: 'operating_label', label: 'Instruction Labeling', description: 'Instruction label is legible and includes required official languages.', required: true },
        { id: 'service_label', label: 'SANS 1475 Service Label', description: 'New label applied with current year/month and SAQCC reg number.', required: true }
      ],
      [TaskType.PRESSURE_TEST]: [
        { id: 'vessel_stripped', label: 'Hydrostatic Disassembly', description: 'Valves and internal mechanisms removed for hydro-testing.', required: true },
        { id: 'hydro_test', label: 'Hydraulic Pressure Validation', description: 'Vessel tested to test pressure (usually 250 Bar for CO2) to verify elastic expansion.', required: true },
        { id: 'internal_dry', label: 'Moisture Extraction', description: 'Vessel dried thoroughly to prevent internal oxidation.', required: true }
      ],
      [TaskType.RECHARGE]: [
        { id: 'medium_replaced', label: 'CO2 Replenishment', description: 'Charge replaced with fresh accredited CO2 agent by weight.', required: true },
        { id: 'seal_renewed', label: 'Tamper Protection', description: 'High-visibility safety seal applied to confirm recharge status.', required: true }
      ],
      [TaskType.INSPECTION]: [
        { id: 'visual_presence', label: 'Presence & Accessibility', description: 'Unit is in assigned location and unobstructed (SANS 10105-1).', required: true },
        { id: 'visual_seal', label: 'Tamper Status', description: 'Visual check that the safety seal and pin are intact.', required: true },
        { id: 'visual_corrosion', label: 'Surface Condition', description: 'No signs of leakage or significant surface rust.', required: true }
      ],
      [TaskType.FAULT]: [],
      [TaskType.ASSIGN_QR]: [],
      [TaskType.LINK_CLIENT]: [],
      [TaskType.FLOW_TEST]: [],
      [TaskType.REPLACE_EQUIPMENT]: [],
      [TaskType.CONDEMNATION]: [
        { id: 'wall_thinning', label: 'Cylinder Wall Integrity', description: 'Vessel wall thickness below SANS minimum safety margin.', required: true },
        { id: 'unapproved_brand', label: 'Unauthorized Vessel', description: 'Brand or manufacturer not recognized by SABS/SANS.', required: true },
        { id: 'dent_limit', label: 'Mechanical Damage', description: 'Dents exceeding 10% of cylinder diameter or deep pitting detected.', required: true }
      ],
      [TaskType.DISCARD]: []
    }
  },
  {
    type: EquipmentType.HOSE_REEL,
    standard: SANSCode.SANS_1475_2,
    checklists: {
      [TaskType.MAINTENANCE]: [
        { id: 'hr_mounting', label: 'Structural Anchorage', description: 'Reel frame is securely anchored to building structure.', required: true },
        { id: 'hr_rotation', label: 'Operational Rotation', description: 'Drum rotates freely through 360 degrees without binding.', required: true },
        { id: 'hr_hose', label: 'Hose Integrity (30m)', description: 'No leaks or perishing across full 30m length under static pressure.', required: true },
        { id: 'hr_nozzle', label: 'Flow Control Nozzle', description: 'Nozzle opens/closes and adjusts spray pattern correctly.', required: true },
        { id: 'hr_gland', label: 'Spindle Gland Seal', description: 'Verified no leakage at the central water connection/spindle.', required: true },
        { id: 'hr_isolating', label: 'Stopcock Accessibility', description: 'Isolating valve is visible and easy to operate.', required: true },
        { id: 'hr_operating_label', label: 'Instruction Labeling', description: 'Instruction label is legible and includes required official languages.', required: true },
        { id: 'hr_signage', label: 'SANS 1186-1 Signage', description: 'Location signage is present and clear.', required: true }
      ],
      [TaskType.FLOW_TEST]: [
        { id: 'hr_static', label: 'Static Pressure Check', description: 'Recorded pressure with nozzle closed (kPa).', required: true },
        { id: 'hr_flow', label: 'Dynamic Flow Rate', description: 'Verified minimum discharge of 24L/min at 200kPa (SANS 1128).', required: true }
      ],
      [TaskType.INSPECTION]: [
        { id: 'hr_visual_hose', label: 'Hose Winding', description: 'Hose is neatly layered and nozzle is secured in holder.', required: true },
        { id: 'hr_visual_access', label: 'Unobstructed Access', description: 'No furniture or stock blocking the reel operation.', required: true }
      ],
      [TaskType.INSTALLATION]: [
        { id: 'hr_sn_verified', label: 'Serial Number Verification', description: 'Verify physical serial matches tag.', required: true },
        { id: 'hr_mounting_integrity', label: 'Structural Anchorage', description: 'Reel frame is securely anchored to building structure.', required: true },
        { id: 'hr_signage_present', label: 'ID Signage', description: 'SANS 1186-1 signage is visible from 15m.', required: true },
        { id: 'hr_sabs_mark', label: 'SABS Approved Component', description: 'Confirm presence of SABS/SANS certification mark on reel.', required: true }
      ],
      [TaskType.RECHARGE]: [],
      [TaskType.FAULT]: [],
      [TaskType.ASSIGN_QR]: [],
      [TaskType.LINK_CLIENT]: [],
      [TaskType.PRESSURE_TEST]: [],
      [TaskType.REPLACE_EQUIPMENT]: [],
      [TaskType.CONDEMNATION]: [],
      [TaskType.DISCARD]: []
    }
  },
  {
    type: EquipmentType.HYDRANT,
    standard: SANSCode.SANS_1475_2,
    checklists: {
      [TaskType.MAINTENANCE]: [
        { id: 'hy_wheel', label: 'Handwheel Condition', description: 'Wheel is present, secured, and not cracked.', required: true },
        { id: 'hy_washer', label: 'Main Valve Washer', description: 'Checked/replaced jumper washer to ensure drop-tight seal.', required: true },
        { id: 'hy_threads', label: 'Inlet Coupling', description: 'Threads/lugs cleaned and lubricated (Instantaneous).', required: true },
        { id: 'hy_cap', label: 'Protection Cap & Chain', description: 'Blank cap is present to protect coupling from debris.', required: true },
        { id: 'hy_packing', label: 'Gland Packing', description: 'Gland packing adjusted/replaced to prevent stem leakage.', required: true }
      ],
      [TaskType.FLOW_TEST]: [
        { id: 'hy_discharge', label: 'Discharge Volume', description: 'Verified adequate discharge for fire brigade intervention.', required: true }
      ],
      [TaskType.INSPECTION]: [
        { id: 'hy_visual_access', label: 'Fire Brigade Access', description: 'Access to valve is not obstructed or hidden.', required: true }
      ],
      [TaskType.INSTALLATION]: [
        { id: 'hy_sn_verified', label: 'Serial Number Verification', description: 'Verify physical serial matches tag.', required: true },
        { id: 'hy_access_verified', label: 'Accessibility', description: 'Hydrant is unobstructed and clearly visible.', required: true },
        { id: 'hy_signage_present', label: 'ID Signage', description: 'SANS 1186-1 signage is visible from 15m.', required: true },
        { id: 'hy_sabs_mark', label: 'SABS Approved Component', description: 'Confirm presence of SABS/SANS certification mark on valve.', required: true }
      ],
      [TaskType.RECHARGE]: [],
      [TaskType.FAULT]: [],
      [TaskType.ASSIGN_QR]: [],
      [TaskType.LINK_CLIENT]: [],
      [TaskType.PRESSURE_TEST]: [],
      [TaskType.REPLACE_EQUIPMENT]: [],
      [TaskType.CONDEMNATION]: [],
      [TaskType.DISCARD]: []
    }
  },
  {
    type: EquipmentType.BOOSTER_CONNECTION,
    standard: SANSCode.SANS_1475_2,
    checklists: {
      [TaskType.MAINTENANCE]: [
        { id: 'bc_accessibility', label: 'Accessibility & Visibility', description: 'Booster is unobstructed and clearly visible for Fire Brigade.', required: true },
        { id: 'bc_couplings', label: 'Inlet Couplings', description: 'Threads/Lugs cleaned, lubricated and verified for easy connection.', required: true },
        { id: 'bc_caps', label: 'Blank Caps & Chains', description: 'Caps are present and chains are secure to prevent debris entry.', required: true },
        { id: 'bc_non_return', label: 'Non-Return Valve', description: 'Verified that the non-return valve is operational and not seized.', required: true },
        { id: 'bc_drain', label: 'Drainage Valve', description: 'Automatic or manual drain valve is functional to prevent freezing/corrosion.', required: true },
        { id: 'bc_signage', label: 'SANS 1186-1 Signage', description: 'Booster identification signage is present and correct.', required: true }
      ],
      [TaskType.INSPECTION]: [
        { id: 'bc_visual_access', label: 'Visual Access', description: 'No obstructions blocking Fire Brigade access.', required: true },
        { id: 'bc_visual_caps', label: 'Caps Present', description: 'Visual check that blank caps are in place.', required: true }
      ],
      [TaskType.INSTALLATION]: [
        { id: 'bc_sn_verified', label: 'Serial Number Verification', description: 'Verify physical serial matches tag.', required: true },
        { id: 'bc_access_verified', label: 'Accessibility & Visibility', description: 'Booster is unobstructed and clearly visible for Fire Brigade.', required: true },
        { id: 'bc_signage_present', label: 'ID Signage', description: 'SANS 1186-1 signage is visible from 15m.', required: true },
        { id: 'bc_sabs_mark', label: 'SABS Approved Component', description: 'Confirm presence of SABS/SANS certification mark on booster.', required: true }
      ],
      [TaskType.RECHARGE]: [],
      [TaskType.FAULT]: [],
      [TaskType.ASSIGN_QR]: [],
      [TaskType.LINK_CLIENT]: [],
      [TaskType.PRESSURE_TEST]: [],
      [TaskType.REPLACE_EQUIPMENT]: [],
      [TaskType.CONDEMNATION]: [],
      [TaskType.DISCARD]: [],
      [TaskType.FLOW_TEST]: []
    }
  },
  {
    type: EquipmentType.FIRE_BLANKET,
    standard: SANSCode.SANS_10105_1,
    checklists: {
      [TaskType.INSPECTION]: [
        { id: 'fb_presence', label: 'Presence & Accessibility', description: 'Blanket is in assigned location and unobstructed.', required: true },
        { id: 'fb_condition', label: 'Container Condition', description: 'Container is not damaged and blanket is accessible.', required: true }
      ],
      [TaskType.MAINTENANCE]: [],
      [TaskType.INSTALLATION]: [],
      [TaskType.RECHARGE]: [],
      [TaskType.FAULT]: [],
      [TaskType.ASSIGN_QR]: [],
      [TaskType.LINK_CLIENT]: [],
      [TaskType.PRESSURE_TEST]: [],
      [TaskType.FLOW_TEST]: [],
      [TaskType.REPLACE_EQUIPMENT]: [],
      [TaskType.CONDEMNATION]: [],
      [TaskType.DISCARD]: []
    }
  },
  {
    type: EquipmentType.SMOKE_DETECTOR,
    standard: SANSCode.SANS_10105_1,
    checklists: {
      [TaskType.INSPECTION]: [
        { id: 'sd_presence', label: 'Presence & Condition', description: 'Detector is present and not damaged.', required: true },
        { id: 'sd_test', label: 'Operational Test', description: 'Detector responds to test signal.', required: true }
      ],
      [TaskType.MAINTENANCE]: [],
      [TaskType.INSTALLATION]: [],
      [TaskType.RECHARGE]: [],
      [TaskType.FAULT]: [],
      [TaskType.ASSIGN_QR]: [],
      [TaskType.LINK_CLIENT]: [],
      [TaskType.PRESSURE_TEST]: [],
      [TaskType.FLOW_TEST]: [],
      [TaskType.REPLACE_EQUIPMENT]: [],
      [TaskType.CONDEMNATION]: [],
      [TaskType.DISCARD]: []
    }
  },
  {
    type: EquipmentType.FIRE_DOOR,
    standard: SANSCode.SANS_10105_1,
    checklists: {
      [TaskType.INSPECTION]: [
        { id: 'fd_presence', label: 'Presence & Condition', description: 'Door is present and not damaged.', required: true },
        { id: 'fd_operation', label: 'Operational Test', description: 'Door closes and latches correctly.', required: true }
      ],
      [TaskType.MAINTENANCE]: [],
      [TaskType.INSTALLATION]: [],
      [TaskType.RECHARGE]: [],
      [TaskType.FAULT]: [],
      [TaskType.ASSIGN_QR]: [],
      [TaskType.LINK_CLIENT]: [],
      [TaskType.PRESSURE_TEST]: [],
      [TaskType.FLOW_TEST]: [],
      [TaskType.REPLACE_EQUIPMENT]: [],
      [TaskType.CONDEMNATION]: [],
      [TaskType.DISCARD]: []
    }
  }
];
