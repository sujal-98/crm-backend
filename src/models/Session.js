const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  _id: String,
  expires: Date,
  session: {
    cookie: {
      originalMaxAge: Number,
      expires: Date,
      secure: Boolean,
      httpOnly: Boolean,
      path: String,
      sameSite: String
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
});

module.exports = mongoose.model('Session', sessionSchema); 