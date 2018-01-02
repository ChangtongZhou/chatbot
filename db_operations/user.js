const User = require('../models/to_do_list_db'),
		request = require('request'),
		my_token = process.env.FB_VERIFY_TOKEN,
		my_access = process.env.FB_ACCESS_TOKEN;


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

module.exports = {
	saveUser: saveUser,
	getFBData: getFBData,
	List: List
}