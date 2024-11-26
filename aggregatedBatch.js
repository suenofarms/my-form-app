const mongoose = require('mongoose');

// Updated Schema for Aggregated Batches
const aggregatedBatchSchema = new mongoose.Schema({
  batchNumber: { type: String, required: true }, // Unique identifier for the batch
  plantName: { type: String, required: true }, // Name of the plant
  totalTrayCount: { type: Number, required: true }, // Total number of trays in the batch
  currentRow: { type: String, required: true }, // Current row where the batch is located
  rootingProgress: {
    type: String,
    enum: ['Unrooted', 'Callus', 'Root Emergence', 'Rooted', 'Fully Rooted'],
    default: 'Unrooted', // Default state when batch is created
  },
  photos: [String], // Array of photo file URLs
  stickDate: { type: Date, required: true }, // Date when the trays were stuck
  finishDate: { type: Date, required: true }, // Estimated finish date
  stickWeekYear: { type: String, required: true }, // Stick week-year (e.g., "482024")
  finishWeekYear: { type: String, required: true }, // Finish week-year (e.g., "522024")
  logs: [
    {
      type: { type: String, required: true }, // e.g., 'update', 'movement', 'mortality'
      details: { type: String, required: true }, // Specifics of the log entry
      count: { type: Number, required: true }, // Number of trays affected
      timestamp: { type: Date, default: Date.now }, // Timestamp of the log entry
      employee: { type: String, default: 'Unknown' }, // Employee who performed the action
    },
  ],
  status: { type: String, default: 'active' }, // 'active', 'depleted'
});

const AggregatedBatch = mongoose
  .connection
  .useDb('myDatabase')
  .model('AggregatedBatch', aggregatedBatchSchema, 'aggregatedBatches');

// Function to update or create an aggregated batch
async function aggregatedBatch(
  batchNumber,
  trayCount,
  currentRow,
  logType,
  logDetails,
  rootingProgress,
  employee,
  plantName,
  stickDate,
  finishDate,
  stickWeekYear,
  finishWeekYear
) {
  try {
    const logEntry = {
      type: logType,
      details: logDetails,
      count: trayCount,
      timestamp: new Date(),
      employee: employee || 'Unknown', // Fallback if no employee is provided
    };

    const existingBatch = await AggregatedBatch.findOne({ batchNumber });

    if (existingBatch) {
      // Update existing batch
      existingBatch.totalTrayCount += trayCount; // Increment tray count
      existingBatch.currentRow = currentRow; // Update current row
      if (rootingProgress) {
        existingBatch.rootingProgress = rootingProgress; // Update rooting progress if provided
      }
      existingBatch.logs.push(logEntry); // Add log entry
      await existingBatch.save(); // Save changes
    } else {
      // Create a new batch if it doesn't exist
      const newBatch = new AggregatedBatch({
        batchNumber,
        plantName,
        totalTrayCount: trayCount,
        currentRow,
        rootingProgress: rootingProgress || 'Unrooted',
        stickDate,
        finishDate,
        stickWeekYear,
        finishWeekYear,
        photos: [],
        logs: [logEntry],
        status: 'active',
      });
      await newBatch.save();
    }
  } catch (err) {
    console.error('Error updating aggregated batch:', err);
    throw err; // Re-throw error for higher-level handling
  }
}

module.exports = { aggregatedBatch };
