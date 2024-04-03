//Setting up the server using express
const express = require("express");
const app = express();
const HTTP_PORT = process.env.PORT || 8080;


app.use(express.static('assets'))


app.use(express.urlencoded({ extended: true }))


const exphbs = require("express-handlebars");
app.engine(".hbs", exphbs.engine({
    extname: ".hbs",
    helpers: {
        json: (context) => { return JSON.stringify(context) }
    }
}));
app.set("view engine", ".hbs");

const session = require('express-session')
app.use(session({
    secret: "the quick brown fox jumped over the lazy dog 1234567890",  // random string, used for configuring the session
    resave: false,
    saveUninitialized: true
}))

// Setting Up the Database
const mongoose = require('mongoose');

// check if connection was successful
const db = mongoose.connection
db.on("error", console.error.bind(console, "Error connecting to database: "));
db.once("open", () => {
    console.log("Mongo DB connected successfully.");
});

mongoose.connect("mongodb+srv://tsb22:6KFmnaCYQWoiRx5e@tsb.8a4vf4n.mongodb.net/?retryWrites=true&w=majority");
const Schema = mongoose.Schema
const userSchema = new Schema({ username: String, password: String, userType: String })
const User = mongoose.model("user_collection", userSchema)
const classesSchema = new Schema({ image: String, className: String, duration: Number, status: Boolean })
const Classes = mongoose.model("classes_collection", classesSchema)
const paymentSchema = new Schema({ username: String, className: String, pricebefore: Number, total: Number, date: Date })
const Payments = mongoose.model("payments_collection", paymentSchema)
// endpoints

//EndPoint for Login or Sign up page
app.get("/", async (req, res) => {
    console.log(`[DEBUG] GET request received at / endpoint`)
    console.log(req.session)
    if (req.session.userLoggedIn === undefined) {
        res.render("login", { layout: "my-template", status: false })
        return
    }
    else {
        if (req.session.userLoggedIn === true) {
            try {
                let cost = 0
                let list = []

                const classList = await Classes.find().lean()
                if (classList.duration === 0) {
                    res.send("ERROR: There are no classes in the gym!")
                    return
                }
                for (let i = 0; i < classList.length; i++) {
                    cost = 0.65 * classList[i].duration
                    const classdict = { id: classList[i]._id, image: classList[i].image, class: classList[i].className, classduration: classList[i].duration, Status: classList[i].status, Price: cost }
                    list.push(classdict)
                }
                res.render("classes", { layout: "my-template", status: true, classes: list })
            } catch (error) {
                console.log(error)
            }
            return
        }
    }

})

//Endpoint for Login option
app.post("/login", async (req, res) => {
    console.log(`[DEBUG] POST request received at /login endpoint`)
    const emailFromUI = req.body.emailAddress
    const passwordFromUI = req.body.password
    console.log(`LOGIN Email: ${emailFromUI}, Password: ${passwordFromUI}`)

    try {
        const userFromDB = await User.findOne({ username: emailFromUI })
        if (userFromDB === null) {
            res.send(`LOGIN ERROR: This user does not exist: ${emailFromUI}`)
            return
        }
        else {
            if (userFromDB.password === passwordFromUI) {
                req.session.userLoggedIn = true
                req.session.userType = userFromDB.userType
                req.session.username = userFromDB.username
                res.redirect("/")
                return
            }
            else {
                res.send(`LOGIN ERROR: Invalid password`)
                return
            }

        }
    } catch (error) {
        console.log(error)
    }
})

// Endpoint for creating an account
app.post("/create", async (req, res) => {
    const emailFromUI = req.body.emailAddress
    const passwordFromUI = req.body.password
    const userTypeFromUI = "user"
    console.log(`SIGNUP: Email: ${emailFromUI}, Password: ${passwordFromUI}, User Type: ${userTypeFromUI}`)

    try {
        const userFromDB = await User.findOne({ username: emailFromUI })
        if (userFromDB === null) {

            const userToAdd = User({ username: emailFromUI, password: passwordFromUI, userType: userTypeFromUI })
            await userToAdd.save()

            req.session.hasLoggedInUser = true
            req.session.userType = userToAdd.userType
            req.session.username = userToAdd.username
            res.send(`Done AND logged in! Go back home!`)


        }
        else {
            // 3. if yes, then show an error
            res.send(`ERROR: There is already a user account for ${emailFromUI}`)
            return
        }
    }
    catch (error) {
        console.log(error)
    }
})

//Endpoint for the classes booked
app.post("/book/:idtoBook", async (req, res) => {
    console.log(`[DEBUG] Request received at /book POST endpoint`)
    const idtobook = req.params.idtoBook
    const Username = req.session.username
    try {
        console.log(idtobook)
        const classFromDB = await Classes.findOne({ _id: idtobook })
        if (classFromDB === null) {
            res.send(`LOGIN ERROR: This id does not exist`)
            return
        }
        else {
            classFromDB.status = false
            await classFromDB.save()
            let price = 0.65 * classFromDB.duration
            let Total = (0.13 * price) + price
            console.log(req.session.username)
            const payment = Payments({ username: Username, className: classFromDB.className, pricebefore: price, total: Total, date: Date() })
            await payment.save()
            res.send(`The Class has succesfully been booked. View cart page to see more`)

        }
    }
    catch (error) {
        console.log(error)
    }
})
//Endpoint if you are not logged in
app.post("/not-book", (req, res) => {
    res.send("You have to log in first")
})

//Endpoint for Admin
app.get("/admin", async (req, res) => {
    console.log(`[DEBUG] POST request received at /admin endpoint`)

    if (req.session.userLoggedIn === undefined) {
        res.send("ERROR: you have to log in")
        return
    }
    else {

        if (req.session.userType === "admin") {
            if (req.session.userLoggedIn === true) {
                const paymentsfromDB = await Payments.find().lean()
                res.render("admin", { layout: "my-template", status: true, paylist: paymentsfromDB })
                return
            }
        }
        else {
            res.send("ERROR: You must be an admin user.")
            return
        }
    }
})

//Endpoint for Classes
app.get("/classes", async (req, res) => {
    console.log(`[DEBUG] POST request received at /classes endpoint`)
    try {
        let cost = 0
        let list = []

        const classList = await Classes.find().lean()
        if (classList.duration === 0) {
            res.send("ERROR: There are no classes in the gym!")
            return
        }
        for (let i = 0; i < classList.length; i++) {
            cost = 0.65 * classList[i].duration
            const classdict = { id: classList[i]._id, image: classList[i].image, name: classList[i].className, classduration: classList[i].duration, Status: classList[i].status, Price: cost }
            list.push(classdict)
        }
        console.log(list)
        console.log(classList)
        console.log(req.session)
        if (req.session.userLoggedIn === undefined) {

            res.render("classes", { layout: "my-template", status: false, classes: list })
        }
        else {
            if (req.session.userLoggedIn === true) {
                res.render("classes", { layout: "my-template", status: true, classes: list })
            }
        }

    } catch (error) {
        console.log(error)
    }

})

//Endpoint for cart
app.get("/cart", async (req, res) => {
    console.log(`[DEBUG] POST request received at /cart endpoint`)
    if (req.session.userLoggedIn === undefined) {
        res.send("ERROR: you have to log in")
        return
    }
    else {
        if (req.session.userLoggedIn === true) {
            try {
                let cost = 0
                let list = []
                const classList = await Classes.find().lean()
                if (classList.duration === 0) {
                    res.send("ERROR: There are no classes in the gym!")
                    return
                }
                for (let i = 0; i < classList.length; i++) {
                    if (classList[i].status === false) {
                        cost = 0.65 * classList[i].duration
                        const classdict = { id: classList[i]._id, image: classList[i].image, name: classList[i].className, classduration: classList[i].duration, Status: classList[i].status, Price: cost }
                        list.push(classdict)
                    }
                }
                res.render("cart", { layout: "my-template", status: true, classes: list })
            } catch (error) {
                console.log(error)
            }
        }
    }
})
//Endpoint For Logout
app.get("/logout", (req, res) => {
    console.log(`[DEBUG] LOGOUT requested...`)
    req.session.destroy()
    res.redirect("/")

})

// setup for the server
const onHttpStart = () => {
    console.log("Express http server listening on: " + HTTP_PORT);
    console.log(`http://localhost:${HTTP_PORT}`);
}
app.listen(HTTP_PORT, onHttpStart);
