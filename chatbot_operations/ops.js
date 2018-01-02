
const
    my_token = process.env.FB_VERIFY_TOKEN,
    my_access = process.env.FB_ACCESS_TOKEN,
    db = require('../db_operations/user'),
    User = require('../models/to_do_list_db'),
    request = require('request')

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
            var my_list = new db.List(userData);
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
                            "text": "Hello there! I am you To-Do-List agent. Please type operations like: /add, /show, /edit, /remove, to explore more about me or you can use the persistent menu for a quick start!"
                        }
                        callSendAPI(sender_psid, response);
                    } else if (text.substring(0, 4) == "/add") {
                        // add new item to list
                        console.log("========================== Add Items ======================");
                        var msg = received_message.text.replace("/add", "");
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
                            if (list.length < 1) {
                                response = {
                                    "text": "Your list is empty, please add some items first."
                                }
                            } else {
                                response = {
                                    "text": "Congrats, you just added 1 item! Here is your list: \n" + list.map((item, idx) => {
                                        return (idx + 1) + ": " + item.text
                                    }).join("\n")
                                }
                            }

                            callSendAPI(sender_psid, response);
                        }
                    } else if (text.substring(0, 5) == "/show") {
                        console.log("========================== Show the to_do_list ======================");
                        var list = my_list.get();
                        if (list.length < 1) {
                            response = {
                                "text": "Your list is empty, please add some items first."
                            }
                        } else {
                            response = {
                                "text": list.map((item, idx) => {
                                    return (idx + 1) + ": " + item.text
                                }).join("\n")
                            }
                        }
                        callSendAPI(sender_psid, response);

                    } else if (text.substring(0, 7) == "/remove") {
                        console.log("========================== Remove items ======================");
                        var remove_idx = parseInt(text.replace("/remove", "")) - 1;
                        var list = my_list.get();
                        if (list.length < 1) {
                            response = {
                                "text": "Your list is empty, please add some items first!"
                            }
                            callSendAPI(sender_psid, response);
                        } else if (!isNaN(remove_idx) && !list[remove_idx]) {
                            response = {
                                "text": "The specified index is out of the list boundaries, please input a new one."
                            }
                            callSendAPI(sender_psid, response);
                        } else if (!isNaN(remove_idx)) {
                            // var index = received_message.text;
                            if (list.length == 1) {
                                my_list.remove(remove_idx);
                                response = {
                                    "text": "Your list is empty now!"
                                }
                            } else {
                                my_list.remove(remove_idx);
                                list = my_list.get();
                                response = {
                                    "text": "Congrats! You just deleted 1 item! Here is your updated list: \n" + list.map((item, idx) => {
                                        return (idx + 1) + ": " + item.text
                                    }).join("\n")
                                }

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
                        console.log("========================== Edit Items ======================");
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
                        if (list.length < 1) {
                            response = {
                                "text": "Your list is empty, please add some items first!"
                            }
                            callSendAPI(sender_psid, response);
                        } else if (splited_txt == -1) {
                            response = {
                                "text": "Please indicate the index of the item that you want to edit before writing the edited item in the text."
                            }
                            callSendAPI(sender_psid, response);
                        } else {
                            if (!isNaN(edit_idx) && !list[edit_idx]) {
                                response = {
                                    "text": "The specified index is out of the list boundaries, please input a new one."
                                }
                                callSendAPI(sender_psid, response);
                            } else if (!isNaN(edit_idx)) {
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
                    }
                } else if (received_message.attachments) {
                    var response = {
                        "text": "Sorry, I don't understand your request. "
                    };
                    callSendAPI(sender_psid, response);
                }

            }
        }
    })

}

// handles messaging_postbakcs events like button triggers
function handlePostback(sender_psid, received_postback) {
    let response;
    console.log("handlePostback(" + sender_psid + ", " + JSON.stringify(received_postback) + ")");
    // Get the payload for the postback
    let payload = received_postback.payload;
    console.log("payload===" + payload);

    // Set the response based on the postback payload

    if (payload === 'GET_STARTED_PAYLOAD') {
        // Get user data from FB by using callback:
        // getUserById (sender_psid, function(userInfo) {
        db.getFBData(sender_psid, function(err, userInfo) {
            if (err) console.log("Error getting user info: " + err);
            else {
                console.log("Got User Info: " + JSON.stringify(userInfo));

                response = {
                    "text": `Hello, "${userInfo.first_name}"! Welcome to your to_do_list bot!! Please type operations like: /add, /show, /edit, /remove, or use the persistent menu to explore more about your bot!"`
                };

                // Note here: be careful with the scope of response variable
                callSendAPI(sender_psid, response);
            }

        });
    } else {
        User.findOne({
                fbId: sender_psid
            },
            function(err, userData) {
                if (err) {
                    callSendAPI(fbId, {
                        text: "Something went wrong. Please try again!"
                    });
                } else {
                    var my_list = new db.List(userData);
                    var list = my_list.get();
                    if (payload === 'CREATE_PAYLOAD') {
                        response = {
                            "text": "Please type: /add to add items into your to_do_list!"
                        }
                    } else if (payload === 'UPDATE_PAYLOAD') {
                        if (list.length < 1) {
                            response = {
                                "text": "Your list is empty, please add some items first."
                            }
                        } else {
                            response = {
                                "text": "Please type: /edit to update the item on your to_do_list!"
                            }
                        }

                    } else if (payload === 'DELETE_PAYLOAD') {
                        if (list.length < 1) {
                            response = {
                                "text": "Your list is empty, please add some items first."
                            }
                        } else {
                            response = {
                                "text": "Please type: /remove to delete the item on your to_do_list!"
                            }
                        }

                    } else if (payload === 'SHOW_PAYLOAD') {
                        console.log("Does show_payload work?")

                        if (list.length < 1) {
                            response = {
                                "text": "Your list is empty, please add items."
                            }

                        } else {
                            console.log("what is the list here" + list);
                            console.log("what is the length of list here: " + list.length);
                            response = {
                                "text": list.map((item, idx) => {
                                    return (idx + 1) + ": " + item.text
                                }).join("\n")
                            }
                        }

                    }

                }
                callSendAPI(sender_psid, response);

            })
    }

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


module.exports = {
    handleMessage: handleMessage,
    handlePostback: handlePostback,
    addPersistentMenu: addPersistentMenu
}