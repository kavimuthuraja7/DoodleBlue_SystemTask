/*----------------------------------- Import Section ----------------------------------------------------------------------*/

const express = require('express');
var session = require('express-session');
const bodyParser = require("body-parser");
const upload = require('express-fileupload')
const xlsxFile = require('read-excel-file/node');
const _crypto = require('crypto');
const bcrypt = require("bcryptjs");
const mysql = require('mysql');
const path = require('path');
var cors = require('cors');

/*----------------------------------- Declaration Section ----------------------------------------------------------------------*/

// MySQL Server Connection string
var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "(*($^%$#((",
    database: 'dbcart'
});

// MySQL server connection establishment
con.connect(function (err) {
    if (err) throw err;
    console.log("Connected!");
});

var port = 3000 // application running port

const app = express(); // express app decleration

app.use(upload()); // usage of file-upload in express app

app.use(cors()); // usage of cross orgin in express app

//express session configuration
app.use(session({
    secret: _crypto.randomBytes(64).toString('hex'), // for generation of random bytes
    resave: true,
    saveUninitialized: true,
    cookie: {
        expires: 600000 // session expire time
    }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));


/*----------------------------------- Functions ----------------------------------------------------------------------*/

// for importing excel into mysql database
function upload_excel(filename) {
    xlsxFile(filename).then((rows) => {

        rows.splice(0, 1); // for remove headers in excel file

        // inserting into mysql
        con.query("insert into products(PRDT_NAME, PRDT_TYPE, PRDT_PRICE) VALUES ? on duplicate key update PRDT_NAME=VALUES(PRDT_NAME), PRDT_TYPE=VALUES(PRDT_TYPE), PRDT_PRICE=VALUES(PRDT_PRICE)", [rows], function (error, results, fields) {
            if (error) return false;
            return true

        });
    })

}


/*----------------------------------- Rendering and Redirecting -------------------------------------------------------------------*/


// Rendering Customer Home page
app.get('/', function (req, res) {

    if (req.session.loggedin) {
        res.sendFile(path.join(__dirname + '/CustomerHome.html'));
    } else {
        res.redirect('/LoginPage');
    }

});


// Redirecting to login page
app.get('/LoginPage', function (req, res) {
    if (req.session.loggedin) {
        res.sendFile(path.join(__dirname + '/CustomerHome.html'));
    }
    else {
        res.sendFile(path.join(__dirname + '/Login.html'));
    }
});


// Redirect to customer cart page
app.get('/Cart', function (req, res) {
    if (req.session.loggedin) {
        res.sendFile(path.join(__dirname + '/Cart.html'));
    }
    else {
        res.sendFile(path.join(__dirname + '/Login.html'));
    }
});


// Redirect to registration page
app.get('/RegisterPage', function (req, res) {
    res.sendFile(path.join(__dirname + '/Register.html'));
});


// Redirect to Admin registration page
app.get('/AdminRegisterPage', function (req, res) {
    res.sendFile(path.join(__dirname + '/AdminRegister.html'));
});


// Redirect to Admin Home page
app.get('/AdminPage', function (req, res) {
    if (req.session.loggedin) {
        res.sendFile(path.join(__dirname + '/AdminHome.html'));
    }
    else {
        res.sendFile(path.join(__dirname + '/Login.html'));
    }
});



/*----------------------------------- GET API Handlers -------------------------------------------------------------------*/


// Update orders
app.get('/update_order', function (req, res) {
    var order_id = req.query.order_id;
    var order_quantity = req.query.order_quantity;
    var net_amount = req.query.net_amount;

    if (req.session.loggedin) {
        var user_id = req.session.user_id;

        con.query('update orders set PRDT_QTY=' + order_quantity + ', NET_AMT=' + net_amount + ' where ORDER_ID=' + order_id + ' and USER_ID=' + user_id + '', function (error, results, fields) {
            if (error) throw error;
            res.header("Access-Control-Allow-Origin", "*");
            res.redirect('/Cart');
        });
    }
    else {
        res.redirect('/LoginPage');
        res.end();
    }


});


// Delete orders
app.get('/delete_order', function (req, res) {
    var order_id = req.query.order_id;

    if (req.session.loggedin) {
        con.query("update orders set STATUS='Cancelled' where ORDER_ID=" + order_id, function (error, results, fields) {
            if (error) throw error;
            res.header("Access-Control-Allow-Origin", "*");
            res.redirect('/Cart');
        });
    }
    else {
        res.redirect('/LoginPage');
        res.end();
    }


});


// Getting List of all the products
app.get('/get_all_products', function (req, res) {

    if (req.session.loggedin) {
        con.query('SELECT * from products', function (error, results, fields) {
            if (error) throw error;
            res.header("Access-Control-Allow-Origin", "*");
            res.send(results);
        });
    }
    else {
        res.redirect('/LoginPage');
        res.end();
    }


});


// Getting list of all orders
app.get('/get_all_orders', function (req, res) {
    if (req.session.loggedin) {

        con.query("select users.USER_NAME, products.PRDT_NAME, PRDT_QTY, NET_AMT,orders.STATUS, orders.CREATED_ON from orders inner JOIN products on orders.PRDT_ID=products.PRDT_ID inner join users on orders.USER_ID=users.USER_ID where orders.STATUS !='Cancelled' order by orders.CREATED_ON desc", function (error, results, fields) {
            if (error) throw error;
            res.header("Access-Control-Allow-Origin", "*");
            res.send(results);
            res.end();
        });
    }
    else {
        res.redirect('/LoginPage');
        res.end();
    }
});


// Getting List of ordered products
app.get('/get_ordered_products', function (req, res) {

    if (req.session.loggedin) {
        var user_id = req.session.user_id;

        con.query("select orders.ORDER_ID, products.PRDT_PRICE, PRDT_NAME, PRDT_QTY, NET_AMT,orders.STATUS, orders.CREATED_ON from orders inner JOIN products on orders.PRDT_ID=products.PRDT_ID where orders.USER_ID=" + user_id + " order by orders.CREATED_ON desc", function (error, results, fields) {
            if (error) throw error;
            res.header("Access-Control-Allow-Origin", "*");
            res.send(results);
            res.end();
        });
    }
    else {
        res.redirect('/LoginPage');
        res.end();
    }

});


// Getting individual product sales details
app.get('/get_product_history', function (req, res) {
    if (req.session.loggedin) {
        var user_id = req.session.user_id;

        con.query("select products.PRDT_NAME, count(orders.PRDT_ID) as 'total_orders', ifnull(sum(orders.PRDT_QTY),0) as 'total_quantity' , ifnull(sum(orders.NET_AMT),0) as 'total_gain'  from products left join orders on orders.PRDT_ID=products.PRDT_ID group by products.PRDT_ID", function (error, results, fields) {
            if (error) throw error;
            res.header("Access-Control-Allow-Origin", "*");
            res.send(results);
            res.end();
        });
    }
    else {
        res.redirect('/LoginPage');
        res.end();
    }
});


// for Downloading template for file upload
app.get('/download', function (req, res) {
    if (req.session.loggedin) {
        const file = `${__dirname}/uploads/Data.xlsx`;
        res.header("Access-Control-Allow-Origin", "*");
        res.download(file); // Set disposition and send it.
    }
    else {
        res.redirect('/LoginPage');
        res.end();
    }
});



/*----------------------------------- POST API Handlers -------------------------------------------------------------------*/

// Login request handler
app.post('/Login', function (req, res) {

    var username = req.body.username;
    var password = req.body.password;

    if (username && password) {

        con.query('SELECT * FROM users WHERE (USER_MOBILE = ? or USER_EMAIL = ?)', [username, username], function (error, results, fields) {


            if (results.length > 0) {

                var user_type = results[0]['USER_TYPE'];
                var user_id = results[0]['USER_ID'];
                var hashed_password = results[0]['USER_PASSWORD'];

                bcrypt.compare(password, hashed_password, function (err, isMatch) {
                    if (err) {
                        console.log(err);
                    }
                    else if (!isMatch) {
                        res.redirect('/LoginPage');
                        res.end();
                    }
                    else {
                        req.session.loggedin = true;
                        req.session.user = results[0];
                        req.session.username = username;
                        req.session.user_id = user_id;

                        if (user_type == 'Customer') {
                            req.session.admin_user = false;
                            res.redirect('/');
                            res.end();
                        }
                        else {
                            req.session.admin_user = true;
                            res.redirect('/AdminPage');
                            res.end();
                        }
                    }
                })


            }
            else {

                res.redirect('/LoginPage');
                res.end();
            }

        });
    }
    else {
        res.redirect('/LoginPage');
        res.end();
    }

});


//Logout request handler
app.post('/Logout', function (req, res) {
    req.session.loggedin = false;
    res.redirect('/');
});


// User register request handler
app.post('/Register', function (req, res) {

    var username = req.body.username;
    var type = req.body.type;
    var password = req.body.password;
    var confirm_password = req.body.confirm_password;
    var email = req.body.email;
    var mobile = req.body.mobile;
    let user_password = '';

    if (password == confirm_password) {
        user_password = password;
    }

    const saltRounds = 10

    bcrypt.genSalt(saltRounds, function (err, salt) {
        if (err) {
            throw err
        } else {
            bcrypt.hash(user_password, salt, function (err, hash) {
                if (err) {
                    throw err
                } else {
                    user_password = hash;

                    if (username && user_password) {

                        con.query("insert into users(USER_NAME, USER_MOBILE, USER_PASSWORD, USER_EMAIL, USER_TYPE) VALUES ('" + username + "', '" + mobile + "', '" + user_password + "', '" + email + "', '" + type + "')", function (error, results, fields) {
                            if (error) {
                                console.log(error);
                                res.redirect('/RegisterPage');
                            }
                            else {
                                res.redirect('/LoginPage');
                            }

                        });


                    }
                    else {
                        res.redirect('/LoginPage');
                    }
                }
            })
        }
    })



});


// Upload Product List
app.post('/upload', function (req, res) {
    if (req.files) {
        var file = req.files.file;
        var filename = file.name;

        file.mv('./uploads/' + filename, function (err) {
            if (err) {
                res.send(err)
            }
            else {
                upload_excel('./uploads/' + filename);
                res.redirect('/AdminPage');
            }
        });
    }
});


// Creating orders
app.post('/create_order', function (req, res) {

    var product_id = req.body.product_id;
    var product_quantity = req.body.quantity;
    var net_amount = req.body.net_amount;
    var user_id = req.session.user_id;

    if (req.session.loggedin) {
        var user_id = req.session.user_id;

        con.query('INSERT into orders(PRDT_ID, PRDT_QTY, NET_AMT, USER_ID) VALUES (' + product_id + ', ' + product_quantity + ', ' + net_amount + ', ' + user_id + ')', function (error, results, fields) {
            if (error) throw error;
            res.header("Access-Control-Allow-Origin", "*");
            res.redirect('/cart');
            res.end();
        });
    }
    else {
        res.redirect('/LoingPage');
        res.end();
    }


});



app.listen(port);
console.log('Running at Port ' + port);

