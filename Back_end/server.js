const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors'); // Import CORS

const app = express();
const PORT = process.env.PORT || 3000;
const saltRounds = 10;
const secretKey = 'yourSecretKey';

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS Configuration
const corsOptions = {
    origin: 'https://blood-donation-frontend-three.vercel.app', // Your frontend domain
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Allow credentials like cookies to be sent
    preflightContinue: false,
    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions)); // Use CORS middleware with options

// Connect to MongoDB
mongoose.connect('mongodb+srv://tamimihsan2763:L7EzEA0Ux6nglKyi@cluster0.np9li.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log('MongoDB connection error:', err));

// Define User schema and model
const userSchema = new mongoose.Schema({
    fullName: String,
    bloodGroup: String,
    gender: String,
    district: String,
    institution: String,
    phone: String,
    email: String,
    password: String,
    lastDonation: Date  // Add this field
});

const User = mongoose.model('User', userSchema);

const contactSchema = new mongoose.Schema({
    fullName: String,
    phone: String,
    email: String,
    message: String,
    timestamp: Date
});

const Contact = mongoose.model('Contact', contactSchema);

// Routes
app.post('/register', async (req, res) => {
    try {
        const { password, ...rest } = req.body;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const newUser = new User({ ...rest, password: hashedPassword });
        await newUser.save();
        res.status(201).send('User registered successfully');
    } catch (error) {
        console.error('Error registering user:', error.message);
        res.status(400).send('Error registering user');
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (user && await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ userId: user._id }, secretKey, { expiresIn: '1h' });
            res.status(200).json({ token });
        } else {
            res.status(400).send('Invalid credentials');
        }
    } catch (error) {
        console.error('Error logging in:', error.message);
        res.status(400).send('Error logging in');
    }
});

app.post('/contact', async (req, res) => {
    try {
        const { fullName, phone, email, message } = req.body;

        const contact = new Contact({
            fullName,
            phone,
            email,
            message,
            timestamp: new Date()  // Optionally add a timestamp
        });

        await contact.save();

        res.status(201).send('Contact form submitted successfully');
    } catch (error) {
        console.error('Error submitting contact form:', error.message);
        res.status(400).send('Error submitting contact form');
    }
});

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).send('Access Denied');

    jwt.verify(token, secretKey, (err, user) => {
        if (err) return res.status(403).send('Invalid Token');
        req.user = user;
        next();
    });
};

app.get('/user', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password'); // Exclude the password from the response
        if (!user) return res.status(404).send('User not found');

        const lastDonationDate = user.lastDonation ? new Date(user.lastDonation) : null;
        const today = new Date();
        const fourMonthsAgo = new Date(today);
        fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

        let status = 'Not eligible to donate blood';
        if (!lastDonationDate || lastDonationDate <= fourMonthsAgo) {
            status = 'Eligible to donate blood';
        }

        res.status(200).json({ ...user.toObject(), status });
    } catch (error) {
        console.error('Error fetching user:', error.message);
        res.status(400).send('Error fetching user');
    }
});

app.get('/find_donor/:bloodGroup', authenticateToken, async (req, res) => {
    try {
        const bloodGroup = req.params.bloodGroup;
        const users = await User.find({ bloodGroup });

        const donors = users.filter(user => {
            const lastDonationDate = user.lastDonation ? new Date(user.lastDonation) : null;
            const today = new Date();
            const fourMonthsAgo = new Date(today);
            fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
            return !lastDonationDate || lastDonationDate <= fourMonthsAgo;
        });

        res.status(200).json(donors);
    } catch (error) {
        console.error('Error fetching donors:', error.message);
        res.status(400).send('Error fetching donors');
    }
});

app.patch('/update-user', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const updatedUser = req.body;

        const user = await User.findByIdAndUpdate(userId, updatedUser, { new: true });

        if (!user) {
            return res.status(404).send('User not found');
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Error updating user:', error.message);
        res.status(400).send('Error updating user');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
