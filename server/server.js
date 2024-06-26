require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());
app.use(express.json({ limit: "50mb" }));
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { parseISO, formatISO } = require("date-fns");

const socketIo = require("socket.io");
const http = require("http");
const server = http.createServer(app);
const io = socketIo(server);

// MongoDB connection
const mongoUrl = process.env.MONGO_URL;
mongoose
  .connect(mongoUrl)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Error: ", err));

// JWT secret key
const JWT_SECRET = process.env.JWT_SECRET;

const port = process.env.PORT || 5001;
const socketPort = process.env.SOCKET_PORT || 5000;

// Models
require("./models/User");
const User = mongoose.model("UserInfo");
require("./models/Chat");
const Chat = mongoose.model("Chat");
require("./models/Matches");
const Match = mongoose.model("Matches");

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Registration
app.post("/register", async (req, res) => {
  const { firstName, lastName, email, password, gender } = req.body;

  const oldUser = await User.findOne({ email });
  if (oldUser) {
    return res.send({ data: "User already exists" });
  }

  const encryptedPassword = await bcrypt.hash(password, 10);

  try {
    const newUser = await User.create({
      firstName,
      lastName,
      email,
      password: encryptedPassword,
      gender,
    });
    res.send({
      status: "ok",
      data: { id: newUser._id, message: "User created" },
    });
  } catch (err) {
    res.send({ status: "error", data: "Error creating user" });
  }
});

// Update user
app.post("/update/:id", async (req, res) => {
  const { id } = req.params;
  const { image, age, location, interests, trip_planning, about, reviews } =
    req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).send({ status: "error", data: "User not found" });
    }

    user.image = image || user.image;
    user.age = age || user.age;
    user.location = location || user.location;
    user.interests = interests || user.interests;
    user.trip_planning = trip_planning || user.trip_planning;
    user.about = about || user.about;
    user.reviews = reviews || user.reviews;

    await user.save();
    res.send({ status: "ok", data: "User updated" });
  } catch (err) {
    res.status(500).send({ status: "error", data: "Error updating user" });
  }
});

// Get user by id
app.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Get user by token
app.post("/user", async (req, res) => {
  const { token } = req.body;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ email: decoded.email });

    if (!user) {
      return res.status(404).send({ status: "error", data: "User not found" });
    }

    res.send({ status: "ok", data: user });
  } catch (err) {
    return res
      .status(500)
      .send({ status: "error", data: "Error fetching user" });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const oldUser = await User.findOne({ email });

  if (!oldUser) {
    return res.send({ data: "User does not exist" });
  }

  if (await bcrypt.compare(password, oldUser.password)) {
    const token = jwt.sign({ email: oldUser.email }, JWT_SECRET);

    res.status(201).send({ status: "ok", data: { token } });
  } else {
    return res.send({ status: "error", data: "Incorrect password" });
  }
});

// Delete user
app.post("/delete", async (req, res) => {
  const { id } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).send({ status: "error", data: "User not found" });
    } else {
      await User.deleteOne(user._id);
      res.send({ status: "ok", data: "User deleted" });

      await Chat.deleteMany({ participants: user._id });
      await Match.deleteMany({
        $or: [{ user1Id: user._id }, { user2Id: user._id }],
      });
    }
  } catch (err) {
    res.status(500).send({ status: "error", data: "Error deleting user" });
  }
});

// Search users by trip planning
app.post("/search", async (req, res) => {
  const { country, startDate, endDate, userId } = req.body;

  try {
    const startDateISO = startDate
      ? formatISO(parseISO(startDate), { representation: "date" })
      : null;
    const endDateISO = endDate
      ? formatISO(parseISO(endDate), { representation: "date" })
      : null;

    const query = {
      _id: { $ne: userId },
      trip_planning: {
        $elemMatch: {
          country: { $regex: new RegExp(country, "i") },
          ...(startDateISO &&
            endDateISO && {
              $or: [
                {
                  endDate: { $gte: startDateISO },
                  startDate: { $lte: endDateISO },
                },
                {
                  startDate: { $gte: startDateISO },
                  endDate: { $lte: endDateISO },
                },
              ],
            }),
          ...(startDateISO &&
            !endDateISO && {
              endDate: { $gte: startDateISO },
            }),
          ...(!startDateISO &&
            endDateISO && {
              startDate: { $lte: endDateISO },
            }),
        },
      },
    };

    const users = await User.find(query);

    if (!users.length) {
      return res.status(404).send({ status: "error", data: "Users not found" });
    }

    res.send({ status: "ok", data: users });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res
      .status(500)
      .send({ status: "error", data: "Error fetching users" });
  }
});

// Add review
app.post("/add_review/:id", async (req, res) => {
  const { review } = req.body;

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).send({ status: "error", data: "User not found" });
    } else {
      user.reviews.unshift(review);
      await user.save();
      res.send({ status: "ok", data: "Review added" });
    }
  } catch (err) {
    res.status(500).send({ status: "error", data: "Error adding review" });
  }
});

// Get reviews by user id
app.get("/get_reviews/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ status: "error", data: "User not found" });
    }
    res.json({ status: "ok", data: user.reviews });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ status: "error", data: "Server error" });
  }
});

// io connection
io.on("connection", (socket) => {
  console.log("a user connected");

  socket.on("sendMessage", async (data) => {
    try {
      const { senderId, receiverId, message, match } = data;

      let chat = await Chat.findOne({
        participants: { $all: [senderId, receiverId] },
      });

      console.log("match: ", match);

      if (!chat) {
        chat = new Chat({
          participants: [senderId, receiverId],
          messages: [{ senderId, message, isRead: false }],
          match: match,
        });
      } else {
        chat.messages.push({ senderId, message, isRead: false });
      }

      await chat.save();

      io.emit("receiveMessage", chat.messages[chat.messages.length - 1]);
    } catch (err) {
      console.log("Error handling the message:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

// io listen on port
server.listen(socketPort, () => {
  console.log(`SocketIO running on port: ${socketPort}`);
});

app.get("/messages", async (req, res) => {
  try {
    const { senderId, receiverId } = req.query;

    const chat = await Chat.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!chat) {
      return res.status(404).json({ status: "error", data: "Chat not found" });
    }

    res
      .status(200)
      .json({ status: "ok", data: chat.messages, match: chat.match });
  } catch (err) {
    res.status(500).json({ status: "error", data: "Error fetching messages" });
  }
});

// Fetch chat users
app.get("/chat_users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const chats = await Chat.find({ participants: userId }).populate(
      "participants",
      "_id firstName image"
    );

    const chatUsers = chats.map((chat) => {
      const otherUser = chat.participants.find(
        (participant) => participant._id.toString() !== userId
      );
      const lastMessage = chat.messages[chat.messages.length - 1];

      return {
        user: otherUser,
        lastMessage: lastMessage ? lastMessage.message : null,
        unreadCount: chat.messages.filter(
          (message) => message.senderId !== userId && !message.isRead
        ).length,
      };
    });

    res.send({ status: "ok", data: chatUsers });
  } catch (err) {
    console.error(err.message);
    res
      .status(500)
      .send({ status: "error", data: "Error fetching chat users" });
  }
});

app.post("/mark_as_read", async (req, res) => {
  const { messages } = req.body;

  try {
    await Chat.updateMany(
      { "messages._id": { $in: messages } },
      { $set: { "messages.$.isRead": true } }
    );
    res.status(200).send({ status: "ok", data: "Messages marked as read" });
  } catch (err) {
    res
      .status(500)
      .send({ status: "error", data: "Error marking messages as read" });
  }
});

// Create a new match schema for the chat
app.post("/create_match", async (req, res) => {
  const { user1Id, user2Id } = req.body;

  try {
    const existingMatch = await Match.findOne({
      $or: [
        { user1Id: user1Id, user2Id: user2Id },
        { user1Id: user2Id, user2Id: user1Id },
      ],
    });
    if (existingMatch) {
      return res
        .status(200)
        .send({ status: "ok", data: "Match record already exists" });
    }

    const newMatch = new Match({
      user1Id,
      user2Id,
    });

    await newMatch.save();

    res.status(201).send({ status: "ok", data: "Match record created" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ status: "error", data: "Error creating match" });
  }
});

// Update match schema
app.post("/update_match", async (req, res) => {
  const { user1Id, user2Id, clickedBy } = req.body;

  try {
    const match = await Match.findOne({
      $or: [
        { user1Id: user1Id, user2Id: user2Id },
        { user1Id: user2Id, user2Id: user1Id },
      ],
    });

    if (!match) {
      return res.status(404).send({ status: "error", data: "Match not found" });
    }

    if (clickedBy === match.user1Id) {
      match.user1Clicked = true;
    } else {
      match.user2Clicked = true;
    }

    if (match.user1Clicked && match.user2Clicked) {
      match.bothClicked = true;
    }

    await match.save();

    res.status(200).send({ status: "ok", data: "Match updated" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ status: "error", data: "Error updating match" });
  }
});

// Check if btn lets go is clicked
app.post("/check_letsgo_btn", async (req, res) => {
  const { user1Id, user2Id } = req.body;

  try {
    const match = await Match.findOne({
      $or: [
        { user1Id: user1Id, user2Id: user2Id },
        { user1Id: user2Id, user2Id: user1Id },
      ],
    });

    if (!match) {
      return res.status(404).send({ status: "error", data: "Match not found" });
    }

    let clicked = false;
    if (user1Id === match.user1Id) clicked = match.user1Clicked;
    else clicked = match.user2Clicked;

    res.status(200).send({ status: "ok", clicked: clicked });
  } catch (err) {
    res
      .status(500)
      .send({ status: "error", data: "Error checking let's go button" });
  }
});

// Check if both users clicked the let's go button
app.post("/check_both_clicked", async (req, res) => {
  const { user1Id, user2Id } = req.body;

  try {
    const match = await Match.findOne({
      $or: [
        { user1Id: user1Id, user2Id: user2Id },
        { user1Id: user2Id, user2Id: user1Id },
      ],
    });

    if (!match) {
      return res.status(404).send({ status: "error", data: "Match not found" });
    }

    res.status(200).send({ status: "ok", bothClicked: match.bothClicked });
  } catch (err) {
    res
      .status(500)
      .send({ status: "error", data: "Error checking both clicked status" });
  }
});
