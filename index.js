/* 
 * Create an HTTP servre:
 */

'use strict';


/* ===== MODULES =============================================================== */
// Imports dependencies and set up http server
const 
  express = require('express'),
  bodyParser = require('body-parser'),
  request = require('request');

/* ===== ROUTES =============================================================== */
//const router = require('./routes/routes.js');
// import router from './routes/routes';

const app = express();
// const app = express().use(bodyParser.json()); // creates express http server


/* =============================================
   =           Basic Configuration             =
   ============================================= */

/* ----------  Views  ---------- */
// tell express what view engine is (here we change view to .ejs)
app.set('views', __dirname + '/client/views');
app.set('view engine', 'html');
// app.set('view engine', 'ejs');

/* ----------  Static Assets  ---------- */
app.use(express.static(__dirname + '/client/static')); // add css files into html/ejs files (static contents)



/* =============================================
   =                 Port Setup                =
   ============================================= */
// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

/* =============================================
   =                 MongoDB Setup                =
   ============================================= */
// require Mongoose
var mongoose = require ('mongoose');
var uristring = 'mongodb://localhost/to_do_list';
mongoose.connect(uristring, function (err, res) {
  if (err) {
    console.log ("ERROR connecting to: " + uristring + ". " + err);
  } else {
    console.log("Succeeded connected to: " + uristring);
  }
});
// mongoose.connect('https://safe-crag-36560.herokuapp.com/to_do_list');

/* ----------  Create Mongoose Schemas ---------- */

// User Schema:
var UserSchema = new mongoose.Schema({
  name: {type: String},
  priority: {type: Number},
  items: {type: Array},
}, {timestamps: true});

mongoose.model('User', UserSchema); // We are setting this Schema in our Models as 'User'
var User = mongoose.model ('User'); // We are retrieving this Schema from our Models, named 'User'






/* =============================================
   =                 Webhook Setup                =
   ============================================= */
/* 
 * Add webhook verification:
 */
 // Adds support for GET requests to facebook webhook
const my_token = process.env.FB_VERIFY_TOKEN;
const my_access = process.env.FB_ACCESS_TOKEN;

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


// /* 
//  * Add webhook endpoint:
//  * Allow users to send us messages
//  */
// // Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {  
 
  let body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === 'page') {

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      /* ----------  Messenger setup  ---------- */
      // Gets the message. entry.messaging is an array, but 
      // will only ever contain one message, so we get index 0
      let webhookEvent = entry.messaging[0];
      console.log(webhookEvent);

      // Gets the sender PSID
      let sender_psid = webhookEvent.sender.id;
      console.log ('Sender PSID is: ' + sender_psid);

      // Check which event 
      if (webhookEvent.message && webhookEvent.message.text) {
        handleMessage(sender_psid, webhookEvent.message);
      } 
      else if (webhookEvent.postback) {
        handlePostback(sender_psid, webhookEvent.postback);
      }

      addPersistentMenu();

     });



    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

/* ----------  Messenging API  ---------- */
function firstEntity(nlp, name) {
  return nlp && nlp.entities && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
}

// handles messages events
function handleMessage (sender_psid, received_message) {
  let response;

  // Checks if the message contains text
  if (received_message.text) {
    // Creates the payload for a basic text message, which
    // will be added to the body of our request to the Send API
    let text = received_message.text;
    const greeting = firstEntity(received_message.nlp, 'greetings');
    if (greeting && greeting.confidence > 0.8) {
      response = {
        "text": "Howdy!"
      }
    } else {
      // special messages to trigger the cards
      if (text == "Generic") {
        sendGenericMessage(sender_psid);
      }
      if(text.substring(0, 4) == "/add") {
        // add new item to list
      } else if(text.substring(0, 7) == "/create") {
        // create a new list
      } else if(text.substring(0, 7) == "/delete") {
        // delete current list
      } else if(text.substring(0, 5) == "/edit") {
        // edit list item
      } else {
        response = {
          "text": `You sent the message: "${received_message.text}". Now send me an attachment!`
        }
      }
    }
  } else if (received_message.attachments) {
    // Gets the URL of the message attachment
    let attachment_url = received_message.attachments[0].payload.url;
    response = {
      "attachment": {
        "type": "template",
        "payload": {
          "template_type": "generic",
          "elements": [{
            "title": "First Card",
            "subtitle": "Tap a button to answer.",
            "image_url": attachment_url,
            "buttons": [
              {
                "type": "postback",
                "title": "Yes!",
                "payload": "yes",
              },
              {
                "type": "postback",
                "title": "No!",
                "payload": "no",
              },
              {
                "type":"phone_number",
                "title":"call me maybe",
                "payload":"+16692229605"
              }
            ],
          }, 
          {
            "title": "Second card",
            "subtitle": "Element #2 of an hscroll",
            "image_url": "https://github.com/jw84/messenger-bot-tutorial",
            "buttons": [{
              "type": "postback",
              "title": "Click me!",
              "payload": "Payload for second element in a generic bubble"
            }]
          }]
        }
      }
    }
  }
  

  // Sends the response message
  callSendAPI (sender_psid, response);
}

function sendGenericMessage(sender) {
    let messageData = {
      "attachment": {
        "type": "template",
        "payload": {
        "template_type": "generic",
          "elements": [{
          "title": "First card",
            "subtitle": "Element #1 of an hscroll",
            "image_url": "http://messengerdemo.parseapp.com/img/rift.png",
            "buttons": [{
              "type": "web_url",
              "url": "https://www.messenger.com",
              "title": "web url"
            }, {
              "type": "postback",
              "title": "Postback",
              "payload": "Payload for first element in a generic bubble",
            }],
          }, {
            "title": "Second card",
            "subtitle": "Element #2 of an hscroll",
            "image_url": "http://messengerdemo.parseapp.com/img/gearvr.png",
            "buttons": [{
              "type": "postback",
              "title": "Postback",
              "payload": "Payload for second element in a generic bubble",
            }],
          }]
        }
      }
    }
    request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {access_token:my_access},
      method: 'POST',
      json: {
        recipient: {id:sender},
        message: messageData,
      }
    }, function(error, response, body) {
      if (error) {
        console.log('Error sending messages: ', error)
      } else if (response.body.error) {
        console.log('Error: ', response.body.error)
      }
    })
}


// handles messaging_postbakcs events
function handlePostback(sender_psid, received_postback) {
  let response;
  
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { "text": "Thanks!" }
  } else if (payload === 'no') {
    response = { "text": "Oops, try sending another image." }
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}


// sends response messages voa the Send API

/* ----------  Send API  ---------- */
function callSendAPI (sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient" : {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request ({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": {"access_token": my_access},
    "method": "POST",
    "json": request_body
  }, function (err, res, body){
    if (!err) {
      console.log ('message sent!')
    } else {
      console.error ("Unable to send message" + err);
    }
  });
}

/* ----------  Webview API  ---------- */
app.get('/', function(req, res){
  res.send("Hello I am testing");
  // res.render('login');
});


/* ----------  Persistant Menu API  ---------- */
function addPersistentMenu(){
 request({
    url: 'https://graph.facebook.com/v2.6/me/messenger_profile',
    qs: { access_token: my_access },
    method: 'POST',
    json:{
    "get_started":{
    "payload":"GET_STARTED_PAYLOAD"
   }
 }
}, function(error, response, body) {
    console.log("Add persistent menu " + response)
    if (error) {
        console.log('Error sending messages: ', error)
    } else if (response.body.error) {
        console.log('Error: ', response.body.error)
    }
})
 request({
    url: 'https://graph.facebook.com/v2.6/me/messenger_profile',
    qs: { access_token: my_access },
    method: 'POST',
    json:{
      "persistent_menu":[
        {
          "locale":"default",
          "composer_input_disabled":false,
          "call_to_actions":[
            {
              "title":"Show me my todo list",
              "type":"postback",
              "payload":"SHOW_TODO_LIST"
            },
            {
              "title":"Start todo list",
              "type":"postback",
              "payload":"CREATE_TODO_LIST"
            },
            
            // {
            //   "title":"Nested Menu Example",
            //   "type":"nested",
            //   "call_to_actions":[
            //     {
            //       "title":"Who am I",
            //       "type":"postback",
            //       "payload":"WHO"
            //     },
            //     {
            //       "title":"Joke",
            //       "type":"postback",
            //       "payload":"joke"
            //     },
            //     {
            //       "title":"Contact Info",
            //       "type":"postback",
            //       "payload":"CONTACT"
            //     }
            //   ]
            // },
            {
              "type":"web_url",
              "title":"Open PayPal",
              "url":"http://paypal.com",
              "webview_height_ratio":"full"
            }
          ]
        },
            {
              "locale":"en_US",
              "composer_input_disabled":false,
              "call_to_actions": [
                {
                  "title": ".",
                  "type": "postback",
                  "payload": "YES"
                }
              ]
            }
          ]
        }

}, function(error, response, body) {
    console.log(response)
    if (error) {
        console.log('Error sending messages: ', error)
    } else if (response.body.error) {
        console.log('Error: ', response.body.error)
    }
})
}
