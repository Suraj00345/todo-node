const express = require("express");
require("dotenv").config();
const clc = require("cli-color");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MongodbSession = require("connect-mongodb-session")(session);

//file-imports
const { userDataValidation, isEmailRgex } = require("./utils/authUtils");
const userModel = require("./models/userModel");
const isAuth = require("./middleware/authMiddleware");
const todoDataValidation = require("./utils/todoUtils");
const todoModel = require("./models/todoModel");

//constants
const app = express();
const PORT = process.env.PORT;
const store = new MongodbSession({
  uri: process.env.MONGO_URI,
  collection: "sessions",
});

//db connections
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log(clc.yellowBright("Mongo Db connected succesfully"));
  })
  .catch((err) => console.log(clc.redBright(err)));

//middleware
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true })); // body parser url encoded
app.use(express.json());

app.use(
  session({
    secret: process.env.SECRET_KEY,
    store: store,
    resave: false,
    saveUninitialized: false,
  })
);

// API's
app.get("/", (req, res) => {
  return res.send("server is running");
});

app.get("/register", (req, res) => {
  return res.render("registerPage.ejs");
});

app.post("/register", async (req, res) => {
  console.log(req.body);

  const { name, email, username, password } = req.body;

  // data validation
  try {
    await userDataValidation({ email, username, name, password });
  } catch (error) {
    return res.status(400).json(error);
  }

  try {
    // email and username should be unique
    //email unique
    const userEmailExist = await userModel.findOne({ email: email });
    if (userEmailExist) {
      return res.status(400).json("Email already exist");
    }
    // username unique
    const userUsernameExist = await userModel.findOne({ username: username });
    if (userUsernameExist) {
      return res.status(400).json("Username already exist");
    }

    //encrypt the password
    const hashedPassword = await bcrypt.hash(
      password,
      parseInt(process.env.SALT)
    );

    // store with in db
    const userObj = new userModel({
      name,
      email,
      username,
      password: hashedPassword,
    });

    const userDb = await userObj.save();
    return res.status(201).redirect("/login");
  } catch (error) {
    return res.status(500).json({
      error: error,
      message: "Internal server error",
    });
  }
});

// login
app.get("/login", (req, res) => {
  return res.render("loginPage.ejs");
});

app.post("/login", async (req, res) => {
  console.log(req.body);
  const { loginId, password } = req.body;
  if (!loginId || !password) {
    return res.status(400).json("Missing login credentials");
  }

  if (typeof loginId !== "string") {
    return res.status(400).json("loginId is not a string");
  }

  if (typeof password !== "string") {
    return res.status(400).json("password is not a string");
  }

  //find the user from db
  try {
    let userDb = {};
    if (isEmailRgex({ key: loginId })) {
      userDb = await userModel.findOne({ email: loginId }.select("+password"));
      console.log("find user with email");
    } else {
      userDb = await userModel.findOne({ username: loginId });
      console.log("find user with username");
    }
    if (!userDb) {
      return res.status(400).json("user not found, please register first");
    }

    //compare the password
    const isMatched = await bcrypt.compare(password, userDb.password);
    if (!isMatched) return res.status(400).json("incorrect password");

    // adding session based auth
    req.session.isAuth = true;
    req.session.user = {
      userId: userDb._id,
      username: userDb.username,
      email: userDb.email,
    };
    return res.redirect("/dashboard");
  } catch (error) {
    return res.status(500).json(console.error());
  }
});

app.get("/dashboard", isAuth, (req, res) => {
  console.log("dashboard api");
  return res.render("dashboardPage");
});

//logout API
app.post("/logout", isAuth, (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json("Logout unsuccessfull");
    return res.status(200).json("logout successful");
  });
});

// todo API's

app.post("/create-item", isAuth, async (req, res) => {
  console.log(req.body);
  const todo = req.body.todo;
  try {
    await todoDataValidation({ todo });
  } catch (error) {
    return res.status(400).json(error);
  }

  const userObj = new todoModel({
    todo: todo,
  });

  try {
    const todoDb = await userObj.save();

    return res.status(201).json({
      message: "Todo created successfully",
      data: todoDb,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error,
    });
  }

});

// listing to the Port
app.listen(PORT, () => {
  console.log(clc.yellowBright.bold("server is running at:"));
  console.log(clc.yellowBright.underline(`http://localhost:${PORT}/`));
});
