var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");
var router = express.Router();

var app = express();

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(router);

// Server index page
app.get("/", function (req, res) {
  res.send("Deployed!");
});

// Facebook Webhook
// Used for verification
app.get("/webhook", function (req, res) {
  if (req.query["hub.verify_token"] === process.env.VERIFY_TOKEN) {
    console.log("Verified webhook");
    res.status(200).send(req.query["hub.challenge"]);
  } else {
    console.error("Verification failed. The tokens do not match.");
    res.sendStatus(403);
  }
});

// All callbacks for Messenger will be POST-ed here
app.post("/webhook", function (req, res) {
      
    //if (req.body.object == "page") {
      // Iterate over each entry
      // There may be multiple entries if batched
      req.body.entry.forEach(function(entry) {
        // Iterate over each messaging event
        entry.messaging.forEach(function(event) {
          console.log(event)
          if (event.postback) {
            processPostback(event);
          } else if (event.message) {
            if (event.message.attachments) {
                event.message.attachments.forEach(function(attachment){
                    if (attachment.type === 'location') {
                        console.log('lat: ' + attachment.payload.coordinates.lat + ' lon: ' + attachment.payload.coordinates.long)
                        sendMessage(event.sender.id, {text: 'Finding you places near your location'})
                    }
                });
            } else {
                const message = 'Echo: ' + event.message.text
                sendMessage(event.sender.id, {text: message, metadata: 'ECHO-MESSAGE'})
            }  
            
          }
        });
      });
  
      res.sendStatus(200);
    //}
  });
  
  function processPostback(event) {
    var senderId = event.sender.id;
    var payload = event.postback.payload;
  
    if (payload === "Greeting") {
      // Get user's first name from the User Profile API
      // and include it in the greeting
      request({
        url: "https://graph.facebook.com/v2.8/" + senderId,
        qs: {
          access_token: process.env.PAGE_ACCESS_TOKEN,
          fields: "first_name"
        },
        method: "GET"
      }, function(error, response, body) {
        var greeting = "";
        if (error) {
          console.log("Error getting user's name: " +  error);
        } else {
          var bodyObj = JSON.parse(body);
          name = bodyObj.first_name;
          greeting = "Hi " + name + ". ";
        }
        var message = greeting + "My name is Mamu Bot. I can find restaurants, grocery stores and medical stores for you which may be near your location or you feel like going to";
        sendMessage(senderId, {text: message});
        sendStartMenu(senderId)
      });
    } else if (payload === 'SHOW_MENU_PAYLOAD') {
        sendStartMenu(senderId)
    } else if (payload === 'FIND_RESTAURANTS_PAYLOAD') {
        const message = 'If you want to find restaurants near you, select send location, or else if you want to find restaurants yourself, select Ill choose myself'
        sendStartMenuReplies(senderId)
    } else if (payload === 'FIND_GROCERY_PAYLOAD') {
        const message = 'If you want to find grocery stores near you, select send location, or else if you want to find grocery stores yourself, select Ill choose myself'
        sendStartMenuReplies(senderId)
    } else if (payload === 'FIND_PHARMACY_PAYLOAD') {
        const message = 'If you want to find medical stores near you, select send location, or else if you want to find medical stores yourself, select Ill choose myself'
        sendStartMenuReplies(senderId)
    }
  }
  
  // sends message to user
  function sendMessage(recipientId, message) {
    request({
      url: "https://graph.facebook.com/v2.6/me/messages",
      qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
      method: "POST",
      json: {
        recipient: {id: recipientId},
        message: message,
        tag: 'APPOINTMENT_UPDATE'
      }
    }, function(error, response, body) {
      if (error) {
        console.log("Error sending message: " + response.error);
      }
    });
  }

function sendStartMenu(recipientId) {
    var message = {
        'attachment' : {
        'type': 'template',
        'payload' : {
          'template_type': 'generic',
          "elements":[
            {
             "title":"Poocho Mujhse",
             "buttons":[
               {
                 "type":"postback",
                 "title":"Find Restaurants",
                 "payload":"FIND_RESTAURANTS_PAYLOAD"
               },
               {
                "type":"postback",
                "title":"Find Grocery Stores",
                "payload":"FIND_GROCERY_PAYLOAD"
              },
              {
                "type":"postback",
                "title":"Find Medical Stores",
                "payload":"FIND_PHARMACY_PAYLOAD"
              }             
                ]      
            }
            ]
          }
        }
    }
    sendMessage(recipientId, message);   
}

function sendStartMenuReplies(recipientId) {
    var message = {
        "text": "Select your preferred option!",
        "quick_replies":[
        {
            "content_type":"location"
        },
        {
            "content_type":"text",
            "title":"Ill choose myself",
            "payload":"CHOOSE_MYSELF_PAYLOAD"
        }
        ]
    }
    sendMessage(recipientId, message);   
}

app.listen((process.env.PORT || 3000));