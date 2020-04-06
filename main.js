const express = require("express");
const google = require("googleapis").google;
const jwt = require("jsonwebtoken");

// Google's OAuth2 client
const OAuth2 = google.auth.OAuth2;

// Including our config file
const CONFIG = require("./config");

// Creating our express application
const app = express();

// Allowing ourselves to use cookies
const cookieParser = require("cookie-parser");
app.use(cookieParser());

var Invoice = require("./invoice.js");
var invoiceList = [];

// Setting up Views
app.set("view engine", "ejs");
app.set("views", __dirname);

app.get("/", function (req, res) {
  // Create an OAuth2 client object from the credentials in our config file
  const oauth2Client = new OAuth2(
    CONFIG.oauth2Credentials.client_id,
    CONFIG.oauth2Credentials.client_secret,
    CONFIG.oauth2Credentials.redirect_uris[0]
  );

  // Obtain the google login link to which we'll send our users to give us access
  const loginLink = oauth2Client.generateAuthUrl({
    access_type: "offline", // Indicates that we need to be able to access data continously without the user constantly giving us consent
    scope: CONFIG.oauth2Credentials.scopes, // Using the access scopes from our config file
  });
  return res.render("index", { loginLink: loginLink });
});

app.get("/auth_callback", function (req, res) {
  // Create an OAuth2 client object from the credentials in our config file
  const oauth2Client = new OAuth2(
    CONFIG.oauth2Credentials.client_id,
    CONFIG.oauth2Credentials.client_secret,
    CONFIG.oauth2Credentials.redirect_uris[0]
  );

  if (req.query.error) {
    // The user did not give us permission.
    return res.redirect("/");
  } else {
    oauth2Client.getToken(req.query.code, function (err, token) {
      if (err) return res.redirect("/");

      // Store the credentials given by google into a jsonwebtoken in a cookie called 'jwt'
      res.cookie("jwt", jwt.sign(token, CONFIG.JWTsecret));
      return res.redirect("/get_some_data");
    });
  }
});

app.get("/get_some_data", function (req, res) {
  if (!req.cookies.jwt) {
    // We haven't logged in
    return res.redirect("/");
  }

  // Create an OAuth2 client object from the credentials in our config file
  const oauth2Client = new OAuth2(
    CONFIG.oauth2Credentials.client_id,
    CONFIG.oauth2Credentials.client_secret,
    CONFIG.oauth2Credentials.redirect_uris[0]
  );

  // Add this specific user's credentials to our OAuth2 client
  oauth2Client.credentials = jwt.verify(req.cookies.jwt, CONFIG.JWTsecret);

  const drive = google.drive({ version: "v3", oauth2Client });
  drive.files.list(
    {
      pageSize: 10,
      fields: "nextPageToken, files(id, name)",
      auth: oauth2Client,
    },
    (err, resp) => {
      if (err) return console.log("The API returned an error: " + err);
      const files = resp.data.files;
      if (files.length) {
        filesInvoices = files.filter((item) =>
          item.name.match(/.*time.*sheet.*/i)
        );
        console.log("Files:");
        var itemsProcessed = 0;
        filesInvoices.forEach((element) => {
          console.log("found timesheet");
          console.log(`${element.name} (${element.id})`);
          createInvoices(oauth2Client, element.id, element.name)
            .then((passed) => {
              console.log("done that timesheets");
              itemsProcessed++;

              console.log(itemsProcessed);
              if (itemsProcessed == filesInvoices.length) {
                console.log("done all");
                invoiceList.forEach((invoice) => {
                  invoice.services.sort(function(a, b){return b['Service Days']-a['Service Days']});
                  console.log(invoice.clientName);
                  invoice.services.forEach((serv)=>{
                    //console.log(serv['Service Days'])

                  });
                });
                return res.render("data", { subscriptions: invoiceList });
              }
            })
            .catch((err) => console.log("there was an error"));
        });
      } else {
        console.log("No files found.");
      }
      // Render the data view, passing the subscriptions to it
    }
  );
});

// Listen on the port defined in the config file
app.listen(CONFIG.port, function () {
  console.log(`Listening on port ${CONFIG.port}`);
});

function createInvoices(auth, sheetId, employeeName) {
    var employeeName = employeeName.split("-")[0].trim();
  return new Promise((resolve, reject) => {
    var inTable = false;
    console.log(`\n\ncreating invoices from ${employeeName}'  `);
    const sheets = google.sheets({ version: "v4", auth });
    sheets.spreadsheets.values.get(
      {
        spreadsheetId: sheetId,
        range: "Jan 16-31-20!A2:E",
      },
      (err, res) => {
        if (err) {
          console.log("The API returned an error: " + err);
          resolve();
        } else {
          const rows = res.data.values;
          console.log("client, date, shift time, break time, total hours");
          if (rows.length) {
            //console.log('Name, Major:');
            // Print columns A and E, which correspond to indices 0 and 4
            rows.forEach((row) => {
              if (row[0] == null) {
                inTable = false;
                resolve();
              }
              if (inTable) {
                console.log(
                  `${row[0]},${row[1]},${row[2]},${row[3]} ${row[4]}`
                );
                var contains = false;
                for(var i = 0; i<invoiceList.length;i++){
                    if (
                        invoiceList[i].clientName.trim().toLowerCase().split(" ").join("") ==
                        row[0].trim().toLowerCase().split(" ").join("")
                      ) {
                        var service2 = {
                            "Service Days": row[1],
                            "Service Time": row[2],
                            "Total Hours": row[4],
                            "Caregiver":employeeName,
                            "Service Cost":parseFloat(row[4])*25
                          }; 
                          invoiceList[i].services.push(service2)
                       contains  = true;
                       break;
                      } else {
                          console.log("compared "+invoiceList[i].clientName.trim().toLowerCase().split(" ").join("") + " "+row[0].trim().toLowerCase().split(" ").join(""))
                          contains = false;
              
                      }
                }
                
                if(!contains){
                    console.log("push new");
                    var service = {
                        "Service Days": row[1],
                        "Service Time": row[2],
                        "Total Hours": row[4],
                        "Caregiver":employeeName,
                        "Service Cost":row[4]*25
                      };
                    var services = []
                    services.push(service);
                    invoiceList.push(new Invoice(row[0], services));
                }

                //   var anInvoice =new Invoice(row[0]);
                //   console.log(anInvoice.clientName);
              }
              if (row[0] != null) {
                if (row[0].match(/.*client.*/i)) {
                  inTable = true;
                }
              }
            });
          } else {
            console.log("No data found.");
            resolve();
          }
        }
      }
    );
  });
}
