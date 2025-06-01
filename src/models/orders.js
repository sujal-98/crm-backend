const mongoose = require('mongoose');
const Customer = require('./Customer');

const orderSchema = new mongoose.Schema({
  customer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  items: [
    {
      product_id: String,
      name: String,
      price: Number,
    }
  ],
  total_amount: { type: Number, required: true },
  order_date: { type: Date, default: Date.now },
});

// Middleware to update customer on new order
orderSchema.post('save', async function (doc, next) {
  try {
    const customer = await Customer.findById(doc.customer_id);
    if (customer) {
      customer.total_spend += doc.total_amount;
      customer.total_orders += 1;
      customer.visits += 1;
      customer.last_order_date = doc.order_date;
      customer.updateAverages();
      await customer.save();
    }
  } catch (err) {
    console.error('Error updating customer stats:', err);
  }

  next();
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
