import { SectionType } from '../entities/enums';

type TemplateFieldSeed = {
  id: string;
  label: string;
  name: string;
  type: string;
  required?: boolean;
  width?: string;
  value?: unknown;
  options?: Array<{ label: string; value: string }>;
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

/** Daily Kitchen Checklist template (1 section). */
export const RESTAURANT_DC_TEMPLATE_SEEDS: readonly RestaurantTemplateSeed[] = [
  {
    name: 'Daily Kitchen Checklist',
    formName: 'Daily Kitchen Checklist',
    assignJobPositions: ['Line Cook', 'Head Chef'],
    reportJobPositions: ['Restaurant Manager', 'Head Chef'],
    sections: [
      {
        id: 'sec_kitchen_ops',
        type: SectionType.CHECKLIST,
        name: 'Daily Kitchen Operations Checklist',
        sortOrder: 1,
        rows: [
          {
            id: 'row_food_item',
            fields: [
              {
                id: 'fld_food_item',
                label: 'What food item was prepared today?',
                name: 'food_item_prepared',
                type: 'text',
                required: true,
                width: '100%',
              },
            ],
          },
          {
            id: 'row_shift',
            fields: [
              {
                id: 'fld_shift',
                label: 'What is your shift?',
                name: 'shift',
                type: 'radio',
                required: true,
                width: '100%',
                options: [
                  { label: 'Morning', value: 'morning' },
                  { label: 'Afternoon', value: 'afternoon' },
                  { label: 'Evening', value: 'evening' },
                  { label: 'Night', value: 'night' },
                ],
              },
            ],
          },
          {
            id: 'row_areas_cleaned',
            fields: [
              {
                id: 'fld_areas_cleaned',
                label: 'Which areas were cleaned today?',
                name: 'areas_cleaned',
                type: 'checkbox',
                required: true,
                width: '100%',
                options: [
                  { label: 'Cooking Area', value: 'cooking_area' },
                  { label: 'Preparation Area', value: 'preparation_area' },
                  { label: 'Storage Area', value: 'storage_area' },
                  { label: 'Washing Area', value: 'washing_area' },
                ],
              },
            ],
          },
          {
            id: 'row_damaged_photo',
            fields: [
              {
                id: 'fld_damaged_photo',
                label: 'Please upload a photo of any damaged or expired food item.',
                name: 'damaged_or_expired_photo',
                type: 'image',
                required: false,
                width: '100%',
              },
            ],
          },
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
          ...((field.value !== undefined) ? { value: field.value } : {}),
        })),
      })),
    })),
  };
}

export const RESTAURANT_DC_TEMPLATE_SEED_NAMES = RESTAURANT_DC_TEMPLATE_SEEDS.map((seed) => seed.name);
