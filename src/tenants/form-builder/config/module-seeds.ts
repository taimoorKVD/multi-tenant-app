type FieldOptionSourceSeed = {
  type: 'dynamic';
   method: string;
   endpoint: string;
  response: {
    dataPath: string;
    labelKey: string;
    valueKey: string;
  };
};

type FieldOptionSeed = {
  label: string;
  value: string;
  isDefault?: boolean;
};

export type FormBuilderFieldSeed = {
  id?: string;
  key: string;
  label: string;
  name: string;
  type: string;
  isEditable?: boolean;
  isShow?: boolean;
  isRequired?: boolean;
  isUnique?: boolean;
  isSystemField?: boolean;
  systemMappingKey?: string | null;
  placeholder?: string | null;
  helpText?: string | null;
  optionSource?: FieldOptionSourceSeed;
  options?: FieldOptionSeed[];
};

export type FormBuilderModuleSeed = {
  slug: string;
  name: string;
  defaultFields?: readonly FormBuilderFieldSeed[];
};

/**
 * Generates a field ID in the format: fld_<timestamp>_<randomstring>
 */
function generateFieldId(): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 9);
  return `fld_${timestamp}_${randomString}`;
}

const userDefaultFields: readonly FormBuilderFieldSeed[] = [
  {
    id: generateFieldId(),
    key: 'name',
    label: 'Name',
    name: 'name',
    type: 'text',
    isRequired: true,
    isEditable: false,
    isSystemField: true,
    systemMappingKey: 'name',
  },
  {
    id: generateFieldId(),
    key: 'email',
    label: 'Email',
    name: 'email',
    type: 'email',
    isRequired: true,
    isEditable: false,
    isUnique: true,
    isSystemField: true,
    systemMappingKey: 'email',
  },
  {
    id: generateFieldId(),
    key: 'password',
    label: 'Password',
    name: 'password',
    type: 'password',
    isRequired: true,
    isEditable: false,
    isSystemField: true,
    systemMappingKey: 'password',
  },
];

const locationDefaultFields: readonly FormBuilderFieldSeed[] = [
  {
    id: generateFieldId(),
    key: 'name',
    label: 'Name',
    name: 'name',
    type: 'text',
    isEditable: true,
  },
  {
    id: generateFieldId(),
    key: 'address',
    label: 'Address',
    name: 'address',
    type: 'text',
    isEditable: true,
  },
  {
    id: generateFieldId(),
    key: 'country_id',
    label: 'Country',
    name: 'country_id',
    type: 'dropdown',
    isEditable: true,
    optionSource: {
      type: 'dynamic',
      method: 'GET',
      endpoint: 'countries',
      response: {
        dataPath: 'data',
        labelKey: 'name',
        valueKey: 'id',
      },
    },
  },
  {
    id: generateFieldId(),
    key: 'state_id',
    label: 'State',
    name: 'state_id',
    type: 'dropdown',
    isEditable: true,
    optionSource: {
      type: 'dynamic',
      method: 'GET',
      endpoint: 'states',
      response: {
        dataPath: 'data',
        labelKey: 'name',
        valueKey: 'id',
      },
    },
  },
  {
    id: generateFieldId(),
    key: 'city_id',
    label: 'City',
    name: 'city_id',
    type: 'dropdown',
    isEditable: true,
    optionSource: {
      type: 'dynamic',
      method: 'GET',
      endpoint: 'cities',
      response: {
        dataPath: 'data',
        labelKey: 'name',
        valueKey: 'id',
      },
    },
  },
  {
    id: generateFieldId(),
    key: 'postalCode',
    label: 'Postal Code',
    name: 'postalCode',
    type: 'text',
    isEditable: true,
  },
  {
    id: generateFieldId(),
    key: 'latitude',
    label: 'Latitude',
    name: 'latitude',
    type: 'text',
    isEditable: true,
  },
  {
    id: generateFieldId(),
    key: 'longitude',
    label: 'Longitude',
    name: 'longitude',
    type: 'text',
    isEditable: true,
  },
];

export const FORM_BUILDER_MODULE_SEEDS: readonly FormBuilderModuleSeed[] = [
  { slug: 'users', name: 'Users', defaultFields: userDefaultFields },
  { slug: 'items', name: 'Items' },
  { slug: 'vendors', name: 'Vendors' },
  { slug: 'jobpositions', name: 'Job Positions' },
  { slug: 'locations', name: 'Locations', defaultFields: locationDefaultFields },
];
