const mongoose = require('mongoose');
const Customer = require('../models/Customer');

class CustomerSegmentation {

  static buildQueryFromRules(rules, options = {}) {
    const query = {};
    const { operator = 'AND' } = options;

    if (!rules || !Array.isArray(rules) || rules.length === 0) {
      return query;
    }

    // Convert field names to database fields
    const fieldMap = {
      'spend': 'total_spend',
      'visits': 'visits',
      'total_orders': 'total_orders',
      'avg_order_value': 'avg_order_value',
      'last_active': 'last_active_days'
    };

    // Build conditions
    const conditions = rules.map(rule => {
      const field = fieldMap[rule.condition] || rule.condition;
      const value = Number(rule.value);

      switch (rule.comparator) {
        case 'gt':
          return { [field]: { $gt: value } };
        case 'lt':
          return { [field]: { $lt: value } };
        case 'gte':
          return { [field]: { $gte: value } };
        case 'lte':
          return { [field]: { $lte: value } };
        case 'eq':
          return { [field]: value };
        default:
          throw new Error(`Unsupported comparator: ${rule.comparator}`);
      }
    });

    // Combine conditions based on operator
    if (operator === 'AND') {
      if (conditions.length === 1) {
        Object.assign(query, conditions[0]);
      } else {
        query.$and = conditions;
      }
    } else if (operator === 'OR') {
      if (conditions.length === 1) {
        Object.assign(query, conditions[0]);
      } else {
        query.$or = conditions;
      }
    }

    return query;
  }

  
  static buildComplexQuery(complexConditions) {
    const buildCondition = (condition) => {
      if (condition.type === 'simple') {
        const { field, comparator, value } = condition;
        
        switch (comparator) {
          case 'gt':
            return { [field]: { $gt: Number(value) } };
          case 'lt':
            return { [field]: { $lt: Number(value) } };
          case 'gte':
            return { [field]: { $gte: Number(value) } };
          case 'lte':
            return { [field]: { $lte: Number(value) } };
          case 'eq':
            return { [field]: Number(value) };
        }
      } else if (condition.type === 'and') {
        return {
          $and: condition.conditions.map(buildCondition)
        };
      } else if (condition.type === 'or') {
        return {
          $or: condition.conditions.map(buildCondition)
        };
      }
    };

    return buildCondition(complexConditions);
  }

  static async calculateAudienceSize(complexConditions) {
    const resolveAudience = async (condition) => {
      try {
        console.log('Processing condition:', JSON.stringify(condition));
        
        if (!condition) {
          console.warn('Empty condition provided');
          return [];
        }

        if (condition.type === 'simple') {
          const query = this.buildSimpleQuery(condition);
          console.log('Simple query:', JSON.stringify(query));
          
          // First check if we have any matching customers
          const count = await Customer.countDocuments(query);
          console.log(`Number of customers matching query: ${count}`);
          
          const results = await Customer.find(query).distinct('_id');
          console.log(`Found ${results.length} distinct customers for condition`);
          
          // Log a sample customer to verify data
          if (results.length > 0) {
            const sampleCustomer = await Customer.findById(results[0]);
            console.log('Sample matching customer:', sampleCustomer);
          }
          
          return results;
        }

        if (condition.type === 'and') {
          console.log('Processing AND condition');
          const audiences = await Promise.all(
            condition.conditions.map(resolveAudience)
          );
          const result = this.findIntersection(audiences);
          console.log(`AND condition resulted in ${result.length} customers`);
          return result;
        }

        if (condition.type === 'or') {
          console.log('Processing OR condition');
          const audiences = await Promise.all(
            condition.conditions.map(resolveAudience)
          );
          const result = this.findUnion(audiences);
          console.log(`OR condition resulted in ${result.length} customers`);
          return result;
        }

        if (condition.type === 'complex') {
          console.log('Processing complex condition');
          const resolveComplexCondition = async (complexCond) => {
            if (!complexCond) return [];
            
            if (complexCond.type === 'simple') {
              return await resolveAudience(complexCond);
            }
            
            if (complexCond.type === 'and') {
              const andAudiences = await Promise.all(
                complexCond.conditions.map(resolveComplexCondition)
              );
              return this.findIntersection(andAudiences);
            }
            
            if (complexCond.type === 'or') {
              const orAudiences = await Promise.all(
                complexCond.conditions.map(resolveComplexCondition)
              );
              return this.findUnion(orAudiences);
            }
            
            console.warn(`Unsupported complex condition type: ${complexCond.type}`);
            return [];
          };

          return await resolveComplexCondition(condition);
        }

        console.warn(`Unsupported condition type: ${condition.type}`);
        return [];
      } catch (error) {
        console.error('Error resolving audience:', error);
        return [];
      }
    };

    try {
      if (!complexConditions) {
        console.warn('No conditions provided for audience calculation');
        return { 
          totalCount: 0, 
          audience: [], 
          details: { averageSpend: 0, averageOrders: 0 } 
        };
      }

      const audienceIds = await resolveAudience(complexConditions);
      const safeAudienceIds = Array.isArray(audienceIds) ? audienceIds : [];
      
      console.log(`Total audience IDs found: ${safeAudienceIds.length}`);

      const audience = safeAudienceIds.length > 0 
        ? await Customer.find({ _id: { $in: safeAudienceIds } })
          .select('name email total_spend total_orders')
          .lean()
        : [];

      const totalSpend = audience.reduce((sum, customer) => sum + (customer.total_spend || 0), 0);
      const totalOrders = audience.reduce((sum, customer) => sum + (customer.total_orders || 0), 0);

      return {
        totalCount: safeAudienceIds.length,
        audience,
        details: {
          averageSpend: audience.length ? totalSpend / audience.length : 0,
          averageOrders: audience.length ? totalOrders / audience.length : 0
        }
      };
    } catch (error) {
      console.error('Comprehensive audience calculation error:', error);
      return { 
        totalCount: 0, 
        audience: [], 
        details: { averageSpend: 0, averageOrders: 0 } 
      };
    }
  }

  static buildSimpleQuery(condition) {
    try {
      if (!condition || !condition.field || !condition.comparator) {
        console.error('Invalid condition structure:', condition);
        throw new Error('Invalid simple condition structure');
      }

      // Add field mapping
      const fieldMap = {
        'spend': 'total_spend',
        'orders': 'total_orders',
        'visits': 'visits',
        'average_order': 'avg_order_value',
        'last_active': 'last_order_date'
      };

      // Map the field or use original if not in mapping
      const mappedField = fieldMap[condition.field] || condition.field;
      const { comparator, value } = condition;
      
      console.log('Building query for field:', mappedField);
      console.log('Original field:', condition.field);
      console.log('Comparator:', comparator);
      console.log('Value:', value);

      // Validate input
      if (value === undefined || value === null) {
        throw new Error(`Missing value for field ${mappedField}`);
      }

      const numericValue = Number(value);
      if (isNaN(numericValue)) {
        throw new Error(`Invalid numeric value for ${mappedField}: ${value}`);
      }

      // Build the query
      let query;
      switch (comparator) {
        case 'gt':
          query = { [mappedField]: { $gt: numericValue } };
          break;
        case 'lt':
          query = { [mappedField]: { $lt: numericValue } };
          break;
        case 'gte':
          query = { [mappedField]: { $gte: numericValue } };
          break;
        case 'lte':
          query = { [mappedField]: { $lte: numericValue } };
          break;
        case 'eq':
          query = { [mappedField]: numericValue };
          break;
        default:
          throw new Error(`Unsupported comparator: ${comparator}`);
      }

      // Verify the query against actual data
      console.log('Generated query:', JSON.stringify(query));
      
      // Add a test query to check if we have any customers at all
      Customer.countDocuments({}).then(total => {
        console.log('Total customers in database:', total);
      });

      // Test the specific query
      Customer.countDocuments(query).then(count => {
        console.log('Customers matching query:', count);
      });

      return query;
    } catch (error) {
      console.error('Error in buildSimpleQuery:', error);
      throw error;
    }
  }


  static findIntersection(audiences) {
    if (!audiences || audiences.length === 0) return [];
    if (audiences.length === 1) return audiences[0];

    // Filter out empty arrays and convert ObjectIds to strings for comparison
    const nonEmptyAudiences = audiences
      .filter(arr => arr && arr.length > 0)
      .map(arr => arr.map(id => id.toString()));
    
    // If all arrays were empty or no valid arrays
    if (nonEmptyAudiences.length === 0) return [];
    if (nonEmptyAudiences.length === 1) return audiences[0]; // Return original array to preserve ObjectIds

    // Convert first array to Set for O(1) lookups
    const firstSet = new Set(nonEmptyAudiences[0]);
    
    // Intersect with each subsequent array
    for (let i = 1; i < nonEmptyAudiences.length; i++) {
      const currentArray = nonEmptyAudiences[i];
      firstSet.forEach(id => {
        if (!currentArray.includes(id)) {
          firstSet.delete(id);
        }
      });
    }

    // Find original ObjectIds for the intersected values
    const intersectedIds = Array.from(firstSet);
    return audiences[0].filter(id => intersectedIds.includes(id.toString()));
  }


  static findUnion(audiences) {
    const uniqueAudiences = new Set();
    audiences.forEach(audienceSet => {
      audienceSet.forEach(id => uniqueAudiences.add(id));
    });
    return Array.from(uniqueAudiences);
  }

 
  static validateAndTransformRules(rules) {
    // Helper function to recursively validate and transform conditions
    const transformCondition = (condition) => {
      // Validate input
      if (!condition) {
        throw new Error('Invalid or empty condition');
      }

      // Simple condition
      if (condition.type === 'simple') {
        // Validate simple condition fields
        if (!condition.field) {
          throw new Error('Simple condition must have a field');
        }
        
        const validFields = [
          'total_spend', 'visits', 'total_orders', 
          'avg_order_value', 'last_order_date'
        ];
        if (!validFields.includes(condition.field)) {
          throw new Error(`Invalid field: ${condition.field}`);
        }
        
        const validComparators = ['gt', 'lt', 'gte', 'lte', 'eq'];
        if (!condition.comparator || !validComparators.includes(condition.comparator)) {
          throw new Error(`Invalid comparator: ${condition.comparator}`);
        }
        
        if (condition.value === undefined || condition.value === null) {
          throw new Error('Simple condition must have a value');
        }
        
        const numericValue = Number(condition.value);
        if (isNaN(numericValue)) {
          throw new Error(`Invalid numeric value: ${condition.value}`);
        }

        return {
          type: 'simple',
          field: condition.field,
          comparator: condition.comparator,
          value: numericValue
        };
      }

      // AND/OR conditions with nested conditions
      if (condition.type === 'and' || condition.type === 'or') {
        if (!condition.conditions || !Array.isArray(condition.conditions)) {
          throw new Error(`${condition.type.toUpperCase()} condition must have conditions`);
        }

        // Transform nested conditions
        const transformedConditions = condition.conditions.map(transformCondition);

        // Ensure at least two conditions for AND/OR
        if (transformedConditions.length < 2) {
          throw new Error(`${condition.type.toUpperCase()} must have at least two conditions`);
        }

        return {
          type: condition.type,
          conditions: transformedConditions
        };
      }

      // Complex nested condition
      if (condition.type === 'complex') {
        if (!condition.conditions || !Array.isArray(condition.conditions)) {
          throw new Error('Complex condition must have conditions');
        }

        // Transform nested conditions
        const transformedConditions = condition.conditions.map(transformCondition);

        return {
          type: 'complex',
          conditions: transformedConditions
        };
      }

      // Unknown condition type
      throw new Error(`Unsupported condition type: ${condition.type}`);
    };

    // Transform the entire condition structure
    return transformCondition(rules);
  }

  static async getCustomerCount(rules) {
    try {
      // Validate and transform rules into a consistent condition structure
      const validatedRules = this.validateAndTransformRules(rules);
      
      // Calculate audience size with the validated rules
      const audienceResult = await this.calculateAudienceSize(validatedRules);
      
      return audienceResult;
    } catch (error) {
      console.error('Error in customer segmentation count:', error);
      throw new Error(`Failed to calculate segment size: ${error.message}`);
    }
  }


  static async getCustomerList(rules, options = {}) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        projection = {} 
      } = options;

      const query = this.buildQueryFromRules(rules, options);

      return await Customer.find(query, projection)
        .skip((page - 1) * limit)
        .limit(limit);
    } catch (error) {
      console.error('Error in customer segmentation list:', error);
      throw new Error('Failed to retrieve segment customers');
    }
  }

 
  static validateRules(rules) {
    const errors = [];

    // Recursive validation function
    const validateCondition = (condition, path = 'rules') => {
      try {
        // Validate condition exists
        if (!condition) {
          errors.push(`${path}: Condition is undefined`);
          return;
        }

        // Validate simple condition
        if (condition.type === 'simple') {
          if (!condition.field) {
            errors.push(`${path}: Simple condition must have a field`);
          }
          
          const validFields = [
            'total_spend', 'visits', 'total_orders', 
            'avg_order_value', 'last_order_date'
          ];
          if (condition.field && !validFields.includes(condition.field)) {
            errors.push(`${path}: Invalid field '${condition.field}'`);
          }
          
          const validComparators = ['gt', 'lt', 'gte', 'lte', 'eq'];
          if (!condition.comparator || !validComparators.includes(condition.comparator)) {
            errors.push(`${path}: Invalid comparator '${condition.comparator}'`);
          }
          
          if (condition.value === undefined || condition.value === null) {
            errors.push(`${path}: Simple condition must have a value`);
          }
          
          // Ensure value is a number
          const numericValue = Number(condition.value);
          if (isNaN(numericValue)) {
            errors.push(`${path}: Invalid numeric value: ${condition.value}`);
          }
        } 
        // Validate AND/OR conditions
        else if (condition.type === 'and' || condition.type === 'or') {
          if (!condition.conditions || !Array.isArray(condition.conditions)) {
            errors.push(`${path}: ${condition.type.toUpperCase()} condition must have conditions`);
          } else {
            // Recursively validate nested conditions
            condition.conditions.forEach((nestedCondition, index) => {
              validateCondition(
                nestedCondition, 
                `${path}.conditions[${index}]`
              );
            });
          }

          // Ensure at least two conditions for AND/OR
          if (condition.conditions && condition.conditions.length < 2) {
            errors.push(`${path}: ${condition.type.toUpperCase()} must have at least two conditions`);
          }
        } 
        // Validate complex nested conditions
        else if (condition.type === 'complex') {
          if (!condition.conditions || !Array.isArray(condition.conditions)) {
            errors.push(`${path}: Complex condition must have conditions`);
          } else {
            condition.conditions.forEach((nestedCondition, index) => {
              validateCondition(
                nestedCondition, 
                `${path}.conditions[${index}]`
              );
            });
          }
        }
        // Unknown condition type
        else {
          errors.push(`${path}: Unknown condition type: ${condition.type}`);
        }
      } catch (error) {
        errors.push(`${path}: Validation error - ${error.message}`);
      }
    };

    try {
      // Validate the entire rule structure
      validateCondition(rules);
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = CustomerSegmentation;