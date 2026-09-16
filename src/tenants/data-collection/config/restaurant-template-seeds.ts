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

/** Simple sample data-collection template (1 Data Entry section). */
export const RESTAURANT_DC_TEMPLATE_SEEDS: readonly RestaurantTemplateSeed[] = [
  {
    name: 'Sample Checklist',
    formName: 'Sample Checklist',
    assignJobPositions: ['Line Cook', 'Head Chef'],
    reportJobPositions: ['Restaurant Manager', 'Head Chef'],
    sections: [
      {
        id: 'sec_data_entry',
        type: SectionType.DATA_ENTRY,
        name: 'Data Entry',
        sortOrder: 1,
        rows: [
          {
            id: 'row_data_entry',
            fields: [
              {
                id: 'fld_title',
                label: 'Title',
                name: 'title',
                type: 'text',
                required: true,
                width: '25%',
              },
              {
                id: 'fld_category',
                label: 'Category',
                name: 'category',
                type: 'select',
                required: true,
                width: '25%',
                options: [
                  { label: 'Kitchen', value: 'kitchen' },
                  { label: 'Dining', value: 'dining' },
                  { label: 'Bar', value: 'bar' },
                ],
              },
              {
                id: 'fld_description',
                label: 'Description',
                name: 'description',
                type: 'textarea',
                required: false,
                width: '50%',
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
