const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const mqtt = require('mqtt');  // Import MQTT

// Set up express app
const app = express();
const port = 3000;

// MongoDB Atlas connection string (connecting to the entire cluster)
const mongoDB = 'mongodb+srv://SuenoFarms:bestliners@cluster0.imrxbn0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

// Connect to MongoDB (without specifying a particular database)
mongoose.connect(mongoDB, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected successfully to the cluster'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);  // Stop the server if connection fails
  });

// MQTT Client Setup - matching Arduino settings
const mqttOptions = {
  clientId: 'Device0100',  // New unique client ID (different from Arduino)
  username: 'hivemq.webclient.1683677052040',  // Match Arduino credentials
  password: 'n5i2hAaN<?6wsG;4%JHD',  // Match Arduino credentials
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
};
const mqttClient = mqtt.connect('mqtts://30db3a99bc17487cb46a9f773f171638.s2.eu.hivemq.cloud:8883', mqttOptions);

// MQTT Connection Handling
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker successfully');
});

mqttClient.on('error', (err) => {
  console.error('Error connecting to MQTT broker:', err);
});

mqttClient.on('offline', () => {
  console.error('MQTT client is offline.');
});

mqttClient.on('reconnect', () => {
  console.log('MQTT client is attempting to reconnect...');
});

mqttClient.on('close', () => {
  console.log('MQTT connection closed.');
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');  // Set EJS as the templating engine

// Schemas and Models for collections from different databases:

// Schema for Plant List (from Plant_List database)
const plantListSchema = new mongoose.Schema({
  "Plant Name": String
});
const PlantList = mongoose.connection.useDb('Plant_List').model('PlantList', plantListSchema, 'Plant_List');

// Schema for Employees (from Employees database)
const employeeSchema = new mongoose.Schema({
  "initial": String
});
const Employee = mongoose.connection.useDb('Employees').model('Employee', employeeSchema, 'Employees');

// Schema for Rows (from Benches database)
const rowSchema = new mongoose.Schema({
  "Row": String
});
const Row = mongoose.connection.useDb('Benches').model('Row', rowSchema, 'Rows');

// Schema for Form Data (saving form submissions in myDatabase)
const formSchema = new mongoose.Schema({
  employee: String,
  row: String,
  plant: String,
  PP: Number,
  trayType: Number,
  trayCount: Number,
  date: { type: Date, default: Date.now }
});
const FormData = mongoose.connection.useDb('myDatabase').model('FormData', formSchema, 'forms');

// Serve the HTML form with dynamic dropdowns for Plant List, Employees, and Rows
app.get('/', async (req, res) => {
  try {
    // Fetch the data for dropdowns
    const plants = await PlantList.find({}, { "Plant Name": 1, _id: 0 });
    const employees = await Employee.find({}, { "initial": 1, _id: 0 });
    const rows = await Row.find({}, { "Row": 1, _id: 0 });

    // Log the fetched data
    console.log("Plants fetched:", plants);
    console.log("Employees fetched:", employees);
    console.log("Rows fetched:", rows);

    // Pass plant, employee, and row data to the EJS template
    res.render('index', { plants, employees, rows });
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('Error fetching data');
  }
});

// Route to handle form submission and save data to MongoDB
app.post('/submit', async (req, res) => {
  const { selectedEmployee, selectedRow, selectedPlant, PP, TrayType, TrayCount } = req.body;

  console.log('Received form data:', req.body);  // Log form data for debugging

  // Create a new FormData document with the submitted data
  const newFormData = new FormData({
    employee: selectedEmployee,
    row: selectedRow,
    plant: selectedPlant,
    PP: parseInt(PP, 10),
    trayType: parseInt(TrayType, 10),
    trayCount: parseInt(TrayCount, 10)
  });

  try {
    // Save the form data into the forms collection in the myDatabase database
    await newFormData.save();
    console.log('Form data saved successfully to MongoDB');

    // Publish an MQTT message after successful form submission
    const message = JSON.stringify({
      employee: selectedEmployee,
      row: selectedRow,
      plant: selectedPlant,
      PP: PP,
      trayType: TrayType,
      trayCount: TrayCount,
      timestamp: new Date().toISOString()
    });

    const topic = 'suenofarms/production/updates';
    mqttClient.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        console.error('Failed to publish MQTT message:', err);
      } else {
        console.log(`MQTT message published to topic "${topic}":`, message);
      }
    });

    res.send(`Form submitted successfully! Employee: ${selectedEmployee}, Row: ${selectedRow}, Plant: ${selectedPlant}, PP: ${PP}, Tray Type: ${TrayType}, Tray Count: ${TrayCount}`);
  } catch (err) {
    console.error('Error saving form data:', err);
    res.status(500).send('Error saving form data');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
