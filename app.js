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
/* ----------  Variables  ---------- */
var previousMessageHash = {};
var senderContext = {};
var isStopped = false;

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
   =                 Webhook Setup                =
   ============================================= */
/* 
 * Add webhook verification:
 */
 // Adds support for GET requests to facebook webhook
const my_token = process.env.FB_VERIFY_TOKEN;
const my_access = process.env.FB_ACCESS_TOKEN;


// Routes:
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

  console.log("================================= Test 11 ================================");

  

  // Checks this is an event from a page subscription
  if (body.object === 'page') {
    // addPersistentMenu();
    
    console.log ("Hellllllo, what is body: " + JSON.stringify(body));

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach ( function(pageEntry) {
      var pageId = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      pageEntry.messaging.forEach (function (messagingEvent) {
        if (messagingEvent.optin) {
          receivedAuthentication (messagingEvent);
        } else if (messagingEvent.message) {
          receivedMessage (messagingEvent);
        } else if (messagingEvent.postback) {
          receivedPostback (messagingEvent);
        } else if (messagingEvent.delivery) {
          receivedDeliveryConfirmation (messagingEvent);

        } else {
          console.log ("Webhook received unknow messagingEvent: ", messagingEvent);
        }

      })



      // ---------------------------------------------------------------------------------------
      /* ----------  Messenger setup  ---------- */
      // Iterate over each messaging event
      // Gets the message. entry.messaging is an array, but 
      // will only ever contain one message, so we get index 0
      // let webhookEvent = entry.messaging[0];
      // console.log(webhookEvent);

      // // Gets the sender PSID
      // let sender_psid = webhookEvent.sender.id;
      // console.log ('Sender PSID is: ' + sender_psid);

      // // Check which event 
      // if (webhookEvent.message && webhookEvent.message.text) {
      //   handleMessage(sender_psid, webhookEvent.message);
      // } 
      // else if (webhookEvent.postback) {
      //   console.log("================================= Test 10 ================================");
      //   // addPersistentMenu();
      //   handlePostback(sender_psid, webhookEvent.postback);
      // }

      // // // Save User to MongoDB
      // saveUser (sender_psid);

      // addPersistentMenu();

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
var mongoose = require ('mongoose');
var uristring = 'mongodb://bot_acc:ilikeyou3707@35.160.59.136/bot_db';
// testing:
// console.log(mongoose.connection.readyState);

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
  fbId: {type: String, required: true},
  firstName: String,
  lastName: String,
  items: [{
    text: { type: String, trim: true },
      priority: { type: Number, min: 0 } 
    }]}, 
  {timestamps: true});

// User model:
mongoose.model('User', UserSchema); // We are setting this Schema in our Models as 'User'
var User = mongoose.model ('User'); // We are retrieving this Schema from our Models, named 'User'

/* ----------  Get User/sender data and save it on MongoDB  ---------- */
function saveUser (fbId, firstName, lastName) {
  getFBData (fbId, function (err, userData) {
    let user = {
      fbId: fbId,
      firstName: firstName || userData.first_name,
      lastName: lastName || userData.last_name
    };

    // User.collection.findOneAndUpdate({fbId: fbId}, user, {upsert: true}, function (err, user) {
    User.findOneAndUpdate({fbId: fbId}, user, {upsert: true}, function (err, user) {
      if (err) console.log (err);
      else console.log('user saved ' + user.firstName);
    });
  });
}

/* ----------  Get User/sender data from Messenger Platform User Profile API  ---------- */
function getFBData(fbId, callback){
  request ({
    method: 'GET',
    url: 'https://graph.facebook.com/v2.6/' + fbId,
    qs: {
      access_token: my_access
    }
  },

  function (err, res, body) {
    let userData = null
    if (err) console.log (err);
    else userData = JSON.parse (res.body);
    callback (err, userData);
  });
}


/* ----------  Find one user  ---------- */
function getUserById (fbId, callback) {
  
  // var result = null;
  User.findOne ({fbId: fbId}, function (err, userObj) {
    if (err) {
      console.log ('Cannot get user info ' + err);
    } else if (userObj) {
      // result = userObj;
      console.log ('LoHAHAHAHA!! User exists. User name is ' + userObj.firstName);
      console.log ('HIIII!! userObj is ' + userObj);
      // callback(userObj);
      return callback(userObj);
    } else {
      console.log ('User not found!');
    }
  });
}








/* =============================================
   =                 Events Setup                =
   ============================================= */
/* ---------- Authorization Event ---------------*/
function receivedAuthentication(event) {
  if(isStopped == true)
  {
    return;
  }
  var data = req.body;
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfAuth = event.timestamp;

  // The 'ref' field is set in the 'Send to Messenger' plugin, in the 'data-ref'
  // The developer can set this to an arbitrary value to associate the 
  // authentication callback with the 'Send to Messenger' click event. This is
  // a way to do account linking when the user clicks the 'Send to Messenger' 
  // plugin.
  var passThroughParam = event.optin.ref;

  console.log("Received authentication for user %d and page %d with pass " +
    "through param '%s' at %d", senderID, recipientID, passThroughParam, 
    timeOfAuth);

  // When an authentication is received, we'll send a message back to the sender
  // to let them know it was successful.
  sendTextMessage(senderID, "Authentication successful");
}

var firstName = "undefined";
var lastName = "undefined"; 

/* ----------  Webview API  ---------- */
app.get('/', function(req, res){
  res.send("Hello I am testing");
  // res.render('login');
});

/* ----------  Messenging Event  ---------- */

function receivedMessage (event) {
  callGetLocaleAPI (event, handleReceivedMessage);
}

function handleReceivedMessage (event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  var messageID = message.mid;

  // You may get a text or attachment but not both
  var messageText = message.text;
  var quickReply = message.quick_reply;
  var isEcho = message.is_echo;

  if (isEcho) {
    // just logging message echoes to console
    console.log ("Receved echo for message %s", messageID);
    return;
  } else if (quickReply) {
    var quickReplyPayload = quickReply.payload;
    messageText = quickReplyPayload;
    sendCustomMessage (senderID, messageText);
    return;
  }

  if (messageText) {
    if ((isStopped == true) && (messageText != "start")) {
      return;
    }

    console.log ("Received message for user %d and page %d at %d with message: %s", senderID, recipientID, timeOfMessage, messageText);

    // If receive a text message, check to see if it matches any special keywords and 
    // send back the corresponding example. Otherwise, just echo the text we received.
    switch (messageText.toLowerCase()) {
      case 'button':
        sendButtonMessage (senderID);
        break;

      case 'to do list':
        sendGenericMessage (senderID);
        break;

      case 'quick reply':
        sendQuickReply (senderID);
        break;
      case 'user info':
        if (firstName) {
          sendTextMessage(senderID, firstName);
        }
        break;
      case 'add menu':
        addPersistentMenu();
        break;
      case 'stop':  // Stop the Bot from responding if the admin sends this messages
        if(senderID ==  1073962542672604) {
          console.log("Stoppping bot");
          isStopped = true;
        }
        break;

      default:
        sendEnteredMessage(senderID, messageText);
    }
  } 

  // Add messageAttachment later

}



/* =============================================
   =                 Message Functions                =
   ============================================= */

 // Delivery Confirmation Event:
function receivedDeliveryConfirmation (event) {
  if (isStopped == true) {
    return;
  }

  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var delivery = event.delivery;
  var messageIDs = delivery.mids;
  var watermark = delivery.watermark;
  var sequenceNumber = delivery.seq;

  if (messageIDs) {
    messageIDs.forEach(function(messageID) {
      console.log("Received delivery confirmation for message ID: %s", 
        messageID);
    });
  }

  console.log("All message before %d were delivered.", watermark);
}

// Postback Event:
function receivedPostback (event) {
  if (isStopped == true) {
    return;
  }
  callGetLocaleAPI (event, handleReceivedPostback);
}

function handleReceivedPostback (event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;

  console.log("Received postback for user %d and page %d with payload '%s' " + 
    "at %d", senderID, recipientID, payload, timeOfPostback);

  // When a postback is called, we'll send a message back to the sender to 
  // let them know it was successful
  sendCustomMessage(senderID,payload);
}

// Message read event
function receivedMessageRead(event) {
  if(isStopped == true)
  {
    return;
  }
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;

  // All messages before watermark (a timestamp) or sequence have been seen.
  var watermark = event.read.watermark;
  var sequenceNumber = event.read.seq;

  console.log("Received message read event for watermark %d and sequence " +
    "number %d", watermark, sequenceNumber);
}

// Send a text message using the Send API
function sendTextMessage (recipientID, messageText) {
  var messageData = {
    "recipient": {
      "id": recipientID
    }, 

    "message": {
      "text": messageText,
    }
  };

  callSendAPI(messageData);
}

// Send the user information back, the bot grabs this for every message
function sendLocale (recipientID) {
  var nameString = firstName + " " + lastName;

  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: nameString,
      quick_replies: [
        {
          "content_type":"text",
          "title":"Home",
          "payload":"home"
        }
      ]
    }
  };

  callSendAPI(messageData);
}

/*
 * Send a button message using the Send API.
 *
 */
function sendButtonMessage(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "button",
          text: "This is test text",
          buttons:[{
            type: "web_url",
            url: "https://www.oculus.com/en-us/rift/",
            title: "Open Web URL"
          }, {
            type: "postback",
            title: "Trigger Postback",
            payload: "DEVELOPED_DEFINED_PAYLOAD"
          }, {
            type: "phone_number",
            title: "Call Phone Number",
            payload: "+16505551234"
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}

/*
 * Send a message with Quick Reply buttons.
 *
 */
function sendQuickReply(recipientId) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "Some regular buttons and a location test",
      metadata: "DEVELOPER_DEFINED_METADATA",
      quick_replies: [
        {
          "content_type":"text",
          "title":"Action",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_ACTION"
        },
        {
          "content_type":"text",
          "title":"Something else",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_SOMETHING"
        },
        {
          "content_type":"location",
          "title":"Send Location",
          "payload":"DEVELOPER_DEFINED_PAYLOAD_FOR_PICKING_LOCATION"
        }
      ]
    }
  };

  callSendAPI(messageData);
}

/*
 * Call the Send API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token: my_access },
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      if (messageId) {
        console.log("Successfully sent message with id %s to recipient %s", 
          messageId, recipientId);
      } 
    } else {
      console.error("Unable to send message. :" + response.error);
    }
  });  
}

/*
 * Call the Get Locale API. The message data goes in the body. If successful, we'll 
 * get the message id in a response 
 *
 */
function callGetLocaleAPI(event, handleReceived) {
    var userID = event.sender.id;
    var http = require('https');
    var path = '/v2.6/' + userID +'?fields=first_name,last_name,profile_pic,locale,timezone,gender&access_token=' + my_access;
    var options = {
      host: 'graph.facebook.com',
      path: path
    };
    
    if(senderContext[userID])
    {
       firstName = senderContext[userID].firstName; 
       lastName = senderContext[userID].lastName; 
       console.log("found " + JSON.stringify(senderContext[userID]));
       if(!firstName) 
          firstName = "undefined";
       if(!lastName) 
          lastName = "undefined";
       handleReceived(event);
       return;
    }

    var req = http.get(options, function(res) {
      //console.log('STATUS: ' + res.statusCode);
      //console.log('HEADERS: ' + JSON.stringify(res.headers));

      // Buffer the body entirely for processing as a whole.
      var bodyChunks = [];
      res.on('data', function(chunk) {
        // You can process streamed parts here...
        bodyChunks.push(chunk);
      }).on('end', function() {
        var body = Buffer.concat(bodyChunks);
        var bodyObject = JSON.parse(body);
        firstName = bodyObject.first_name;
        lastName = bodyObject.last_name;
        if(!firstName) 
          firstName = "undefined";
        if(!lastName) 
          lastName = "undefined";
        senderContext[userID] = {};
        senderContext[userID].firstName = firstName;
        senderContext[userID].lastName = lastName;
        console.log("defined " + JSON.stringify(senderContext));
        handleReceived(event);
      })
    });
    req.on('error', function(e) {
      console.log('ERROR: ' + e.message);
    });
}

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
    // if (text == "Get Started") {
    //   response = {
    //     "text": 
    //   }
    // }
    if (greeting && greeting.confidence > 0.8) {
      response = {
        "text": "Howdy!"
      }
    } else {
      // special messages to trigger the cards
      if (text == "To Do List") {
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
  }
  // else if (received_message.attachments) {
  //   // Gets the URL of the message attachment
  //   let attachment_url = received_message.attachments[0].payload.url;
  //   handleAttachment(sender_psid, attachment_url);
    // callSendAPI (sender_psid, response);
    // response = {
    //   "attachment": {
    //     "type": "template",
    //     "payload": {
    //       "template_type": "generic",
    //       "elements": [{
    //         "title": "First Card",
    //         "subtitle": "Tap a button to answer.",
    //         "image_url": attachment_url,
    //         "buttons": [
    //           {
    //             "type": "postback",
    //             "title": "Yes!",
    //             "payload": "yes",
    //           },
    //           {
    //             "type": "postback",
    //             "title": "No!",
    //             "payload": "no",
    //           },
    //           {
    //             "type":"phone_number",
    //             "title":"call me maybe",
    //             "payload":"+16692229605"
    //           }
    //         ],
    //       }, 
    //       {
    //         "title": "Second card",
    //         "subtitle": "Element #2 of an hscroll",
    //         "image_url": "https://github.com/jw84/messenger-bot-tutorial",
    //         "buttons": [{
    //           "type": "postback",
    //           "title": "Click me!",
    //           "payload": "Payload for second element in a generic bubble"
    //         }]
    //       }]
    //     }
    //   }
    // }
  // }
  

  // Sends the response message
  callSendAPI (sender_psid, response);
}

function sendGenericMessage(sender_id) {
    var messageData = {
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
        recipient: {id:sender_id},
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
  console.log ("what is received_postback" + JSON.stringify(received_postback));
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { "text": "Thanks!" }
    callSendAPI(sender_psid, response);
  } else if (payload === 'no') {
    response = { "text": "Oops, try sending another image." }
    callSendAPI(sender_psid, response);
  } else if (payload == 'GET_STARTED_PAYLOAD') {
    console.log ("lolololololo: what is sender id: " + sender_psid);
    
    // Get user data from MongoDB by using callback:
    getUserById (sender_psid, function(userInfo){
      console.log ("hohoho: what is user data: " + userInfo.firstName);
      var userName = JSON.stringify(userInfo.firstName);
      response = {"text": `Hello, "${userInfo.firstName}"! Welcome to your to_do_list bot!!`};
      PersistentCallSendAPI(sender_psid, response);
    });
      
  }
  // Send the message to acknowledge the postback
  // callSendAPI(sender_psid, response);
}


// sends response messages voa the Send API

/* ----------  Send API  ---------- */
// function callSendAPI (sender_psid, response) {
//   // Construct the message body
//   let request_body = {
//     "recipient" : {
//       "id": sender_psid
//     },
//     "message": response
//   }

//   // Send the HTTP request to the Messenger Platform
//   request ({
//     "uri": "https://graph.facebook.com/v2.6/me/messages",
//     "qs": {"access_token": my_access},
//     "method": "POST",
//     "json": request_body
//   }, function (err, res, body){
//     if (!err) {
//       console.log ('message sent!')
//     } else {
//       console.error ("Unable to send message" + err);
//     }
//   });
// }


function PersistentCallSendAPI (sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient" : {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request ({
    "uri": "https://graph.facebook.com/v2.6/me/messenger_profile",
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

/* ----------  Persistant Menu API  ---------- */
function addPersistentMenu(){

// Get _Started
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
              "composer_input_disabled": false,
              "call_to_actions":[
                // Row 1:
                {
                  "title":"Start my todo list",
                  "type":"nested",
                  "call_to_actions":[
                    {
                      "title":"Create",
                      "type":"postback",
                      "payload":"CREATE_PAYLOAD"
                    },
                    {
                      "title":"Edit/Update",
                      "type":"postback",
                      "payload":"UPDATE_PAYLOAD"
                    },
                    {
                      "title":"Delete",
                      "type":"postback",
                      "payload":"DELETE_PAYLOAD"
                    }
                  ]
                },
                // Row 2:
                {
                  "type":"web_url",
                  "title":"Show me my todo list",
                  "url":"http://petershats.parseapp.com/hat-news",
                  "webview_height_ratio":"full"
                }
              ]
            },
            // Differenet locales in another country (Optional)
            {
              "locale":"zh_CN",
              "composer_input_disabled":false,
              "call_to_actions":[
                {
                  "title":"Pay Bill",
                  "type":"postback",
                  "payload":"PAYBILL_PAYLOAD"
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
