const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');
const { updateAggregatedBatch } = require('./aggregatedBatch'); // Ensure correct path

// Initialize Express App
const app = express();
const port = 3000;

// MongoDB Atlas Connection
const mongoDB = 'mongodb+srv://SuenoFarms:bestliners@cluster0.imrxbn0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// MQTT Client Setup
const mqttClient = mqtt.connect('mqtts://30db3a99bc17487cb46a9f773f171638.s2.eu.hivemq.cloud:8883', {
  clientId: 'Device0100',
  username: 'hivemq.webclient.1683677052040',
  password: 'n5i2hAaN<?6wsG;4%JHD',
  clean: true,
});

mqttClient.on('connect', () => console.log('Connected to MQTT broker'));
mqttClient.on('error', (err) => console.error('MQTT connection error:', err));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Schemas and Models
const formSchema = new mongoose.Schema({
  employee: String,
  row: String,
  plant: String,
  PP: Number,
  trayType: Number,
  trayCount: Number,
  stickWeekYear: String,
  finishWeekYear: String,
  batchNumber: String,
  finishDate: String,
  date: { type: Date, default: Date.now },
});
const FormData = mongoose.connection.useDb('myDatabase').model('FormData', formSchema, 'forms');

const plantListSchema = new mongoose.Schema({ "Plant Name": String });
const PlantList = mongoose.connection.useDb('Plant_List').model('PlantList', plantListSchema, 'Plant_List');

const employeeSchema = new mongoose.Schema({ initial: String });
const Employee = mongoose.connection.useDb('Employees').model('Employee', employeeSchema, 'Employees');

const rowSchema = new mongoose.Schema({ Row: String });
const Row = mongoose.connection.useDb('Benches').model('Row', rowSchema, 'Rows');

// Helper Function for ISO Week Calculation
function getISOWeek(date) {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));
  const firstThursday = new Date(tempDate.getFullYear(), 0, 4);
  return Math.ceil(((tempDate.getTime() - firstThursday.getTime()) / 86400000 + 1) / 7);
}

// Route to Serve Form
app.get('/', async (req, res) => {
  try {
    const plants = await PlantList.find({}, { "Plant Name": 1, _id: 0 });
    const employees = await Employee.find({}, { initial: 1, _id: 0 });
    const rows = await Row.find({}, { Row: 1, _id: 0 });

    res.render('index', { plants, employees, rows });
  } catch (err) {
    console.error('Error loading form:', err);
    res.status(500).send('Error loading form data');
  }
});

// Route for Form Submission
app.post('/submit', async (req, res) => {
  try {
    const { selectedEmployee, selectedRow, selectedPlant, PP, TrayType, TrayCount } = req.body;

    // Data Validation
    if (!selectedPlant || !TrayCount) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const currentDate = new Date();
    const stickWeekYear = `${getISOWeek(currentDate)}${currentDate.getFullYear()}`;
    const finishDate = new Date(currentDate);
    finishDate.setDate(currentDate.getDate() + 6 * 7); // Default to 6 weeks
    const finishWeekYear = `${getISOWeek(finishDate)}${finishDate.getFullYear()}`;
    const batchNumber = `${selectedPlant.replace(/\s+/g, '_')}_${TrayType}_${PP}_${finishWeekYear}_${selectedRow}`;

    // Save Form Data
    const newFormData = new FormData({
      employee: selectedEmployee,
      row: selectedRow,
      plant: selectedPlant,
      PP: parseInt(PP, 10),
      trayType: parseInt(TrayType, 10),
      trayCount: parseInt(TrayCount, 10),
      stickWeekYear,
      finishWeekYear,
      batchNumber,
      finishDate: finishDate.toISOString().split('T')[0],
    });

    await newFormData.save();

    // Update Aggregated Batch
    await updateAggregatedBatch(
      batchNumber,
      parseInt(TrayCount, 10),
      selectedRow,
      'update',
      'Batch Created',
      'Unrooted'
    );
    
    

    // Publish to MQTT
    const mqttMessage = JSON.stringify({
      employee: selectedEmployee,
      row: selectedRow,
      plant: selectedPlant,
      PP,
      trayType: TrayType,
      trayCount: TrayCount,
      stickWeekYear,
      finishWeekYear,
      batchNumber,
      finishDate: finishDate.toISOString(),
    });

    mqttClient.publish('suenofarms/production/updates', mqttMessage, { qos: 1 });

    // Send Success Response
    res.json({ success: true, batchNumber });
  } catch (err) {
    console.error('Error processing submission:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Start the Server
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
