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
    placeholder: 'Enter name',
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
    placeholder: 'Enter email',
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
    placeholder: 'Enter password',
  },
  {
    id: generateFieldId(),
    key: 'phoneNumber',
    label: 'Phone Number',
    name: 'phoneNumber',
    type: 'text',
    isEditable: true,
    placeholder: 'Enter phone number',
  },
  {
    id: generateFieldId(),
    key: 'address',
    label: 'Address',
    name: 'address',
    type: 'text',
    isEditable: true,
    placeholder: 'Enter address',
  },
  {
    id: generateFieldId(),
    key: 'username',
    label: 'Username',
    name: 'username',
    type: 'text',
    isEditable: true,
    placeholder: 'Enter username',
  },
  {
    id: generateFieldId(),
    key: 'jobPosition',
    label: 'Job Position',
    name: 'jobPosition',
    type: 'dropdown',
    isEditable: true,
    placeholder: 'Select job position',
    optionSource: {
      type: 'dynamic',
      method: 'GET',
      endpoint: 'jobpositions',
      response: {
        dataPath: 'data',
        labelKey: 'name',
        valueKey: 'id',
      },
    },
  },
  {
    id: generateFieldId(),
    key: 'location',
    label: 'Location',
    name: 'location',
    type: 'dropdown',
    isEditable: true,
    placeholder: 'Select location',
    optionSource: {
      type: 'dynamic',
      method: 'GET',
      endpoint: 'locations',
      response: {
        dataPath: 'data',
        labelKey: 'name',
        valueKey: 'id',
      },
    },
  },
  {
    id: generateFieldId(),
    key: 'availabilityDays',
    label: 'Availability Days',
    name: 'availabilityDays',
    type: 'checkbox',
    isEditable: true,
    placeholder: 'Select availability days',
    options: [
      { label: 'Monday', value: 'monday' },
      { label: 'Tuesday', value: 'tuesday' },
      { label: 'Wednesday', value: 'wednesday' },
      { label: 'Thursday', value: 'thursday' },
      { label: 'Friday', value: 'friday' },
      { label: 'Saturday', value: 'saturday' },
      { label: 'Sunday', value: 'sunday' },
    ],
  },
];

const itemsDefaultFields: readonly FormBuilderFieldSeed[] = [
  {
    id: generateFieldId(),
    key: 'name',
    label: 'Item Name',
    name: 'name',
    type: 'text',
    isRequired: true,
    isEditable: false,
    isSystemField: true,
    systemMappingKey: 'name',
    placeholder: 'Enter item name',
  },
  {
    id: generateFieldId(),
    key: 'item_no',
    label: 'Item #',
    name: 'item_no',
    type: 'text',
    isEditable: true,
    placeholder: 'Enter item number',
  },
  {
    id: generateFieldId(),
    key: 'size',
    label: 'Size',
    name: 'size',
    type: 'text',
    isEditable: true,
    placeholder: 'Enter size',
  },
  {
    id: generateFieldId(),
    key: 'cost',
    label: 'Cost',
    name: 'cost',
    type: 'number',
    isEditable: true,
    placeholder: 'Enter cost',
  },
  {
    id: generateFieldId(),
    key: 'data_enter',
    label: 'Data Enter',
    name: 'data_enter',
    type: 'text',
    isEditable: true,
    placeholder: 'Enter data',
  },
  {
    id: generateFieldId(),
    key: 'par',
    label: 'Par',
    name: 'par',
    type: 'number',
    isEditable: true,
    placeholder: 'Enter par',
  },
  {
    id: generateFieldId(),
    key: 'vendor_id',
    label: 'Vendor',
    name: 'vendor_id',
    type: 'dropdown',
    isEditable: true,
    placeholder: 'Select vendor',
    optionSource: {
      type: 'dynamic',
      method: 'GET',
      endpoint: 'vendors',
      response: {
        dataPath: 'data',
        labelKey: 'name',
        valueKey: 'id',
      },
    },
  },
  {
    id: generateFieldId(),
    key: 'reporting_group',
    label: 'Reporting Group',
    name: 'reporting_group',
    type: 'dropdown',
    isEditable: true,
    placeholder: 'Select reporting group',
    optionSource: {
      type: 'dynamic',
      method: 'GET',
      endpoint: 'reporting-categories',
      response: {
        dataPath: 'data',
        labelKey: 'name',
        valueKey: 'id',
      },
    },
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
    placeholder: 'Enter name',
  },
  {
    id: generateFieldId(),
    key: 'address',
    label: 'Address',
    name: 'address',
    type: 'text',
    isEditable: true,
    placeholder: 'Enter address',
  },
  {
    id: generateFieldId(),
    key: 'country_id',
    label: 'Country',
    name: 'country_id',
    type: 'dropdown',
    isEditable: true,
    placeholder: 'Select country',
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
    placeholder: 'Select state',
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
    placeholder: 'Select city',
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
    placeholder: 'Enter postal code',
  },
  {
    id: generateFieldId(),
    key: 'latitude',
    label: 'Latitude',
    name: 'latitude',
    type: 'text',
    isEditable: true,
    placeholder: 'Enter latitude',
  },
  {
    id: generateFieldId(),
    key: 'longitude',
    label: 'Longitude',
    name: 'longitude',
    type: 'text',
    isEditable: true,
    placeholder: 'Enter longitude',
  },
];

export const FORM_BUILDER_MODULE_SEEDS: readonly FormBuilderModuleSeed[] = [
  { slug: 'users', name: 'Users', defaultFields: userDefaultFields },
  { slug: 'items', name: 'Items', defaultFields: itemsDefaultFields },
  { slug: 'vendors', name: 'Vendors' },
  { slug: 'jobpositions', name: 'Job Positions' },
  { slug: 'locations', name: 'Locations', defaultFields: locationDefaultFields },
];
