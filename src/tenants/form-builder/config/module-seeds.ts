type FieldOptionSourceSeed = {
  type: 'api';
  request: {
    method: string;
    endpoint: string;
  };
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
    isEditable: true,
    isSystemField: true,
    systemMappingKey: 'name',
  },
  {
    key: 'email',
    label: 'Email',
    name: 'email',
    type: 'email',
    isEditable: true,
    isUnique: true,
    isSystemField: true,
    systemMappingKey: 'email',
  },
  {
    key: 'phone_number',
    label: 'Phone Number',
    name: 'phone_number',
    type: 'phone',
    isEditable: true,
    isSystemField: true,
    systemMappingKey: 'phone_number',
  },
  {
    key: 'address',
    label: 'Address',
    name: 'address',
    type: 'address_fields',
    isEditable: true,
    isSystemField: true,
    systemMappingKey: 'address',
  },
  {
    key: 'username',
    label: 'Username',
    name: 'username',
    type: 'text',
    isEditable: true,
    isUnique: true,
    isSystemField: true,
    systemMappingKey: 'username',
  },
  {
    key: 'password',
    label: 'Password',
    name: 'password',
    type: 'password',
    isEditable: true,
    isSystemField: true,
    systemMappingKey: 'password',
  },
  {
    key: 'role_id',
    label: 'Role',
    name: 'role_id',
    type: 'dropdown',
    isEditable: true,
    isShow: false,
    isSystemField: true,
    systemMappingKey: 'role_id',
    optionSource: {
      type: 'api',
      request: {
        method: 'GET',
        endpoint: '/api/roles',
      },
      response: {
        dataPath: 'data',
        labelKey: 'name',
        valueKey: 'id',
      },
    },
  },
  {
    key: 'job_position_id',
    label: 'Job Position',
    name: 'job_position_id',
    type: 'dropdown',
    isEditable: true,
    isSystemField: true,
    systemMappingKey: 'job_position_id',
    optionSource: {
      type: 'api',
      request: {
        method: 'GET',
        endpoint: '/api/job-positions',
      },
      response: {
        dataPath: 'data',
        labelKey: 'name',
        valueKey: 'id',
      },
    },
  },
  {
    key: 'location_id',
    label: 'Location',
    name: 'location_id',
    type: 'dropdown',
    isEditable: true,
    isSystemField: true,
    systemMappingKey: 'location_id',
    optionSource: {
      type: 'api',
      request: {
        method: 'GET',
        endpoint: '/api/locations',
      },
      response: {
        dataPath: 'data',
        labelKey: 'name',
        valueKey: 'id',
      },
    },
  },
  {
    key: 'availability_days',
    label: 'Availability Days',
    name: 'availability_days',
    type: 'checkbox',
    isEditable: true,
    isSystemField: true,
    systemMappingKey: 'availability_days',
    options: [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ].map((day) => ({
      label: day,
      value: day.toLowerCase(),
      isDefault: false,
    })),
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
      type: 'api',
      request: {
        method: 'GET',
        endpoint: '/api/countries',
      },
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
      type: 'api',
      request: {
        method: 'GET',
        endpoint: '/api/states',
      },
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
      type: 'api',
      request: {
        method: 'GET',
        endpoint: '/api/cities',
      },
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
  { slug: 'job-positions', name: 'Job Positions' },
  { slug: 'locations', name: 'Locations', defaultFields: locationDefaultFields },
];
