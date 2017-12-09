/* =============================================
   =                 MongoDB Setup                =
   ============================================= */
// Require Mongoose
var mongoose = require ('mongoose');

// Create Mongoose Schemas
var Schema = mongoose.Schema;

// User Schema:
var UserSchema = new Schema({
  fbId: {type: String, required: true},
  firstName: String,
  lastName: String,
  items: [{
    text: { type: String, trim: true },
      priority: { type: Number, min: 0 } 
    }]}, 
  {timestamps: true});

// User model:
module.exports = mongoose.model ('User', UserSchema) // We are setting this Schema in our Models as 'User'