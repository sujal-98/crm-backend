const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String },
  location: { type: String },

  total_spend: { 
    type: Number, 
    default: 0,
    min: 0,
    set: v => Math.max(0, Number(v) || 0) // Ensure non-negative numbers
  },
  total_orders: { 
    type: Number, 
    default: 0,
    min: 0,
    set: v => Math.max(0, Math.floor(Number(v) || 0)) // Ensure non-negative integers
  },
  visits: { 
    type: Number, 
    default: 0,
    min: 0,
    set: v => Math.max(0, Math.floor(Number(v) || 0)) // Ensure non-negative integers
  },
  avg_order_value: { 
    type: Number, 
    default: 0,
    min: 0,
    set: v => Math.max(0, Number(v) || 0) // Ensure non-negative numbers
  },

  last_order_date: { type: Date },
  created_at: { type: Date, default: Date.now },

  tags: [{ type: String }]
});

// Enhanced average calculation method
customerSchema.methods.updateAverages = function() {
  const totalOrders = Math.max(0, this.total_orders || 0);
  const totalSpend = Math.max(0, this.total_spend || 0);
  
  this.avg_order_value = totalOrders > 0 ? totalSpend / totalOrders : 0;
  
  // Ensure the value is a valid number
  if (isNaN(this.avg_order_value)) {
    this.avg_order_value = 0;
  }
};

// Add pre-save middleware to ensure averages are always calculated correctly
customerSchema.pre('save', function(next) {
  this.updateAverages();
  next();
});

const Customer = mongoose.model('Customer', customerSchema);
module.exports = Customer;
