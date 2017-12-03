
// ===== MODULES ===============================================================
// import express from 'express';

const my_token = process.env.FB_VERIFY_TOKEN;
const my_access = process.env.FB_ACCESS_TOKEN;
const 
  express = require('express'),
//  app = express(),
  router = express.Router();

router.get('/webhook', (req, res) => {

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
router.post('/webhook', (req, res) => {  
 
  let body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === 'page') {

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      /*
       * Messaging:
      */ 
      // Gets the message. entry.messaging is an array, but 
      // will only ever contain one message, so we get index 0
      let webhookEvent = entry.messaging[0];
      console.log(webhookEvent);

      // Gets the sender PSID
      let sender_psid = webhookEvent.sender.id;
      console.log ('Sender PSID is: ' + sender_psid);

      // Check which event 
      if (webhookEvent.message) {
        handleMessage(sender_psid, webhookEvent.message);
      } 
      // else if (webEvent.postback) {
          // do something
        //}
     });



    // Returns a '200 OK' response to all requests
    res.status(200).send('EVENT_RECEIVED');
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Messaging API:
// handles messages events
function handleMessage (sender_psid, received_message) {
  let response;

  // Check if the payload for a basic text message
  response = {
    "text": `You sent the message: "${received_message.text}". Now send me an another message lol!`
  }

  // Sends the response message
  callSendAPI (sender_psid, response);
}

// handles messaging_postbakcs events

// sends response messages voa the Send API

// Send a message with the Send API
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
  }, (err, res, body) => {
    if (!err) {
      console.log ('message sent!')
    } else {
      console.error ("Unable to send message" + err);
    }
  });
}

module.exports = router;
// export default router;