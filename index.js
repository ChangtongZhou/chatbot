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


/* 
 * Add webhook endpoint:
 * Allow users to send us messages
 */
// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {  
 
  let body = req.body;

  console.log("================================= Test 4 ================================");
  // Checks this is an event from a page subscription
  if (body.object === 'page') {
    addPersistentMenu();
    
    console.log ("Check req.body, what is body: " + JSON.stringify(body));

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {
      /* ----------  Messenger setup  ---------- */
      // Gets the message. entry.messaging is an array, but 
      // will only ever contain one message, so we get index 0
      // let webhookEvent = entry.messaging[0];

      entry.messaging.forEach(function (webhookEvent) {
        let sender_psid = webhookEvent.sender.id;
        console.log ('Sender PSID is: ' + sender_psid);
        console.log("================================= Start saving user info into DB ================================");
        // Save User to MongoDB
        saveUser (sender_psid);
        // Check which event 
        if (webhookEvent.message && webhookEvent.message.text) {
          console.log("================================= Handle Messages ================================");
          handleMessage(sender_psid, webhookEvent.message);
        } 
        else if (webhookEvent.postback) {
          console.log("================================= Handle Postbacks ================================");
          // addPersistentMenu();
          handlePostback(sender_psid, webhookEvent.postback);
        }
        
      });

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
var uristring = 'mongodb://bot_acc:ilikeyou3707@35.160.59.136/bot_db'; // This is connected to AWS mongodb

mongoose.connect(uristring, function (err, res) {
  if (err) {
    console.log ("ERROR connecting to: " + uristring + ". " + err);
  } else {
    console.log("Succeeded connected to: " + uristring);
  }
});


var User = require("./models/to_do_list_db"); // We are retrieving this Schema from our Models, named 'User' model

/* ----------  Get User/sender data and save it on MongoDB  ---------- */
function saveUser (fbId, firstName, lastName) {
  getFBData (fbId, function (err, userData) {
    // let user = {
    //   fbId: fbId,
    //   firstName: firstName || userData.first_name,
    //   lastName: lastName || userData.last_name
    // };

    User.find({fbId: fbId}, function(err, user) {
      user.firstName = firstName;
      user.lastName = lastName;

      user.save(function(err, updatedUser) {
        if (err) console.log(err);
        else console.log("Updated user: " + JSON.stringify(user));
      });
    });

    // User.collection.findOneAndUpdate({fbId: fbId}, user, {upsert: true}, function (err, user) {
    // User.findOneAndUpdate({fbId: fbId}, user, {upsert: true}, function (err, user) {
    //   if (err) console.log (err);
    //   else console.log('user saved: ' + JSON.stringify(user));
    // });
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
    console.log ("Get FB profile data, what is userData here: " + JSON.stringify (res.body));
    callback (err, userData);
  });
}


/* ----------  Get To-Do-List Info  ---------- */
function getListInfo (fbId) {
  User.findOne ({fbId: fbId}, function (err, listData) {
    if (err) {
      callSendAPI (fbId, {text: "Something went wrong. Please try again!"});
    } else {
      var items = listData.items;
      console.log ("Checking to do list items: " + JSON.stringify(items));
      // Send back to FB messenger platform:
      // need for loop here to go through items array:
      // callSendAPI (fbId, {"text": `Item: ${items.text} -> Priority: $(items.priority)`})
    }
  })

}

class List {
  constructor(userData) {
    this.userData = userData;
  }

  add(text, priority) {
    var list_item = {
      text: text,
      priority: priority
    };
    this.userData.items.push(list_item);

    this.prioritize();
    this.update_db();
  }

  edit(idx, text) {
    this.userData.items[idx].text = text;

    this.prioritize();
    this.update_db();
  }

  get() {
    console.log("checking this.userData" + this.userData);
    console.log("checking this.userData.items" + this.userData.items);
    return this.userData.items;
  }

  remove(idx) {
    if(this.userData.items.indexOf(idx) > -1) {
      this.userData.items.splice(idx, 1);

      this.prioritize();
      this.update_db();
    }
  }

  prioritize() {
    this.userData.items.sort(function (a, b) {
      return a.priority < b.priority;
    });
  }

  update_db() {
    User.findOneAndUpdate({fbId: this.fbId}, this.userData, {upsert: true}, function (err, user) {
      if (err) console.log (err);
      else console.log('item saved ' + user);
    });
  }
}



/* ----------  Webview API  ---------- */
app.get('/', function(req, res){
  res.send("Hello I am testing");
  // res.render('login');
});

/* ----------  Messenging API  ---------- */
function firstEntity(nlp, name) {
  return nlp && nlp.entities && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
}

// handles messages events
function handleMessage (sender_psid, received_message) {
  console.log ("handleMessage(" + sender_psid + ", " + JSON.stringify(received_message) + ")");

  User.findOne ({fbId: sender_psid}, function (err, userData) {
    if (err) {
      callSendAPI (fbId, {text: "Something went wrong. Please try again!"});
    } else {
      console.log ("Checing sender_psid in handleMessage: " + sender_psid);
      // console.log ("Checing userData in handleMessage: " + userData);
      var my_list = new List(userData);
      console.log ("Checing my_list: " + my_list);
      console.log ("Checking to do list items: " + my_list.get());
      // Checks if the message was sent via the Message Echo Callback
      if (!received_message.is_echo) {
        // Checks if the message contains text
        if (received_message.text) {
          // Creates the payload for a basic text message, which
          // will be added to the body of our request to the Send API
          let text = received_message.text.toLowerCase().trim();

          const greeting = firstEntity(received_message.nlp, 'greetings');
          if (greeting && greeting.confidence > 0.8) {
            response = {
              "text": "Hello there! I am you To-Do-List agent. Please type operations like: add, show, edit, delete, to explore more about me!"
            }
            callSendAPI (sender_psid, response);
          } else if (text.substring(0, 4) == "/add") {
                // var response = {
                //   "text": "Please type the item you want to add into your To-Do-List!"
                // }
                // callSendAPI (sender_psid, response);
                // add new item to list
                console.log("========================== Adding messages ======================");
                var msg = received_message.text.substring(4);
                console.log("Potential adding item: " + msg);
                my_list.add(msg);
                response = {
                 "text": "Congrats, you just added 1 item!"
                }
                callSendAPI (sender_psid, response);
          } else {
            // special messages/keywords to trigger the cards/functions
            switch (text) {
              case "to do list":
                sendGenericMessage(sender_psid);
                break;
              case "show":
                // display list
                // use webview here!!
                //break;
              case "create":
                // create a new list
                //break;
              case "add":
                addButton (sender_psid);
                break;
              case "edit":
                // create a new list
                //break;
              case "delete":
                // create a new list
                //break;
              default:
                var response = {
                  "text": `You want to add the following item : "${received_message.text}". Now send me an attachment!`
                }
                // Sends the response message
                callSendAPI (sender_psid, response);
              
            }

          }
        } else if (received_message.attachments) {
          var response = {"text": "Sorry, I don't understand your request. "};
          callSendAPI (sender_psid, response);
        }
        
      }
          // Send back to FB messenger platform:
          // need for loop here to go through items array:
          // callSendAPI (fbId, {"text": `Item: ${items.text} -> Priority: $(items.priority)`})
        }
      })
  // let response;

}

// handles messaging_postbakcs events like button triggers
function handlePostback(sender_psid, received_postback) {
  let response;
  console.log ("handlePostback(" + sender_psid + ", " + JSON.stringify(received_postback) + ")");
  // Get the payload for the postback
  let payload = received_postback.payload;
  console.log ("payload===" + payload);

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { "text": "Thanks!" }
   
  } else if (payload === 'no') {
    response = { "text": "Oops, try sending another image." }

  } else if (payload === 'GET_STARTED_PAYLOAD') {
    // Get user data from FB by using callback:
    // getUserById (sender_psid, function(userInfo) {
      getFBData (sender_psid, function(err, userInfo){
        if (err) console.log ("Error getting user info: " + err);
        else {
        console.log ("Got User Info: " + JSON.stringify(userInfo));
      
        response = {"text": `Hello, "${userInfo.first_name}"! Welcome to your to_do_list bot!! Please type operations like: add, show, edit, delete, to explore more about your bot!"`};

      // Note here: be careful with the scope of response variable
        callSendAPI(sender_psid, response);
      }

    });
  }
      
  // } else if (payload == 'ADD_ITEM') {
  //   addButton(sender_psid);
  // }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}


function sendGenericMessage(sender_id) {
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
              "title": "Yes",
              "payload": "yes",
            }],
          }, {
            "title": "Second card",
            "subtitle": "Element #2 of an hscroll",
            "image_url": "http://messengerdemo.parseapp.com/img/gearvr.png",
            "buttons": [{
              "type": "postback",
              "title": "No",
              "payload": "no",
            }],
          }]
        }
      }
    }
    callSendAPI(sender_id, messageData);
}


// Postback ADD button
function addButton (sender_id) {
  let messageData = {
    "attachment":{
      "type":"template",
      "payload":{
        "template_type":"button",
        // "text":"What do you want to do next?",
        "text": "Please type the item you want to add into your To-Do-List!",
        "buttons":[
          {
            "type":"postback",
            "title":"Add items",
            "payload": "ADD_ITEM"
          }
        ]}}
  }
  callSendAPI(sender_id, messageData);
}

/* ----------  Send API  ---------- */
// sends response messages via the Send API
function callSendAPI (recipientId, response) {
  // Construct the message body
  let request_body = {
    "recipient" : {
      "id": recipientId
    },
    "message": response
  }

  console.log("Sending '" + JSON.stringify(response) + "' to " + recipientId);

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
                // Row 2: a web view for showing to-do list
                // https://developers.facebook.com/docs/messenger-platform/webview
                {
                  "type":"web_url",
                  "title":"Show me my todo list",
                  "url":"http://petershats.parseapp.com/hat-news",
                  "webview_height_ratio":"full"
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
