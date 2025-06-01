const validFields = [
  'name',
  'email',
  'phone',
  'age',
  'location',
  'days_since_last_order',
  'total_purchases'
];

const validOperators = [
  'equals',
  'contains',
  'greaterThan',
  'lessThan',
  'between',
  'in'
];

const validateSegmentationRules = (rules) => {
  const errors = [];

  if (!Array.isArray(rules)) {
    errors.push('rules must be an array');
    return errors;
  }

  rules.forEach((rule, index) => {
    if (!validFields.includes(rule.field)) {
      errors.push(`Invalid field '${rule.field}' at rule ${index}`);
    }

    if (!validOperators.includes(rule.operator)) {
      errors.push(`Invalid operator '${rule.operator}' at rule ${index}`);
    }

    // Validate values based on operator
    if (rule.operator === 'between') {
      const values = rule.values || (rule.value || '').split(',').map(v => v.trim());
      if (!Array.isArray(values) || values.length !== 2) {
        errors.push(`'between' operator requires exactly 2 values at rule ${index}`);
      }
      // Validate numeric values for between
      if (['age', 'total_purchases', 'days_since_last_order'].includes(rule.field)) {
        if (values.some(v => isNaN(Number(v)))) {
          errors.push(`Invalid numeric value for '${rule.field}' at rule ${index}`);
        }
      }
    }

    if (rule.operator === 'in') {
      const values = rule.values || (rule.value || '').split(',').map(v => v.trim());
      if (!Array.isArray(values) || values.length === 0) {
        errors.push(`'in' operator requires at least one value at rule ${index}`);
      }
    }

    // Validate numeric fields
    if (['age', 'total_purchases', 'days_since_last_order'].includes(rule.field)) {
      if (rule.operator !== 'between' && isNaN(Number(rule.value))) {
        errors.push(`Invalid numeric value for '${rule.field}' at rule ${index}`);
      }
      // Additional validation for days_since_last_order
      if (rule.field === 'days_since_last_order' && Number(rule.value) < 0) {
        errors.push(`Days since last order cannot be negative at rule ${index}`);
      }
    }
  });

  return errors;
};

module.exports = {
  validateSegmentationRules,
  validFields,
  validOperators
}; 