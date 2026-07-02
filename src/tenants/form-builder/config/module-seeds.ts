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

const userDefaultFields: readonly FormBuilderFieldSeed[] = [
  {
    key: 'name',
    label: 'Name',
    name: 'name',
    type: 'text',
    isRequired: true,
    isEditable: true,
    isSystemField: true,
    systemMappingKey: 'name',
  },
  {
    key: 'email',
    label: 'Email',
    name: 'email',
    type: 'email',
    isRequired: true,
    isEditable: true,
    isUnique: true,
    isSystemField: true,
    systemMappingKey: 'email',
  },
  {
    key: 'password',
    label: 'Password',
    name: 'password',
    type: 'password',
    isRequired: true,
    isEditable: true,
    isSystemField: true,
    systemMappingKey: 'password',
  },
];

const locationDefaultFields: readonly FormBuilderFieldSeed[] = [
  {
    key: 'name',
    label: 'Name',
    name: 'name',
    type: 'text',
    isEditable: true,
  },
  {
    key: 'address',
    label: 'Address',
    name: 'address',
    type: 'text',
    isEditable: true,
  },
  {
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
    key: 'postalCode',
    label: 'Postal Code',
    name: 'postalCode',
    type: 'text',
    isEditable: true,
  },
  {
    key: 'latitude',
    label: 'Latitude',
    name: 'latitude',
    type: 'text',
    isEditable: true,
  },
  {
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
