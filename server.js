require("dotenv").config();
var express = require("express");
var mongoose = require("mongoose");
var exphbs = require("express-handlebars");

var axios = require("axios");
var cheerio = require("cheerio");

// Require all models
var db = require("./models");

var PORT = 8080;
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/news-scraper";

// Initialize Express
var app = express();

// Configure middleware
// Parse request body as JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Make public a static folder
app.use(express.static("public"));

app.engine("handlebars", exphbs(
{
    defaultLayout: "main",
    helpers:
    {
        isEmptyString: function(value)
        {
            return value === "";
        }
    }
}));
app.set("view engine", "handlebars");

// Connect to the Mongo DB
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// scrape data and save it to MongoDB.
app.get("/", function(req, res) {

    axios.get("https://www.theguardian.com/us")
    .then(function(response) {
        var $ = cheerio.load(response.data);

        $(".fc-item__container").each(function(i, element) {

            var articleInfo = $(element).children(".fc-item__content").children(".fc-item__header").children(".fc-item__title").children(".fc-item__link");

            var image = $(element).find("picture")[0];
            if (typeof image !== typeof undefined && image !== false)
            {
                image = $(image).children()[0].attribs["srcset"];
            }
            else
            {
                image = "";
            }

            var url = $(articleInfo).attr("href");
            var kicker = $(articleInfo).children(".fc-item__kicker").text();
            var headline = $(articleInfo).children(".fc-item__headline").text();

            var result = {};
            result.headline = headline;
            result.kicker = kicker;
            result.url = url;
            result.image = image;

            db.Article.findOneAndUpdate(
                {url: url}, // find a document with that filter
                result,  // document to insert or update
                {upsert: true,
                useFindAndModify: false}, // options
                function (err) { // callback
                    if (err) {
                        console.log(err);
                    }
                }
            )
            .catch(function(err)
            {
                console.log(err);
            });
        });
        //res.send("scrape complete");
        db.Article.find({}, function(err, data)
        {
            res.render("index", {articles: data});
        });
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // TODO
  // ====
  // Finish the route so it finds one article using the req.params.id,
  // and run the populate method with "note",
  // then responds with the article with the note included
  db.Article.findOne({_id: req.params.id})
  .then(function(dbArticle)
  {
      res.json(dbArticle);
  })
  .catch(function(err) {
      // If an error occurs, send it back to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // TODO
  // ====
  // save the new note that gets posted to the Notes collection
  // then find an article from the req.params.id
  // and update it's "note" property with the _id of the new note
  db.Note.create(req.body)
    .then(function(dbNote) {
      return db.Article.findOneAndUpdate({_id: req.params.id}, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      res.json(dbArticle);
    })
    .catch(function(err) {
      res.json(err);
    });
});


/* -/-/-/-/-/-/-/-/-/-/-/-/- */

// Listen on port 8080
app.listen(8080, function() {
  console.log("App running on port" + PORT);
});
