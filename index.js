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
    CHATBOT_ID = 134479210603866;

/* ===== ROUTES =============================================================== */
//const router = require('./routes/routes.js');
// import router from './routes/routes';

var app = express();
// const app = express().use(bodyParser.json()); // creates express http server


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
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));
app.use(bodyParser.urlencoded({
    extended: false
}))
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

    console.log("================================= Test 5 ================================");
    // Checks this is an event from a page subscription
    if (body.object === 'page') {
        addPersistentMenu();

        console.log("Check req.body, what is body: " + JSON.stringify(body));

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {
            /* ----------  Messenger setup  ---------- */
            // Gets the message. entry.messaging is an array, but 
            // will only ever contain one message, so we get index 0
            // let webhookEvent = entry.messaging[0];

            entry.messaging.forEach(function(webhookEvent) {
                let sender_psid = webhookEvent.sender.id;
                let recipient_id = webhookEvent.recipient.id;
                console.log('Sender PSID is: ' + sender_psid);
                // console.log ('Recipient PSID is: ' + recipient_id);
                console.log("================================= Start saving user info into DB ================================");
                // Save User to MongoDB
                saveUser(sender_psid);
                // Check which event 
                if (webhookEvent.message && webhookEvent.message.text) {
                    console.log("================================= Handle Messages ================================");
                    if (sender_psid == CHATBOT_ID) {
                        console.log("From Chatbot to " + recipient_id);
                    } else {
                        handleMessage(sender_psid, webhookEvent.message);
                    }
                } else if (webhookEvent.postback) {
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
var mongoose = require('mongoose');
var uristring = 'mongodb://bot_acc:ilikeyou3707@35.160.59.136/bot_db'; // This is connected to AWS mongodb

mongoose.connect(uristring, function(err, res) {
    if (err) {
        console.log("ERROR connecting to: " + uristring + ". " + err);
    } else {
        console.log("Succeeded connected to: " + uristring);
    }
});


var User = require("./models/to_do_list_db"); // We are retrieving this Schema from our Models, named 'User' model

/* ----------  Get User/sender data and save it on MongoDB  ---------- */
function saveUser(fbId, firstName, lastName) {
    getFBData(fbId, function(err, userData) {
        let user = {
            fbId: fbId,
            firstName: firstName || userData.first_name,
            lastName: lastName || userData.last_name
        };

        // User.collection.findOneAndUpdate({fbId: fbId}, user, {upsert: true}, function (err, user) {
        User.findOneAndUpdate({
            fbId: fbId
        }, user, {
            upsert: true
        }, function(err, updatedUser) {
            if (err) {
                console.log(err);
            } else {
                console.log('User saved: ' + JSON.stringify(updatedUser));
            }
        });
    });
}

/* ----------  Get User/sender data from Messenger Platform User Profile API  ---------- */
function getFBData(fbId, callback) {
    request({
            method: 'GET',
            url: 'https://graph.facebook.com/v2.6/' + fbId,
            qs: {
                access_token: my_access
            }
        },

        function(err, res, body) {
            let userData = null
            if (err) console.log(err);
            else userData = JSON.parse(res.body);
            console.log("Get FB profile data, what is userData here: " + JSON.stringify(res.body));
            callback(err, userData);
        });
}


/* ----------  Get To-Do-List Info  ---------- */
function getListInfo(fbId) {
    User.findOne({
        fbId: fbId
    }, function(err, listData) {
        if (err) {
            callSendAPI(fbId, {
                text: "Something went wrong. Please try again!"
            });
        } else {
            var items = listData.items;
            console.log("Checking to do list items: " + JSON.stringify(items));
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
        // if (this.userData.items.indexOf(idx) > -1) {
        if (idx > -1 && this.userData.items[idx]) {

            this.userData.items.splice(idx, 1);
            console.log("After removing: " + this.userData.items);
            this.prioritize();
            this.update_db();
        }
    }

    prioritize() {
        this.userData.items.sort(function(a, b) {
            return a.priority < b.priority;
        });
    }

    update_db() {
        User.findOneAndUpdate({
            fbId: this.userData.fbId
        }, this.userData, {
            upsert: true
        }, function(err, user) {
            if (err) console.log(err);
            else console.log('item saved ' + user);
        });
    }
}



/* ----------  Webview API  ---------- */
app.get('/', function(req, res) {
    // res.sendFile('login.html')
    // res.send("Hello I am testing");
    res.render('main');
});

function naturalSplitMapFilterNumber(str) {
    if (str.match(/^\d+/) != null) {
      return [
        parseInt(str.match(/^\d+/)[0]),
          str.replace(/^\d+/, "")
        ];
    } else {
      return -1;
    }
    
}
/* ----------  Messenging API  ---------- */
function firstEntity(nlp, name) {
    return nlp && nlp.entities && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
}

// handles messages events
function handleMessage(sender_psid, received_message) {
    console.log("handleMessage( sender psid: " + sender_psid + ", " + JSON.stringify(received_message) + ")");
    // console.log ("handleMessage( recipient id: " + recipient_id + ", " + JSON.stringify(received_message) + ")");
    User.findOne({
        fbId: sender_psid
    }, function(err, userData) {
        if (err) {
            callSendAPI(fbId, {
                text: "Something went wrong. Please try again!"
            });
        } else {
            var my_list = new List(userData);
            var removal_time = 0;
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
                        callSendAPI(sender_psid, response);
                    } else if (text.substring(0, 4) == "/add") {
                        // add new item to list
                        console.log("========================== Adding messages ======================");
                        var msg = received_message.text.replace ("/add", "");
                        console.log("Potential adding item: " + msg);
                        if (msg == "") {
                          response = {
                            "text": "Are you trying to add items to your to_do_list? Please type the items you want to add after /add."
                          }
                          callSendAPI(sender_psid, response);
                        } else {
                          my_list.add(msg);
                          var list = my_list.get();
                          // Respond to add function, shows the list of items after adding
                          response = {
                              "text": "Congrats, you just added 1 item! Here is your list: \n" + list.map((item, idx) => {
                                  return (idx + 1) + ": " + item.text
                              }).join("\n")
                          }

                          callSendAPI(sender_psid, response);
                        }
                    } else if (text.substring(0, 5) == "/show") {
                        var list = my_list.get();
                        response = {
                            "text": list.map((item, idx) => {
                                return (idx + 1) + ": " + item.text
                            }).join("\n")
                        }
                        callSendAPI(sender_psid, response);
                    } else if (text.substring(0, 7) == "/remove") {
                        var remove_idx = parseInt(text.replace("/remove", "")) - 1;
                        var list = my_list.get();
                        if(!isNaN(remove_idx) && !list[remove_idx]) {
                            response = {
                                "text": "The specified index is out of the list boundaries, please input a new one."
                            }
                            callSendAPI(sender_psid, response);
                        }
                        else if(!isNaN(remove_idx)) {
                            // var index = received_message.text;
                            my_list.remove(remove_idx);
                            list = my_list.get();
                            response = {
                                "text": "Congrats! You just deleted 1 item! Here is your updated list: \n" + list.map((item, idx) => {
                                    return (idx + 1) + ": " + item.text
                                }).join("\n")
                            }
                            // removal_time = 0;
                            callSendAPI(sender_psid, response);
                        } else {
                            response = {
                                "text": "Please indicate the index of the item that you want to remove (number only) after typing /remove."
                            }
                            // removal_time += 1;
                            callSendAPI(sender_psid, response);
                        }
                    } else if (text.substring(0, 5) == "/edit") {
                      // separate /edit with the rest of text
                      var edit_txt = text.replace("/edit", "");
                      // trim the begining and end spaces of the text
                      var trimed_txt = edit_txt.trim();
                      // split the number and the other characters in the text and store into an array
                      var splited_txt = naturalSplitMapFilterNumber(trimed_txt);
                      // get the number
                      var edit_idx = splited_txt[0] - 1;
                      // get the text after the number
                      var msg = splited_txt[1];
                    
                      var list = my_list.get();
                      if (splited_txt == -1) {
                        response = {
                          "text": "Please indicate the index of the item that you want to edit before writing the edited item in the text."
                        }
                        callSendAPI (sender_psid, response);
                      } else {
                        if (!isNaN(edit_idx) && !list[edit_idx]) {
                          response = {
                            "text": "The specified index is out of the list boundaries, please input a new one."
                          }
                          callSendAPI (sender_psid, response);
                        }
                        else if (!isNaN(edit_idx)) {
                          my_list.edit(edit_idx, msg);
                          response = {
                            "text": "Congrats! You just edited 1 item! Here is your updated list: \n" + list.map((item, idx) => {
                                      return (idx + 1) + ": " + item.text
                                  }).join("\n")
                          }
                          callSendAPI(sender_psid, response);
                          // for (var i in myArray) { if (myArray[i] == "" || myArray[i] == " ") { i++; } console.log(myArray[i].trim()); }
                        } else {
                          response = {
                            "text": "Please indicate the index of the item that you want to edit and write the edited item in the text after typing /edit."
                          }
                          callSendAPI(sender_psid, response);
                        }
                      }
                    } else {
                        // special messages/keywords to trigger the cards/functions
                        switch (text) {
                            case "to do list":
                                sendGenericMessage(sender_psid);
                                break;
                            case "list temp":
                                list_temp(sender_psid);
                                break;
                            case "show":
                                // display list
                                // use webview here!!
                                //break;
                            case "create":
                                // create a new list
                                //break;
                            case "add":
                                addButton(sender_psid);
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
                                callSendAPI(sender_psid, response);

                        }

                    }
                } else if (received_message.attachments) {
                    var response = {
                        "text": "Sorry, I don't understand your request. "
                    };
                    callSendAPI(sender_psid, response);
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
    console.log("handlePostback(" + sender_psid + ", " + JSON.stringify(received_postback) + ")");
    // Get the payload for the postback
    let payload = received_postback.payload;
    console.log("payload===" + payload);

    // Set the response based on the postback payload
    if (payload === 'yes') {
        response = {
            "text": "Thanks!"
        }

    } else if (payload === 'no') {
        response = {
            "text": "Oops, try sending another image."
        }

    } else if (payload === 'GET_STARTED_PAYLOAD') {
        // Get user data from FB by using callback:
        // getUserById (sender_psid, function(userInfo) {
        getFBData(sender_psid, function(err, userInfo) {
            if (err) console.log("Error getting user info: " + err);
            else {
                console.log("Got User Info: " + JSON.stringify(userInfo));

                response = {
                    "text": `Hello, "${userInfo.first_name}"! Welcome to your to_do_list bot!! Please type operations like: add, show, edit, delete, to explore more about your bot!"`
                };

                // Note here: be careful with the scope of response variable
                callSendAPI(sender_psid, response);
            }

        });
    } else if (payload === 'CREATE_PAYLOAD') {
      response = {
        "text": "Please type: /add to add items into your to_do_list!"
      }
    } else if (payload === 'UPDATE_PAYLOAD') {
      response = {
        "text": "Please type: /edit to update the item on your to_do_list!"
      }
    } else if (payload === 'DELETE_PAYLOAD') {
        response = {
          "text": "Please type: /remove to delete the item on your to_do_list!"
        }
    } else if (payload === 'SHOW_PAYLOAD') {
        console.log("Does show_payload work?")
        User.findOne({
            fbId: sender_psid
        }, function(err, userData) {
            if (err) {
                callSendAPI(fbId, {
                    text: "Something went wrong. Please try again!"
                });
            } else {
                var my_list = new List(userData);
                var list = my_list.get();
                console.log("what is the list here" + list)
                response = {
                    "text": list.map((item, idx) => {
                        return (idx + 1) + ": " + item.text
                    }).join("\n")
                }
                callSendAPI(sender_psid, response);
            }
        })
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

function list_temp(sender_id) {
    User.findOne({
            fbId: sender_id
        }, function(err, userData) {
            if (err) {
                callSendAPI(fbId, {
                    text: "Something went wrong. Please try again!"
                });
            } else {
                var my_list = new List(userData);
                var list = my_list.get();
                console.log("what is the list in the list_temp" + list)
                
                list.map((item, idx) => {
                    let messageData = {
                        "attachment": {
                        "type": "template",
                        "payload": {
                            "template_type": "list",
                            "top_element_style": "compact",
                            "elements": [{
                                    "title": item.text,
                                    "subtitle": idx + 1
                                }]
                            }
                        }
                    }
                    callSendAPI(sender_id, messageData)
                })
                
                
                
            }
        })
    // let messageData = {
    //     "attachment": {
    //         "type": "template",
    //         "payload": {
    //             "template_type": "list",
    //             "top_element_style": "compact",
    //             "elements": [{
    //                 "title": "Classic T-Shirt Collection",
    //                 "subtitle": "Element #1 of an hscroll"
    //             }, {
    //                 "title": "Classic White T-Shirt",
    //                 "subtitle": "Element #1 of an hscroll"
    //             }]
    //         }
    //     }
    // }
    // callSendAPI(sender_id, messageData);
}

// Postback ADD button
function addButton(sender_id) {
    let messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "button",
                // "text":"What do you want to do next?",
                "text": "Please type the item you want to add into your To-Do-List!",
                "buttons": [{
                    "type": "postback",
                    "title": "Add items",
                    "payload": "ADD_ITEM"
                }]
            }
        }
    }
    callSendAPI(sender_id, messageData);
}

/* ----------  Send API  ---------- */
// sends response messages via the Send API
function callSendAPI(recipientId, response) {
    // Construct the message body
    let request_body = {
        "recipient": {
            "id": recipientId
        },
        "message": response
    }

    console.log("Sending '" + JSON.stringify(response) + "' to " + recipientId);

    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": {
            "access_token": my_access
        },
        "method": "POST",
        "json": request_body
    }, function(err, res, body) {
        if (!err) {
            console.log('message sent!')
        } else {
            console.error("Unable to send message" + err);
        }
    });
}

/* ----------  Persistant Menu API  ---------- */
function addPersistentMenu() {
    // Get _Started
    request({
        url: 'https://graph.facebook.com/v2.6/me/messenger_profile',
        qs: {
            access_token: my_access
        },
        method: 'POST',
        json: {
            "get_started": {
                "payload": "GET_STARTED_PAYLOAD"
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
        // url: 'https://graph.facebook.com/v2.6/me/messenger_profile',
        url: 'https://graph.facebook.com/me/messenger_profile',
        qs: {
            access_token: my_access
        },
        method: 'POST',
        json: {
            "persistent_menu": [{
                "locale": "default",
                "composer_input_disabled": false,
                "call_to_actions": [
                    // Row 1:
                    {
                        "title": "Start my todo list",
                        "type": "nested",
                        "call_to_actions": [{
                                "title": "Create",
                                "type": "postback",
                                "payload": "CREATE_PAYLOAD"
                            },
                            {
                                "title": "Edit/Update",
                                "type": "postback",
                                "payload": "UPDATE_PAYLOAD"
                            },
                            {
                                "title": "Delete",
                                "type": "postback",
                                "payload": "DELETE_PAYLOAD"
                            },
                            {
                                "title": "Show my todo list",
                                "type": "postback",
                                "payload": "SHOW_PAYLOAD"
                            }
                        ]
                    },
                    // Row 2: a web view for showing to-do list
                    {
                        "type": "web_url",
                        "title": "About the bot creator",
                        // "url": "https://safe-crag-36560.herokuapp.com/",
                        "url": "http://www.nicolezhou.com/",
                        "webview_height_ratio": "full"
                    }
                ]
            }]
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