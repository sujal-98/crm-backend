const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const Customer = require('./models/Customer'); // adjust path as needed
const Order = require('./models/orders');

mongoose.connect('mongodb+srv://sujalgupta1412:9wYNW7ItSdkPDxxo@cluster0.z16ngtn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('Connected to MongoDB');

  // Clear old data (optional)
  await Customer.deleteMany({});
  await Order.deleteMany({});

  for (let i = 0; i < 20; i++) {
    // Create customer
    const customer = new Customer({
      name: faker.person.fullName(),
      email: faker.internet.email(),
      phone: faker.phone.number(),
      total_spend: 0,
      total_orders: 0,
      visits: 0,
      last_order_date: null
    });

    await customer.save();

    // Create 0-5 random orders
    const numOrders = Math.floor(Math.random() * 6); // 0 to 5

    for (let j = 0; j < numOrders; j++) {
      const numItems = Math.floor(Math.random() * 4) + 1; // 1-4 items
      const items = Array.from({ length: numItems }).map(() => ({
        product_id: faker.string.uuid(),
        name: faker.commerce.productName(),
        price: parseFloat(faker.commerce.price({ min: 10, max: 200 }))
      }));

      const totalAmount = items.reduce((sum, item) => sum + item.price, 0);

      const order = new Order({
        customer_id: customer._id,
        items,
        total_amount: totalAmount,
        order_date: faker.date.past()
      });

      await order.save(); // Triggers post-save hook to update customer
    }

    console.log(`Inserted customer ${i + 1} with ${numOrders} orders.`);
  }

  console.log('Seeding complete.');
  process.exit();
}).catch(err => {
  console.error('MongoDB connection error:', err);
});
