import {
  ConditionalActionType,
  ConditionalOperator,
  SectionType,
} from '../entities/enums';

type YesNoOptions = Array<{ label: string; value: string }>;

const YES_NO_OPTIONS: YesNoOptions = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
];

type ConditionRule = {
  fieldId: string;
  operator: ConditionalOperator | string;
  value?: unknown;
};

type FieldConditions = {
  action: ConditionalActionType | string;
  logic?: 'and' | 'or';
  rules: ConditionRule[];
};

type TemplateFieldSeed = {
  id: string;
  label: string;
  name: string;
  type: string;
  required?: boolean;
  width?: string;
  value?: unknown;
  options?: Array<{ label: string; value: string }>;
  optionSource?: Record<string, unknown>;
  conditions?: FieldConditions;
};

type TemplateRowSeed = {
  id: string;
  fields: TemplateFieldSeed[];
};

type TemplateSectionSeed = {
  id: string;
  type: SectionType | string;
  name: string;
  sortOrder: number;
  conditions?: FieldConditions;
  rows: TemplateRowSeed[];
};

export type RestaurantTemplateSeed = {
  name: string;
  formName: string;
  /** Tenant job position names used for assign step. */
  assignJobPositions: string[];
  /** Tenant job position names used for report step. */
  reportJobPositions: string[];
  sections: TemplateSectionSeed[];
};

function showWhen(fieldId: string, value: unknown, operator: ConditionalOperator = ConditionalOperator.EQUALS): FieldConditions {
  return {
    action: ConditionalActionType.SHOW,
    logic: 'and',
    rules: [{ fieldId, operator, value }],
  };
}

function showWhenAny(rules: ConditionRule[]): FieldConditions {
  return {
    action: ConditionalActionType.SHOW,
    logic: 'or',
    rules,
  };
}

function checklistQuestionRow(
  rowId: string,
  fieldPrefix: string,
  question: string,
  corrective?: { label: string; name: string; required?: boolean },
): TemplateRowSeed[] {
  const responseFieldId = `${fieldPrefix}_response`;
  const rows: TemplateRowSeed[] = [
    {
      id: rowId,
      fields: [
        {
          id: `${fieldPrefix}_question`,
          label: 'Check Item',
          name: `${fieldPrefix}_question`,
          type: 'textarea',
          required: true,
          width: '60%',
          value: question,
        },
        {
          id: responseFieldId,
          label: 'Response',
          name: `${fieldPrefix}_response`,
          type: 'yesNo',
          required: true,
          width: '40%',
          options: YES_NO_OPTIONS,
        },
      ],
    },
  ];

  if (corrective) {
    rows.push({
      id: `${rowId}_followup`,
      fields: [
        {
          id: `${fieldPrefix}_corrective`,
          label: corrective.label,
          name: corrective.name,
          type: 'textarea',
          required: corrective.required ?? true,
          width: '100%',
          conditions: showWhen(responseFieldId, 'no'),
        },
      ],
    });
  }

  return rows;
}

const ITEM_OPTION_SOURCE = {
  type: 'dynamic',
  method: 'GET',
  endpoint: 'items',
  response: { dataPath: 'data', labelKey: 'name', valueKey: 'id' },
};

/** Food restaurant industry data-collection templates (sections ordered by sortOrder). */
export const RESTAURANT_DC_TEMPLATE_SEEDS: readonly RestaurantTemplateSeed[] = [
  {
    name: 'Daily Kitchen Opening Checklist',
    formName: 'Daily Kitchen Opening Checklist',
    assignJobPositions: ['Line Cook', 'Commis Chef', 'Kitchen Porter', 'Head Chef'],
    reportJobPositions: ['Restaurant Manager', 'Head Chef'],
    sections: [
      {
        id: 'sec_ko_shift',
        type: SectionType.RESPONSE_FORM,
        name: 'Shift Details',
        sortOrder: 1,
        rows: [
          {
            id: 'row_ko_shift_type',
            fields: [
              {
                id: 'fld_ko_shift_type',
                label: 'Shift Type',
                name: 'shift_type',
                type: 'select',
                required: true,
                width: '50%',
                options: [
                  { label: 'Opening', value: 'opening' },
                  { label: 'Mid-Shift', value: 'mid_shift' },
                  { label: 'Closing', value: 'closing' },
                ],
              },
              {
                id: 'fld_ko_service_area',
                label: 'Primary Service Area',
                name: 'service_area',
                type: 'select',
                required: true,
                width: '50%',
                options: [
                  { label: 'Kitchen', value: 'kitchen' },
                  { label: 'Dining Room', value: 'dining' },
                  { label: 'Bar', value: 'bar' },
                  { label: 'Storage / Prep', value: 'storage' },
                ],
              },
            ],
          },
          {
            id: 'row_ko_shift_notes',
            fields: [
              {
                id: 'fld_ko_shift_notes',
                label: 'Shift Notes',
                name: 'shift_notes',
                type: 'textarea',
                width: '100%',
              },
            ],
          },
        ],
      },
      {
        id: 'sec_ko_food_safety',
        type: SectionType.CHECKLIST,
        name: 'Food Safety Checklist',
        sortOrder: 2,
        rows: [
          ...checklistQuestionRow(
            'row_ko_handwash',
            'fld_ko_handwash',
            'Hand-washing stations stocked with soap, sanitizer, and paper towels?',
            { label: 'Corrective Action Taken', name: 'handwash_corrective' },
          ),
          ...checklistQuestionRow(
            'row_ko_storage',
            'fld_ko_storage',
            'All refrigerated items stored at or below 41°F (5°C)?',
            { label: 'Record Observed Temperature & Action', name: 'storage_corrective' },
          ),
          ...checklistQuestionRow(
            'row_ko_cross_contamination',
            'fld_ko_cross_contamination',
            'Raw and ready-to-eat foods properly separated with color-coded tools?',
            { label: 'Describe Separation Issue & Fix', name: 'cross_contamination_corrective' },
          ),
          ...checklistQuestionRow(
            'row_ko_date_labels',
            'fld_ko_date_labels',
            'All prepared items properly date-labeled and within shelf life?',
            { label: 'Items Relabeled / Discarded', name: 'date_labels_corrective' },
          ),
          ...checklistQuestionRow(
            'row_ko_allergen',
            'fld_ko_allergen',
            'Allergen prep areas clean and designated utensils available?',
            { label: 'Allergen Area Corrective Steps', name: 'allergen_corrective' },
          ),
        ],
      },
      {
        id: 'sec_ko_equipment_temps',
        type: SectionType.DATA_ENTRY,
        name: 'Equipment Temperature Log',
        sortOrder: 3,
        conditions: showWhen('fld_ko_service_area', 'kitchen'),
        rows: [
          {
            id: 'row_ko_walk_in',
            fields: [
              {
                id: 'fld_ko_walk_in_temp',
                label: 'Walk-In Cooler Temp (°F)',
                name: 'walk_in_temp',
                type: 'number',
                required: true,
                width: '25%',
              },
              {
                id: 'fld_ko_freezer_temp',
                label: 'Freezer Temp (°F)',
                name: 'freezer_temp',
                type: 'number',
                required: true,
                width: '25%',
              },
              {
                id: 'fld_ko_hot_hold',
                label: 'Hot Holding Temp (°F)',
                name: 'hot_hold_temp',
                type: 'number',
                width: '25%',
              },
              {
                id: 'fld_ko_temp_action',
                label: 'Action Required',
                name: 'temp_action',
                type: 'select',
                required: true,
                width: '25%',
                options: [
                  { label: 'None — Within Range', value: 'none' },
                  { label: 'Adjust Thermostat', value: 'adjust' },
                  { label: 'Discard Product', value: 'discard' },
                  { label: 'Notify Manager', value: 'notify_manager' },
                ],
              },
            ],
          },
          {
            id: 'row_ko_temp_notes',
            fields: [
              {
                id: 'fld_ko_temp_notes',
                label: 'Temperature Log Notes',
                name: 'temp_notes',
                type: 'textarea',
                width: '100%',
                conditions: showWhen('fld_ko_temp_action', 'none', ConditionalOperator.NOT_EQUALS),
              },
            ],
          },
        ],
      },
      {
        id: 'sec_ko_closing_tasks',
        type: SectionType.CHECKLIST,
        name: 'Closing Tasks',
        sortOrder: 4,
        conditions: showWhen('fld_ko_shift_type', 'closing'),
        rows: [
          ...checklistQuestionRow(
            'row_ko_fryer',
            'fld_ko_fryer',
            'Fryer oil filtered / changed and equipment shut down safely?',
            { label: 'Fryer Closing Notes', name: 'fryer_closing_notes' },
          ),
          ...checklistQuestionRow(
            'row_ko_surfaces',
            'fld_ko_surfaces',
            'All prep surfaces sanitized and equipment covered?',
            { label: 'Surface Cleaning Details', name: 'surface_closing_notes' },
          ),
        ],
      },
      {
        id: 'sec_ko_documentation',
        type: SectionType.VISUAL,
        name: 'Issue Documentation',
        sortOrder: 5,
        conditions: showWhenAny([
          { fieldId: 'fld_ko_handwash_response', operator: ConditionalOperator.EQUALS, value: 'no' },
          { fieldId: 'fld_ko_storage_response', operator: ConditionalOperator.EQUALS, value: 'no' },
          { fieldId: 'fld_ko_cross_contamination_response', operator: ConditionalOperator.EQUALS, value: 'no' },
          { fieldId: 'fld_ko_date_labels_response', operator: ConditionalOperator.EQUALS, value: 'no' },
          { fieldId: 'fld_ko_allergen_response', operator: ConditionalOperator.EQUALS, value: 'no' },
          { fieldId: 'fld_ko_temp_action', operator: ConditionalOperator.NOT_EQUALS, value: 'none' },
        ]),
        rows: [
          {
            id: 'row_ko_photos',
            fields: [
              {
                id: 'fld_ko_issue_photos',
                label: 'Upload Issue Photos',
                name: 'issue_photos',
                type: 'image',
                width: '40%',
              },
              {
                id: 'fld_ko_issue_description',
                label: 'Issue Description',
                name: 'issue_description',
                type: 'textarea',
                required: true,
                width: '60%',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Walk-In Cooler & Produce Inventory',
    formName: 'Walk-In Cooler & Produce Inventory',
    assignJobPositions: ['Inventory Clerk', 'Kitchen Porter', 'Line Cook'],
    reportJobPositions: ['Restaurant Manager', 'Head Chef'],
    sections: [
      {
        id: 'sec_wic_location',
        type: SectionType.RESPONSE_FORM,
        name: 'Count Details',
        sortOrder: 1,
        rows: [
          {
            id: 'row_wic_meta',
            fields: [
              {
                id: 'fld_wic_storage_unit',
                label: 'Storage Unit',
                name: 'storage_unit',
                type: 'select',
                required: true,
                width: '50%',
                options: [
                  { label: 'Walk-In Cooler', value: 'walk_in' },
                  { label: 'Walk-In Freezer', value: 'freezer' },
                  { label: 'Dry Storage', value: 'dry' },
                  { label: 'Bar Cooler', value: 'bar_cooler' },
                ],
              },
              {
                id: 'fld_wic_count_type',
                label: 'Count Type',
                name: 'count_type',
                type: 'select',
                required: true,
                width: '50%',
                options: [
                  { label: 'Full Count', value: 'full' },
                  { label: 'Spot Check', value: 'spot' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'sec_wic_inventory',
        type: SectionType.DATA_ENTRY,
        name: 'Inventory Count',
        sortOrder: 2,
        rows: [
          {
            id: 'row_wic_item_line',
            fields: [
              {
                id: 'fld_wic_item',
                label: 'Item',
                name: 'item_id',
                type: 'select',
                required: true,
                width: '30%',
                optionSource: ITEM_OPTION_SOURCE,
              },
              {
                id: 'fld_wic_include_par',
                label: 'Include Par',
                name: 'include_par',
                type: 'checkbox',
                width: '10%',
              },
              {
                id: 'fld_wic_par',
                label: 'Par Level',
                name: 'par',
                type: 'number',
                width: '15%',
                conditions: showWhen('fld_wic_include_par', true),
              },
              {
                id: 'fld_wic_current_qty',
                label: 'Current Quantity',
                name: 'current_quantity',
                type: 'number',
                required: true,
                width: '15%',
              },
              {
                id: 'fld_wic_action',
                label: 'Action',
                name: 'inventory_action',
                type: 'select',
                required: true,
                width: '15%',
                options: [
                  { label: 'None', value: 'none' },
                  { label: 'Order', value: 'order' },
                  { label: 'Transfer', value: 'transfer' },
                  { label: 'Discard', value: 'discard' },
                ],
              },
              {
                id: 'fld_wic_spoilage',
                label: 'Spoilage Observed?',
                name: 'spoilage_observed',
                type: 'yesNo',
                width: '15%',
                options: YES_NO_OPTIONS,
              },
            ],
          },
          {
            id: 'row_wic_reorder',
            fields: [
              {
                id: 'fld_wic_reorder_qty',
                label: 'Reorder Quantity',
                name: 'reorder_quantity',
                type: 'number',
                required: true,
                width: '50%',
                conditions: showWhen('fld_wic_action', 'order'),
              },
              {
                id: 'fld_wic_vendor_notes',
                label: 'Vendor / Order Notes',
                name: 'vendor_notes',
                type: 'textarea',
                width: '50%',
                conditions: showWhen('fld_wic_action', 'order'),
              },
            ],
          },
          {
            id: 'row_wic_spoilage_followup',
            fields: [
              {
                id: 'fld_wic_spoilage_details',
                label: 'Spoilage Details & Disposal Method',
                name: 'spoilage_details',
                type: 'textarea',
                required: true,
                width: '100%',
                conditions: showWhen('fld_wic_spoilage', 'yes'),
              },
            ],
          },
        ],
      },
      {
        id: 'sec_wic_bar_items',
        type: SectionType.DATA_ENTRY,
        name: 'Bar Cooler Add-On Count',
        sortOrder: 3,
        conditions: showWhen('fld_wic_storage_unit', 'bar_cooler'),
        rows: [
          {
            id: 'row_wic_garnish',
            fields: [
              {
                id: 'fld_wic_garnish_item',
                label: 'Garnish / Mixer Item',
                name: 'garnish_item',
                type: 'text',
                required: true,
                width: '40%',
              },
              {
                id: 'fld_wic_garnish_qty',
                label: 'Quantity On Hand',
                name: 'garnish_quantity',
                type: 'number',
                required: true,
                width: '30%',
              },
              {
                id: 'fld_wic_garnish_restock',
                label: 'Needs Restock?',
                name: 'garnish_restock',
                type: 'yesNo',
                required: true,
                width: '30%',
                options: YES_NO_OPTIONS,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Front-of-House Service Quality Check',
    formName: 'Front-of-House Service Quality Check',
    assignJobPositions: ['Waiter / Waitress', 'Host / Hostess', 'Bartender', 'Restaurant Manager'],
    reportJobPositions: ['Restaurant Manager', 'Assistant Manager'],
    sections: [
      {
        id: 'sec_foh_shift',
        type: SectionType.RESPONSE_FORM,
        name: 'Service Period',
        sortOrder: 1,
        rows: [
          {
            id: 'row_foh_period',
            fields: [
              {
                id: 'fld_foh_meal_period',
                label: 'Meal Period',
                name: 'meal_period',
                type: 'select',
                required: true,
                width: '50%',
                options: [
                  { label: 'Breakfast', value: 'breakfast' },
                  { label: 'Lunch', value: 'lunch' },
                  { label: 'Dinner', value: 'dinner' },
                  { label: 'Late Night', value: 'late_night' },
                ],
              },
              {
                id: 'fld_foh_area',
                label: 'Area Inspected',
                name: 'area_inspected',
                type: 'select',
                required: true,
                width: '50%',
                options: [
                  { label: 'Dining Room', value: 'dining' },
                  { label: 'Bar', value: 'bar' },
                  { label: 'Patio / Outdoor', value: 'patio' },
                  { label: 'Restrooms', value: 'restrooms' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'sec_foh_dining',
        type: SectionType.CHECKLIST,
        name: 'Dining Room Standards',
        sortOrder: 2,
        conditions: showWhenAny([
          { fieldId: 'fld_foh_area', operator: ConditionalOperator.EQUALS, value: 'dining' },
          { fieldId: 'fld_foh_area', operator: ConditionalOperator.EQUALS, value: 'patio' },
        ]),
        rows: [
          ...checklistQuestionRow(
            'row_foh_table_setup',
            'fld_foh_table_setup',
            'Tables set with clean linens, cutlery, and condiments?',
            { label: 'Table Setup Correction', name: 'table_setup_corrective' },
          ),
          ...checklistQuestionRow(
            'row_foh_floor',
            'fld_foh_floor',
            'Floors clean and free of debris / slip hazards?',
            { label: 'Floor Cleaning Action', name: 'floor_corrective' },
          ),
        ],
      },
      {
        id: 'sec_foh_bar',
        type: SectionType.CHECKLIST,
        name: 'Bar Service Standards',
        sortOrder: 3,
        conditions: showWhen('fld_foh_area', 'bar'),
        rows: [
          ...checklistQuestionRow(
            'row_foh_glassware',
            'fld_foh_glassware',
            'Glassware polished and free of chips or cracks?',
            { label: 'Glassware Issue Details', name: 'glassware_corrective' },
          ),
          ...checklistQuestionRow(
            'row_foh_ice_well',
            'fld_foh_ice_well',
            'Ice wells clean and ice scoops stored properly (not in ice)?',
            { label: 'Ice Well Corrective Steps', name: 'ice_well_corrective' },
          ),
        ],
      },
      {
        id: 'sec_foh_restroom',
        type: SectionType.CHECKLIST,
        name: 'Restroom Inspection',
        sortOrder: 4,
        conditions: showWhen('fld_foh_area', 'restrooms'),
        rows: [
          ...checklistQuestionRow(
            'row_foh_restroom_stock',
            'fld_foh_restroom_stock',
            'Restrooms stocked with soap, paper towels, and toilet paper?',
            { label: 'Restocking Details', name: 'restroom_stock_corrective' },
          ),
          ...checklistQuestionRow(
            'row_foh_restroom_clean',
            'fld_foh_restroom_clean',
            'Fixtures, floors, and mirrors clean and sanitized?',
            { label: 'Cleaning Action Taken', name: 'restroom_clean_corrective' },
          ),
        ],
      },
      {
        id: 'sec_foh_dinner_extras',
        type: SectionType.RESPONSE_FORM,
        name: 'Dinner Service Extras',
        sortOrder: 5,
        conditions: showWhen('fld_foh_meal_period', 'dinner'),
        rows: [
          {
            id: 'row_foh_reservations',
            fields: [
              {
                id: 'fld_foh_reservation_count',
                label: 'Expected Reservation Count',
                name: 'reservation_count',
                type: 'number',
                required: true,
                width: '50%',
              },
              {
                id: 'fld_foh_special_requests',
                label: 'Special Guest Requests',
                name: 'special_requests',
                type: 'textarea',
                width: '50%',
                conditions: showWhen('fld_foh_reservation_count', 0, ConditionalOperator.GREATER_THAN),
              },
            ],
          },
        ],
      },
      {
        id: 'sec_foh_guest_feedback',
        type: SectionType.VISUAL,
        name: 'Guest Feedback & Evidence',
        sortOrder: 6,
        conditions: showWhenAny([
          { fieldId: 'fld_foh_table_setup_response', operator: ConditionalOperator.EQUALS, value: 'no' },
          { fieldId: 'fld_foh_floor_response', operator: ConditionalOperator.EQUALS, value: 'no' },
          { fieldId: 'fld_foh_glassware_response', operator: ConditionalOperator.EQUALS, value: 'no' },
          { fieldId: 'fld_foh_ice_well_response', operator: ConditionalOperator.EQUALS, value: 'no' },
          { fieldId: 'fld_foh_restroom_stock_response', operator: ConditionalOperator.EQUALS, value: 'no' },
          { fieldId: 'fld_foh_restroom_clean_response', operator: ConditionalOperator.EQUALS, value: 'no' },
        ]),
        rows: [
          {
            id: 'row_foh_evidence',
            fields: [
              {
                id: 'fld_foh_issue_photo',
                label: 'Upload Photo Evidence',
                name: 'issue_photo',
                type: 'image',
                width: '40%',
              },
              {
                id: 'fld_foh_manager_notified',
                label: 'Manager Notified?',
                name: 'manager_notified',
                type: 'yesNo',
                required: true,
                width: '30%',
                options: YES_NO_OPTIONS,
              },
              {
                id: 'fld_foh_follow_up',
                label: 'Follow-Up Required By',
                name: 'follow_up_by',
                type: 'text',
                width: '30%',
                conditions: showWhen('fld_foh_manager_notified', 'yes'),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Food Safety & HACCP Temperature Log',
    formName: 'Food Safety & HACCP Temperature Log',
    assignJobPositions: ['Line Cook', 'Sous Chef', 'Head Chef'],
    reportJobPositions: ['Head Chef', 'Restaurant Manager'],
    sections: [
      {
        id: 'sec_haccp_station',
        type: SectionType.RESPONSE_FORM,
        name: 'Cooking Station',
        sortOrder: 1,
        rows: [
          {
            id: 'row_haccp_station',
            fields: [
              {
                id: 'fld_haccp_station',
                label: 'Station',
                name: 'cooking_station',
                type: 'select',
                required: true,
                width: '50%',
                options: [
                  { label: 'Grill', value: 'grill' },
                  { label: 'Sauté', value: 'saute' },
                  { label: 'Fry', value: 'fry' },
                  { label: 'Prep / Cold', value: 'prep_cold' },
                ],
              },
              {
                id: 'fld_haccp_protein_type',
                label: 'Protein Type Being Cooked',
                name: 'protein_type',
                type: 'select',
                required: true,
                width: '50%',
                options: [
                  { label: 'Poultry', value: 'poultry' },
                  { label: 'Beef / Pork', value: 'red_meat' },
                  { label: 'Seafood', value: 'seafood' },
                  { label: 'Vegetarian / None', value: 'vegetarian' },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'sec_haccp_temps',
        type: SectionType.DATA_ENTRY,
        name: 'Cooking & Holding Temperatures',
        sortOrder: 2,
        rows: [
          {
            id: 'row_haccp_cook_temp',
            fields: [
              {
                id: 'fld_haccp_internal_temp',
                label: 'Final Internal Temp (°F)',
                name: 'internal_temp',
                type: 'number',
                required: true,
                width: '33%',
              },
              {
                id: 'fld_haccp_holding_temp',
                label: 'Hot Holding Temp (°F)',
                name: 'holding_temp',
                type: 'number',
                width: '33%',
              },
              {
                id: 'fld_haccp_time_limit',
                label: 'Time in Danger Zone (minutes)',
                name: 'danger_zone_minutes',
                type: 'number',
                width: '34%',
                conditions: showWhenAny([
                  { fieldId: 'fld_haccp_protein_type', operator: ConditionalOperator.EQUALS, value: 'poultry' },
                  { fieldId: 'fld_haccp_protein_type', operator: ConditionalOperator.EQUALS, value: 'seafood' },
                ]),
              },
            ],
          },
          {
            id: 'row_haccp_poultry_min',
            fields: [
              {
                id: 'fld_haccp_poultry_action',
                label: 'Poultry Below 165°F — Action Taken',
                name: 'poultry_corrective',
                type: 'select',
                required: true,
                width: '100%',
                options: [
                  { label: 'Continue Cooking', value: 'continue_cooking' },
                  { label: 'Discard Product', value: 'discard' },
                ],
                conditions: showWhen('fld_haccp_protein_type', 'poultry'),
              },
            ],
          },
        ],
      },
      {
        id: 'sec_haccp_cold_prep',
        type: SectionType.CHECKLIST,
        name: 'Cold Prep / Salad Station',
        sortOrder: 3,
        conditions: showWhen('fld_haccp_station', 'prep_cold'),
        rows: [
          ...checklistQuestionRow(
            'row_haccp_cold_hold',
            'fld_haccp_cold_hold',
            'Cold holding units maintaining at or below 41°F (5°C)?',
            { label: 'Cold Hold Corrective Action', name: 'cold_hold_corrective' },
          ),
          ...checklistQuestionRow(
            'row_haccp_prep_sanitize',
            'fld_haccp_prep_sanitize',
            'Cutting boards sanitized between protein types?',
            { label: 'Sanitization Steps Taken', name: 'prep_sanitize_corrective' },
          ),
        ],
      },
    ],
  },
];

/** Builds a publish-ready schema with resolved assign/report targets. */
export function buildRestaurantTemplateSchema(
  seed: RestaurantTemplateSeed,
  context: {
    assignJobPositionIds: number[];
    reportJobPositionIds: number[];
    assignUserIds: number[];
    reportUserIds: number[];
    startDate: string;
  },
): Record<string, unknown> {
  return {
    formName: seed.formName,
    assign: {
      assignmentType: 'individual',
      users: context.assignUserIds,
      jobPosition: context.assignJobPositionIds,
    },
    report: {
      users: context.reportUserIds,
      jobPosition: context.reportJobPositionIds,
    },
    frequency: {
      type: 'recurring',
      date: context.startDate,
      jobPosition: null,
      recurring: {
        every: 1,
        interval: 'day',
        repeatCount: 30,
        daysOfWeek: [],
        monthMode: 'dayOfMonth',
        dayOfMonth: 1,
        weekOrder: 'first',
        onTheMonth: 'january',
        yearDay: 1,
        yearMonth: 'january',
      },
    },
    sections: seed.sections.map((section) => ({
      id: section.id,
      type: section.type,
      name: section.name,
      sortOrder: section.sortOrder,
      ...(section.conditions ? { conditions: section.conditions } : {}),
      rows: section.rows.map((row) => ({
        id: row.id,
        fields: row.fields.map((field) => ({
          id: field.id,
          label: field.label,
          name: field.name,
          type: field.type,
          ...(field.required !== undefined ? { required: field.required } : {}),
          ...(field.width ? { width: field.width } : {}),
          ...(field.options ? { options: field.options } : {}),
          ...(field.optionSource ? { optionSource: field.optionSource } : {}),
          ...(field.conditions ? { conditions: field.conditions } : {}),
          ...((field.value !== undefined) ? { value: field.value } : {}),
        })),
      })),
    })),
  };
}

export const RESTAURANT_DC_TEMPLATE_SEED_NAMES = RESTAURANT_DC_TEMPLATE_SEEDS.map((seed) => seed.name);
