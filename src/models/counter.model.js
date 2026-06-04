// backend/src/models/counter.model.js
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id:  { type: String, required: true },   // counter name e.g. 'invoice'
  seq:  { type: Number, default: 0 },
});

module.exports =
  mongoose.models.Counter || mongoose.model('Counter', counterSchema);
