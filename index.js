/* 
 * Create an HTTP servre:
 */
'use strict';

/* ===== MODULES =============================================================== */
// Imports dependencies and set up http server
const
    express = require('express'),
    bodyParser = require('body-parser'),
    request = require('request'),
    CHATBOT_ID = 134479210603866,
    db = require('./db_operations/user'),
    chatbot = require('./chatbot_operations/ops')


var app = express();


/* =============================================
   =           Basic Configuration             =
   ============================================= */

/* ----------  Views  ---------- */
// tell express what view engine is (here we change view to .ejs)
app.set('views', __dirname + '/client/views');
app.set('view engine', 'ejs');

/* ----------  Static Assets  ---------- */
app.use(express.static(__dirname + '/client/static')); // add css files into html/ejs files (static contents)


/* =============================================
   =                 Port Setup                =
   ============================================= */
// Sets server port and logs message on success
var port = process.env.PORT || 1337;
app.listen(port, () => console.log('webhook is listening'));


// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
    extended: false
}))

// Parse application/json 
app.use(bodyParser.json())


/* =============================================
   =                 Webhook Routes            =
   ============================================= */
app.get('/webhook', (req, res) => {

    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = my_token;

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});


/* 
 * Add webhook endpoint:
 * Allow users to send chatbot messages
 */
// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {

    let body = req.body;

    console.log("================================= Test 5 ================================");
    // Checks this is an event from a page subscription
    if (body.object === 'page') {
        chatbot.addPersistentMenu();

        console.log("The req.body is: " + JSON.stringify(body));

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {
            /* ----------  Messenger setup  ---------- */
            // Gets the message. entry.messaging is an array, but 
            // will only ever contain one message, so we get index 0

            entry.messaging.forEach(function(webhookEvent) {
                let sender_psid = webhookEvent.sender.id;
                let recipient_id = webhookEvent.recipient.id;
                console.log('Sender PSID is: ' + sender_psid);
                // console.log ('Recipient PSID is: ' + recipient_id);
                console.log("================================= Start saving user info into DB ================================");
                // Save User to MongoDB
                db.saveUser(sender_psid);
                // Check which event 
                if (webhookEvent.message && webhookEvent.message.text) {
                    console.log("================================= Handle Messages ================================");
                    if (sender_psid == CHATBOT_ID) {
                        console.log("From Chatbot to " + recipient_id);
                    } else {
                        chatbot.handleMessage(sender_psid, webhookEvent.message);
                    }
                } else if (webhookEvent.postback) {
                    console.log("================================= Handle Postbacks ================================");
                    // addPersistentMenu();
                    chatbot.handlePostback(sender_psid, webhookEvent.postback);
                }

            });

        });
        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});


/* =============================================
   =                 MongoDB Setup                =
   ============================================= */
// require Mongoose
var mongoose = require('mongoose');
var uristring = 'mongodb://bot_acc:ilikeyou3707@35.160.59.136/bot_db'; // This is connected to AWS mongodb

mongoose.connect(uristring, function(err, res) {
    if (err) {
        console.log("ERROR connecting to: " + uristring + ". " + err);
    } else {
        console.log("Succeeded connected to: " + uristring);
    }
});


