const mongoose = require('mongoose');

// Updated Schema for Aggregated Batches
const aggregatedBatchSchema = new mongoose.Schema({
  batchNumber: { type: String, required: true },
  totalTrayCount: { type: Number, required: true },
  currentRow: { type: String, required: true },
  rootingProgress: {
    type: String,
    enum: ['Unrooted', 'Callus', 'Root Emergence', 'Rooted', 'Fully Rooted'],
    default: 'Unrooted', // Default state when batch is created
  },
  photos: [String], // Array of photo file URLs
  logs: [
    {
      type: { type: String, required: true }, // e.g., 'update', 'sale', 'movement'
      details: { type: String, required: true }, // Specifics of the log
      count: { type: Number, required: true }, // Number of trays affected
      timestamp: { type: Date, default: Date.now },
    },
  ],
  status: { type: String, default: 'active' }, // 'active', 'depleted'
});

const AggregatedBatch = mongoose
  .connection
  .useDb('myDatabase')
  .model('AggregatedBatch', aggregatedBatchSchema, 'aggregatedBatches');

// Function to update aggregated batch
async function updateAggregatedBatch(
  batchNumber,
  trayCount,
  currentRow,
  logType,
  logDetails = 'No details provided',
  rootingProgress = null // Optional rootingProgress update
) {
  try {
    const logEntry = {
      type: logType,
      details: logDetails,
      count: trayCount,
      timestamp: new Date(),
    };

    const existingBatch = await AggregatedBatch.findOne({ batchNumber });

    if (existingBatch) {
      // Update fields
      existingBatch.totalTrayCount += trayCount;
      existingBatch.currentRow = currentRow;
      if (rootingProgress) {
        existingBatch.rootingProgress = rootingProgress; // Update rooting progress if provided
      }
      existingBatch.logs.push(logEntry);
      await existingBatch.save();
    } else {
      // Create a new batch if it doesn't exist
      const newBatch = new AggregatedBatch({
        batchNumber,
        totalTrayCount: trayCount,
        currentRow,
        rootingProgress: rootingProgress || 'Unrooted', // Default to 'Unrooted'
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

module.exports = { updateAggregatedBatch };
