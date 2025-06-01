const { validationResult } = require('express-validator');


const validateRequest = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    // Validate each field in the schema
    Object.entries(schema.body || {}).forEach(([field, rules]) => {
      const value = req.body[field];
      
      // Check required fields
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
      }
      
      // Skip other validations if value is not provided and not required
      if (value === undefined || value === null) return;
      
      // Type validation
      if (rules.type && typeof value !== rules.type) {
        errors.push(`${field} must be of type ${rules.type}`);
      }
      
      // Format validation for email
      if (rules.format === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`${field} must be a valid email address`);
        }
      }
      
      // Array validation
      if (rules.type === 'array' && !Array.isArray(value)) {
        errors.push(`${field} must be an array`);
      }
      
      // Object validation
      if (rules.type === 'object' && typeof value !== 'object') {
        errors.push(`${field} must be an object`);
      }
    });

    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors
      });
    }

    next();
  };
};

module.exports = {
  validateRequest
}; 